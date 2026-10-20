/* part of the ronin-cowork client — see js/README.md */
/**
 * THE MODELS WORKBENCH'S SURFACES (owner, 2026-10-19; PATTERNS.md Home). Home's Models door
 * opens the Models workbench; its surfaces are its own, apart from Settings' Model Providers
 * surface, and draw with the same drawing (provider-surface.js: createProviderDrawing, the
 * provider's page; providerStones, the stones) over the same reads.
 *   WS1 `createModelStones`: Phalanx A/B stones of providers. A stone pressed opens the
 *   provider's page beside the rail; a stone dragged into a workspace places the provider
 *   there whole (`createModelProvider`), no rail, the whole workspace to its page.
 *   The selector lists one card per provider (`providerOffers`), each placing that surface.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { el } from './form-steps.js';
import { createPhalanx } from './phalanx.js';
import { createProviderDrawing, createRefreshAll, providerStones, recordRuntime } from './provider-surface.js';
import { SURFACE_DRAG } from './workbench.js';
import { WORKBENCH_TYPES } from './workbench-catalog.js';
import { t } from './lexicon.js';

/** The selector's cards: one per provider, from the record every reader takes. */
export const providerOffers = () => providerStones(recordRuntime()).map(({ id, label, secondary }) => ({ key: id, label, summary: secondary }));

/** A stone that can be dragged into a workspace: the drop places the provider there. */
const draggable = (stone) => ({
  ...stone,
  draggable: true,
  events: { dragstart: (event) => {
    event.dataTransfer.setData(SURFACE_DRAG, JSON.stringify({ type: WORKBENCH_TYPES.modelProvider, detail: { key: stone.id } }));
    event.dataTransfer.setData('text/plain', stone.label);
    event.dataTransfer.effectAllowed = 'copy';
  } },
});

/** WS1: the stones of providers; the pressed one's page beside the rail. */
export function createModelStones(context) {
  const { createSurface } = WorkspaceKit.primitives;
  const out = createSurface({ label: t('setup_surface.providers', 'Model providers'), className: 'setup-surface setup-provider-surface models-stones' });
  const notice = el('p', 'setup-fine setup-provider-notice'); notice.hidden = true;
  const say = (text, bad = false) => { notice.className = `${bad ? 'setup-notice bad' : 'setup-fine'} setup-provider-notice`; notice.textContent = text; notice.hidden = !text; };
  const drawing = createProviderDrawing(context, { repaint: () => repaint(), say });
  const stones = createPhalanx({
    className: 'setup-provider-stones',
    renderDetail: (item, host) => drawing.paintProvider(item.id, host),
    onSelectionChange: (id) => { if (!id) drawing.closed(); },
  });
  stones.mount(out.content, { after: [notice] });
  const repaint = () => {
    context.workbench?.refreshSelector?.();
    const items = drawing.stones();
    say(items.length ? '' : t('setup_surface.no_catalog', 'No model providers are in the catalog on this machine.'));
    stones.setItems(items.map(draggable));
  };
  return {
    el: out.el,
    show: async () => { await drawing.showRecord(); },
    destroy: () => { drawing.destroy(); stones.destroy(); },
  };
}

/** The Model refresh surface (owner, 2026-10-20): the Refresh all control Settings' provider
 *  surface carries, over the same drawing, with its last-ran line and notice. The Models stones
 *  carry no refresh door; this card does. */
export function createModelRefresh(context) {
  const { createSurface } = WorkspaceKit.primitives;
  const out = createSurface({ label: t('models.refresh', 'Model refresh'), className: 'setup-surface models-refresh' });
  const notice = el('p', 'setup-fine setup-provider-notice'); notice.hidden = true;
  const say = (text, bad = false) => { notice.className = `${bad ? 'setup-notice bad' : 'setup-fine'} setup-provider-notice`; notice.textContent = text; notice.hidden = !text; };
  const drawing = createProviderDrawing(context, { repaint: () => repaint(), say });
  const refresh = createRefreshAll(drawing);
  // The slot under the control is model_catalog's: the models.dev update waiting, its diff,
  // Accept / Discard / Ask Mika to check (owner, 2026-10-20). Empty until then.
  const update = el('div', 'models-refresh-update');
  out.content.append(refresh.el, notice, update);
  const repaint = () => { refresh.paint(); context.workbench?.refreshSelector?.(); };
  return {
    el: out.el,
    show: async () => { await drawing.showRecord(); },
    destroy: () => { drawing.destroy(); },
  };
}

/** A workspace of its own for one provider: its page, the whole workspace, no rail. */
export function createModelProvider(key, context) {
  const { createSurface } = WorkspaceKit.primitives;
  const out = createSurface({ label: key, className: 'setup-surface models-provider' });
  const notice = el('p', 'setup-fine setup-provider-notice'); notice.hidden = true;
  const say = (text, bad = false) => { notice.className = `${bad ? 'setup-notice bad' : 'setup-fine'} setup-provider-notice`; notice.textContent = text; notice.hidden = !text; };
  const page = el('div', 'models-provider-page');
  out.content.append(page, notice);
  let dispose = null;
  const drawing = createProviderDrawing(context, { repaint: () => repaint(), say });
  const repaint = () => {
    dispose?.(); dispose = null;
    page.replaceChildren();
    out.header.title.textContent = drawing.stones().find((stone) => stone.id === key)?.label || key;
    dispose = drawing.paintProvider(key, page);
  };
  return {
    el: out.el,
    show: async () => { await drawing.showRecord(); },
    destroy: () => { dispose?.(); drawing.destroy(); },
  };
}
