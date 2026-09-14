/* part of the ronin-cowork client — see js/README.md */
import { IS_TOUCH, S } from './state.js';
import { CAN_RECORD, wireDictation } from './voice.js';
import { t } from './lexicon.js';
import { settleComposer } from './composer-rules.js';

/**
 * @param {HTMLElement} body
 * @param {{activate: () => void, clearOverlays: () => void, connected: () => boolean,
 *          send: (text: string) => boolean,
 *          sendMessage: (text: string) => Promise<{ok: boolean, why?: string}>,
 *          scrollToBottom: () => void}} hooks
 *   `send` is a command key, fire-and-forget. `sendMessage` is a message: it resolves to the
 *   host's answer, and the box clears on nothing else.
 * @returns {{el: HTMLElement, ta: HTMLTextAreaElement, show: (on: boolean) => void}}
 */
export function buildComposer(body, hooks) {
  const wrap = document.createElement('div');
  wrap.className = 'composer';
  const ta = document.createElement('textarea');
  ta.rows = 1;
  ta.placeholder = t('composer.placeholder', 'Message…');
  ta.title = t('composer.title', 'Enter sends · Shift+Enter or Option+Enter for a new line');
  ta.spellcheck = false;
  // 🎤 sits ON the box, not floating over the terminal, and records to the host
  // rather than to Apple — same engine the Mac's ⌥ mic uses, so it knows the words
  // in ronin_catalogs/HOTWORDS.md. Built only where the browser can actually record; a
  // dead button is worse than none. (Recording needs a secure context, so over the
  // tailnet that means the https URL, not the bare IP.)
  const mic = CAN_RECORD && IS_TOUCH ? document.createElement('button') : null;
  if (mic) {
    mic.className = 'cmic';
    mic.type = 'button';
    mic.textContent = '🎤';
    mic.title = t('composer.mic_title', 'Dictate into this box — tap again to stop, then ↵ to send');
  }
  const btn = document.createElement('button');
  btn.className = 'csend';
  btn.textContent = '↵';
  btn.title = t('composer.send', 'Send');
  // The one honest line: why the text is still here. Shown only while a send is held.
  const why = document.createElement('p');
  why.className = 'cwhy';
  why.setAttribute('role', 'status');
  wrap.append(...[why, ta, mic, btn].filter(Boolean));
  body.appendChild(wrap);

  const state = { dictation: null, queued: false, inflight: false };
  // The wire's own words for a send that did not get through, in the owner's language.
  const reasons = {
    'not connected': () => t('composer.why_not_connected', 'the tile is not connected'),
    refused: () => t('composer.why_refused', 'the session refused it'),
  };
  const hold = (reason) => {
    wrap.classList.toggle('held', !!reason);
    why.textContent = reason ? t('composer.held', 'Not sent — {why}. Your text is kept.', { why: (reasons[reason] || (() => reason))() }) : '';
  };
  if (mic) state.dictation = wireDictation(ta, mic);
  if (state.dictation)
    state.dictation.afterText = () => {
      if (!state.queued) return;
      state.queued = false;
      wrap.classList.remove('queued');
      submit();
    };

  const grow = () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };
  const clearBox = () => {
    if (S.dictation) S.dictation.stop();
    ta.value = '';
    grow();
    hold(null);
    ta.focus();
  };
  const submit = () => {
    // Stop listening BEFORE reading the box: iOS keeps the recognizer running a
    // beat after you stop talking, and a trailing result would refill a box we
    // are about to clear.
    if (S.dictation) S.dictation.stop();
    // Enter while the clip is still TRANSCRIBING: the box is empty but a message
    // is on its way. Queue the send; `afterText` above fires it when it lands.
    if (state.dictation && state.dictation.busy && !ta.value.trim()) {
      state.queued = true;
      wrap.classList.add('queued');
      return;
    }
    // One message in flight at a time: a second Enter while the host is still answering
    // would send the same text twice.
    if (state.inflight) return;
    const text = ta.value;
    if (!text.trim()) {
      // An empty box sends a command key directly to the terminal.
      if (!hooks.connected()) { hold('not connected'); return; }
      hooks.send('\r');
      return;
    }
    // The server owns text + Enter. The terminal socket is only for direct keys.
    state.inflight = true;
    wrap.classList.add('sending');
    hold(null);
    hooks.sendMessage(text).then((outcome) => {
      state.inflight = false;
      wrap.classList.remove('sending');
      const verdict = settleComposer(outcome, text, ta.value);
      if (verdict.clear) {
        ta.value = '';
        grow();
        hooks.scrollToBottom();
        return;
      }
      if (verdict.why) hold(verdict.why);
    });
  };
  /**
   * Lift above the on-screen keyboard.
   *
   * iOS does not resize the window when the keyboard appears — it shrinks the
   * VISUAL viewport and leaves the layout viewport alone, so a box pinned to the
   * bottom ends up underneath the keyboard, which is where the ⌨ overlay this
   * replaces learned the same lesson. `visualViewport` is the only thing that knows
   * how much is covered.
   */
  const lift = () => {
    const vv = window.visualViewport;
    const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    wrap.style.bottom = kb + 'px';
  };
  if (IS_TOUCH) {
    ta.setAttribute('enterkeyhint', 'send');
    ta.setAttribute('autocorrect', 'on');
    ta.addEventListener('focus', lift);
    ta.addEventListener('blur', () => {
      wrap.style.bottom = '0px';
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', lift);
      window.visualViewport.addEventListener('scroll', lift);
    }
  }
  ta.addEventListener('input', () => {
    grow();
    if (wrap.classList.contains('held')) hold(null); // the person is editing: the old reason is stale
  });
  // Drops (an @mention, a doc reference) are the TILE's — js/tiledroptext.js listens on
  // the body, which this textarea sits in, and lands text here when the tile is unlocked.
  ta.addEventListener('focus', () => {
    hooks.activate();
    // TOUCH: typing is the way back to the pane. The ladder and the letter cover
    // the transcript and are scrollable, so on a phone — where the keyboard then
    // takes the bottom half too — reaching for the text box with one of them open
    // left almost nothing of the session visible, and dismissing it meant finding
    // the right ✕ under the keyboard. Tapping into the box IS the dismissal.
    //
    // Desktop keeps them: there is room for a ladder and an input at once, and
    // reading the ladder while writing a reply to its gate is the normal case.
    if (IS_TOUCH) hooks.clearOverlays();
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    if (e.shiftKey) return; // the browser inserts this one itself
    if (e.altKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      ta.setRangeText('\n', ta.selectionStart, ta.selectionEnd, 'end');
      grow();
      return;
    }
    e.preventDefault();
    submit();
  });
  btn.addEventListener('click', submit);

  return {
    el: wrap,
    ta,
    clear: clearBox,
    show(on) {
      wrap.classList.toggle('show', !!on);
    },
  };
}
