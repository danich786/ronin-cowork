/* part of the ronin-cowork client — see js/README.md */
/**
 * THE COLLECTION DRAG — one payload for anything dragged on a collection door, wherever it
 * is dragged from (owner, 2026-10-08: a board stone from What onto a Team stone on Who in the
 * other workspace is the same drop as Who's own board bar). `{ kind, id, team?, board? }`:
 * what is dragged, and the Team or board it was under. One type on the transfer, so a Team
 * stone on Who and a board stone on What each read the same thing and their rules
 * (`whoMove`, `whatMove`) say what it means there.
 */
export const COLLECTION_DRAG = 'application/x-ronin-collection';

/** Put the payload on the transfer. */
export function carry(dataTransfer, payload, effect = 'move') {
  dataTransfer.setData(COLLECTION_DRAG, JSON.stringify(payload));
  dataTransfer.effectAllowed = effect;
}
/** True while something ours is over the target (the data itself is hidden until the drop). */
export const carries = (event) => Boolean(event.dataTransfer?.types?.includes(COLLECTION_DRAG));
/** The payload at the drop, or null. */
export function carried(event) {
  try { return JSON.parse(event.dataTransfer?.getData(COLLECTION_DRAG) || 'null'); } catch { return null; }
}
