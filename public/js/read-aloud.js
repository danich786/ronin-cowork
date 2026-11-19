/* part of the ronin-cowork client — see js/README.md */
/**
 * READ ALOUD (KAN-705): the tile's speaker plays the Agent's last reply. Services' KOE part
 * owns the call (POST /api/koe/speak {session}: it reads the reply and asks the office's
 * gateway for speech); this is only the button. Shown in a hosted office with KOE loaded,
 * nowhere else. Every press answers: idle → fetching → playing; a press while fetching or
 * playing stops. One voice at a time: a new press stops whatever was playing.
 */
import { S } from './state.js';
import { HOSTED } from './hosted.js';
import { toast } from './ui.js';
import { t } from './lexicon.js';

const GLYPH = { idle: '🔊', fetching: '…', playing: '■' };
let current = null; // { el, controller, audio, url }

/** The office runs KOE's read aloud: hosted, with the koe part loaded. */
export const readAloudShown = () => HOSTED && Array.isArray(S.services) && S.services.includes('koe');

function paint(el, state) {
  el.dataset.state = state;
  el.textContent = GLYPH[state];
  el.setAttribute('aria-pressed', String(state !== 'idle'));
  el.title = state === 'idle' ? t('koe.speak_help', 'Read the last reply aloud')
    : t('koe.speak_stop', 'Stop reading aloud');
}

function stop() {
  if (!current) return;
  const { el, controller, audio, url } = current;
  current = null;
  controller.abort();
  if (audio) { audio.pause(); audio.removeAttribute('src'); }
  if (url) URL.revokeObjectURL(url);
  paint(el, 'idle');
}

/** The button's press. */
export async function toggleReadAloud(session, el) {
  const mine = current?.el === el;
  stop();
  if (mine || !session) return;
  const mark = { el, controller: new AbortController(), audio: null, url: '' };
  current = mark;
  paint(el, 'fetching');
  try {
    const res = await fetch('/api/koe/speak', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session }), signal: mark.controller.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || t('koe.speak_failed', 'Read aloud failed ({status}).', { status: res.status }));
    }
    const blob = await res.blob();
    if (current !== mark) return;
    mark.url = URL.createObjectURL(blob);
    mark.audio = new Audio(mark.url);
    mark.audio.addEventListener('ended', () => { if (current === mark) stop(); });
    await mark.audio.play();
    paint(el, 'playing');
  } catch (e) {
    if (current !== mark) return; // stopped by a press: that was the answer
    stop();
    toast(String(e?.message || e), false);
  }
}

/** A fresh button, idle. */
export function speakButton(el) { paint(el, 'idle'); return el; }
