/* The canonical work item reading, shared by Task Manager and Work Items. */
import { t } from './lexicon.js';

const node = (tag, cls, text) => {
  const out = document.createElement(tag);
  if (cls) out.className = cls;
  if (text != null) out.textContent = String(text);
  return out;
};

export function appendProjectReading(host, project, { holder, stage, prefix = 'wi' }) {
  host.append(node('h2', '', project.title), node('p', `${prefix}-project-id`, project.id), node('p', `${prefix}-outcome`, project.objective));
  const facts = node('dl', `${prefix}-project-facts`);
  for (const [label, value] of [
    [t('team_kanban.stage', 'Status'), `${stage}${project.flagged ? ` · ⚑ ${t('team_kanban.flagged', 'flagged')}` : ''}`],
    [t('team_kanban.holder', 'Holder'), holder ? `@${holder}` : t('team_kanban.nobody', 'nobody')],
    [t('team_kanban.parent', 'Parent'), project.parent || t('team_kanban.no_parent', 'no parent')],
  ]) facts.append(node('dt', '', label), node('dd', '', value));
  host.append(facts);
  if (project.evidence.length) host.append(node('h3', '', t('team_kanban.evidence', 'Evidence')), node('p', `${prefix}-evidence`, project.evidence.join(' · ')));
}
