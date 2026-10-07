/* part of the ronin-cowork client — see js/README.md */
/**
 * THE COLLECTION PHALANX — the phalanx forked for the collection doors (Who, What, Where;
 * owner ruling 2026-10-03), built ON createPhalanx: the same stones, rail, detail and one way
 * back, nothing copied. What the fork adds is the look of a collection at rest: each stone's
 * children stacked under it as one-line bars a space below it, the blocks centred at wide
 * spacing, and grandchildren folded away. Children and grandchildren are not stones: a bar
 * with a hairline, distinct but light (owner: the stone format on everything is too heavy;
 * never count what is visible).
 *
 * A BAR PRESSED IS THE CONSUMER'S (owner, 2026-10-07: a bar opens its read in a partial
 * overlay hung off the bar; this replaced the expand in place). The fork stops the phalanx's
 * own press on a nested bar and calls `press(item, bar)`; it never selects or goes a level
 * down. The fork marks each nested item's depth (`data-cph-depth`) through the phalanx's own
 * `attrs`; its root wears `.cph` and its host `.cph-host`, and every one of its rules lives
 * under that prefix, so the phalanx's own consumers (Settings, Presets, Workspace Folders,
 * Model Providers, Team Chart) see none of it.
 */
import { createPhalanx } from './phalanx.js';

/** The same rows with each nested item's depth on it: a child is 1, a grandchild 2, and so on. */
export const markDepth = (items, depth = 0) => (items || []).map((item) => ({
  ...item,
  ...(depth > 0 ? { attrs: { ...(item.attrs || {}), 'data-cph-depth': String(depth) } } : {}),
  ...(Array.isArray(item.items) ? { items: markDepth(item.items, depth + 1) } : {}),
}));

export function createCollectionPhalanx({ className = '', branches = 'column', items = [], press = null, ...options } = {}) {
  /** Every nested row presses to the consumer, not to select or go down. */
  const pressable = (rows, depth = 0) => rows.map((row) => ({
    ...row,
    ...(depth > 0 && press ? { events: { ...(row.events || {}), click: (event, item) => {
      event.stopImmediatePropagation();
      event.preventDefault();
      row.events?.click?.(event, item);
      press(item, event.currentTarget);
    } } } : {}),
    ...(Array.isArray(row.items) ? { items: pressable(row.items, depth + 1) } : {}),
  }));
  const phalanx = createPhalanx({ ...options, branches, items: markDepth(pressable(items)), className: `cph ${className}`.trim() });
  const { mount, setItems } = phalanx;
  phalanx.mount = (host, placement) => {
    mount.call(phalanx, host, placement);
    if (!String(host.className || '').split(/\s+/).includes('cph-host')) host.className = `${host.className || ''} cph-host`.trim();
    return phalanx;
  };
  phalanx.setItems = (next) => { setItems.call(phalanx, markDepth(pressable(next))); return phalanx; };
  /** Folded, the grandchildren under each child stay out of the rest view; the rail always has them. */
  phalanx.setFold = (on = true) => { phalanx.el.dataset.cphFold = String(Boolean(on)); return phalanx; };
  phalanx.setFold(true);
  return phalanx;
}
