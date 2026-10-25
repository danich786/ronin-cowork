import { ask } from './ask.js';
import { t } from './lexicon.js';
import { el } from './form-steps.js';

/** A birth fact in New Agent's ERABI grammar: selected, visible, and immutable. */
export function fixedBirthStone(key, label, value, word = '') {
  return ask([{ group: label, fields: [{ key, label, many: true, filter: false,
    options: value ? [{ v: value, l: value, off: word }] : [],
  }] }], { value: { [key]: value ? [value] : [] }, density: 'tight', exposed: true });
}

/** The canonical three-shelf Behaviour question shared by launch and Configuration. */
export function paintShelves(host, { rows = [], selected = [], onChange = () => {}, openBehaviours = null, reason = () => '', links = true } = {}) {
  const general = rows.filter((row) => row.scope === 'selected' && row.available === true && !row.installation);
  const automatic = rows.filter((row) => row.scope === 'floor');
  const conditional = rows.filter((row) => row.scope === 'conditional');
  const option = (item, availability = '') => ({
    v: item.name || '+', l: item.label || item.name,
    sub: typeof availability === 'object' && Object.hasOwn(availability, 'sub') ? availability.sub : item.blurb || '',
    ...(links ? { read: item.reading, view: item.name ? { name: item.name, scope: item.scope } : null } : {}),
    off: typeof availability === 'string' ? availability : availability.off || '',
    disabled: typeof availability === 'object' && availability.disabled === true,
  });
  const picker = ask([{ group: t('behaviours.available', 'Optional'), fields: [{
    key: 'behaviours', label: t('behaviours', 'Behaviours'), many: true, shape: 'tall', filter: false,
    options: [
      ...general.map((item) => option(item, item.required ? t('team_config.required', 'Required for each new Agent') : '')),
      ...(openBehaviours ? [{ v: '@customize', l: t('behaviours.customize', 'Customize Behaviors'), action: () => openBehaviours() }] : []),
    ],
  }] }], { value: { behaviours: selected }, density: 'tight', exposed: true, onChange: (value) => onChange([...value.behaviours]) });
  const readonly = (label, key, shelfRows, why) => ask([{ group: label, fields: [{ key, label, many: true, shape: 'tall', filter: false, options: shelfRows.map((item) => option(item, why(item))) }] }], { value: { [key]: [] }, className: 'na-behaviour-readonly', density: 'tight', exposed: true });
  const auto = readonly(`${t('behaviours.auto', 'All Cowork Agents')} (${t('behaviours.auto_included', 'All Ronin Agents include these')})`, 'automatic', automatic,
    () => ({ disabled: true, sub: '' }));
  const conditions = readonly(t('behaviours.conditional', 'Conditional'), 'conditional', conditional,
    (item) => ({ disabled: true, sub: reason(item) }));
  const autoSection = el('div', 'na-behaviour-section');
  autoSection.append(auto.el, el('p', 'na-behaviour-note', t('behaviours.bare_metal_excludes', 'Exclude by using a bare metal Agent.')));
  host.replaceChildren(picker.el, autoSection, conditions.el);
  return { value: () => picker.value().behaviours, destroy: () => { picker.destroy(); auto.destroy(); conditions.destroy(); } };
}
