/* part of the ronin-cowork client — see js/README.md */
/**
 * SAVE ROW — the Grey form's one factory: a row that saves itself (PATTERNS.md, Grey form).
 * Machine settings and the Desk identity fields draw with it; configuration surfaces build on it.
 *
 * A row is a label, a control and a status line. `commit(value)` says saving…, runs
 * `save(value)`, then says saved or the refusal beside the field; `after(result)` runs once a
 * save lands (a re-read: the record, not the value typed, says what a save produced).
 *
 *   control   an input or select: drawn as a labelled field whose own line is the status;
 *             leaving it (`change`) commits.
 *   question  an element that already carries its label (an ask() question): drawn with a
 *             status line under it, starting at `note`; the question's onChange calls `commit`.
 *   say       a status line the caller already draws, as (state, message) with state
 *             pending | valid | invalid: nothing is drawn and `el` is null.
 */
import { field } from './ui.js';
import { t } from './lexicon.js';

export function saveRow({ label = '', control = null, question = null, note = '', say = null, save, after = null }) {
  let el = null;
  if (!say && question) {
    el = document.createElement('div');
    el.className = 'st-row';
    const line = document.createElement('p');
    line.className = 'st-note';
    line.setAttribute('role', 'status');
    line.textContent = note;
    el.append(question, line);
    say = (state, message) => { line.textContent = message; line.classList.toggle('bad', state === 'invalid'); };
  } else if (!say && control) {
    el = document.createElement('div');
    el.className = 'st-row';
    const f = field(control, { label, sr: false });
    f.el.classList.add('st-field');
    if (note) f.say(note);
    el.append(f.el);
    say = (state, message) => f.say(message, state === 'invalid');
  }
  const commit = async (value) => {
    say('pending', t('settei.saving', 'saving…'));
    const result = await save(value);
    if (!result.ok) return say('invalid', result.message);
    say('valid', t('settei.saved', 'saved'));
    await after?.(result);
  };
  if (control && el) control.addEventListener('change', () => void commit(control.value));
  return { el, commit, say };
}
