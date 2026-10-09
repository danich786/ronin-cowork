/* part of the ronin-cowork client — see js/README.md */
/**
 * NEW — the fourth Collections card (owner, 2026-10-08: Who, What, Where, New). One question,
 * the kind (ask.js): Work item, Board, Agent, Team. The answer mounts the existing form for
 * that kind, unchanged: Add's form (work-details.js draftItem), the same form started on New
 * board, New Agent and New Team as Setup's "Launch your own" mounts them. Nothing else is drawn.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { ask } from './ask.js';
import { draftItem, NEW_BOARD } from './work-details.js';
import { createEmbeddedNewAgentView } from './new-agent.js';
import { createEmbeddedNewTeamFormView } from './new-team-form.js';
import { request } from './request.js';
import { subscribeCollection } from './collection-reading.js';
import { t } from './lexicon.js';

export const COLLECTION_NEW_TYPE = 'collection.new';

export function createCollectionNewSurface() {
  const { createSurface, createAction } = WorkspaceKit.primitives;
  const surface = createSurface({ label: t('collection.new', 'New'), className: 'collection-new' });
  const host = document.createElement('div');
  host.className = 'collection-new-form';
  let unmount = () => {};
  // The boards Add's form offers, off the collection reading this card holds (owner,
  // 2026-10-09: one reading per tenant); a form takes the boards held when it mounts.
  let boards = [];
  const stop = subscribeCollection({}, (reading) => { boards = reading?.boards || []; });

  // Add's form, as draftOverlay saves it: a made item clears the form for the next.
  const item = (heading, parent) => {
    let form = null;
    const save = createAction({ label: t('work_overlay.save', 'Save'), size: 'compact', action: () => void form.submit() });
    form = draftItem(host, { heading, parent, boards, actions: [save], save: async (fields) => {
      const made = await request('/api/work-items', { method: 'POST', json: fields });
      if (!made.ok) return made.message;
      mount(kind.value().kind);
      return '';
    } });
    return () => {};
  };
  const launch = (view) => {
    host.append(view.el);
    void view.enter({});
    return () => { view.destroy?.(); };
  };
  const FORMS = {
    item: () => item(t('work.draft', 'New item'), ''),
    board: () => item(t('work_nav.draft_new_board', 'New board'), NEW_BOARD),
    agent: () => launch(createEmbeddedNewAgentView(WorkspaceKit, {})),
    team: () => launch(createEmbeddedNewTeamFormView(WorkspaceKit, {})),
  };
  const mount = (chosen) => {
    unmount();
    host.replaceChildren();
    unmount = FORMS[chosen]();
  };

  const kind = ask([{ fields: [
    { key: 'kind', label: t('collection.new_kind', 'New'), options: [
      { v: 'item', l: t('collection.new_item', 'Work item') },
      { v: 'board', l: t('collection.new_board', 'Board') },
      { v: 'agent', l: t('agent', 'Agent') },
      { v: 'team', l: t('team', 'Team') },
    ] },
  ] }], { value: { kind: 'item' }, density: 'tight', onChange: ({ kind: chosen }) => mount(chosen) });
  surface.content.append(kind.el, host);
  mount('item');

  return {
    el: surface.el,
    destroy: () => { stop(); unmount(); kind.destroy(); },
  };
}
