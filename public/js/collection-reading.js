/* part of the ronin-cowork client — see js/README.md */
/**
 * THE TENANT'S READING — one seam between the new tenants and the server's readings: the
 * collection (Teams, boards with their items, and workspace folders; src/collection-read.ts),
 * narrowed by campaign, team, board, root or stage. The server resolves the tenant and
 * pushes the reading into the store, whole, on the want and on every change (w12, src/ws/
 * events.ts); the browser requests, filters and joins nothing (owner, 2026-10-06).
 *
 * A consumer subscribes with its filter and hears the reading now, if held, and each change;
 * it unsubscribes when it leaves. Nothing in the new tenants may call /api/collection or
 * /api/work-items.
 */
import { store, readingKey } from './store.js';

/** Hear the collection reading for a filter: `{ teams, boards, roots }`. Returns the unsubscribe. */
export function subscribeCollection(filter, listener) {
  return store.subscribe(readingKey('collection', filter), listener);
}

/** The store key a filter reads under, the server's spelling, for a consumer that remembers which reading it holds. */
export { readingKey };
