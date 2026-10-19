/* part of the ronin-cowork client — see js/README.md */
import { t } from './lexicon.js';

const el = (tag, cls, text) => {
  const out = document.createElement(tag);
  if (cls) out.className = cls;
  if (text != null) out.textContent = String(text);
  return out;
};

/** One choice: its name and pills on the left, what it does on the right. */
export const choice = (name, options, current, why, onPick) => {
  const row = el('div', 'cv-choice');
  const left = el('div', 'cv-choice-pick');
  left.append(el('span', 'cv-choice-name', name));
  const pills = el('div', 'cv-pills');
  for (const o of options) {
    const b = el('button', 'cv-pill', o.label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(o.value === current));
    if (o.services) { b.disabled = true; b.append(el('small', 'cv-pill-tag', t('campaign_view.with_services', 'Ronin Services'))); b.title = t('campaign_view.services_title', 'Arrives with Ronin Services.'); }
    // The row marks its own pick in place — callers stage drafts and must not need a
    // whole-surface repaint just to show which pill is down.
    if (onPick && !o.services) b.addEventListener('click', () => { for (const sib of pills.children) sib.setAttribute('aria-pressed', String(sib === b)); onPick(o.value); });
    if (!onPick) b.disabled = true;
    pills.append(b);
  }
  left.append(pills);
  row.append(left, el('p', 'cv-choice-why', why));
  return row;
};
