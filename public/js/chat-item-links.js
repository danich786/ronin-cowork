/*
 * AN ITEM ID IN CHAT IS A LINK (owner, 19 Nov, KAN-698): "Let's do Agent Harness (KAN-680)" —
 * KAN-680 opens the tile's own item overlay (tilehead.js openItemOver), and its Close returns to
 * the chat where it was. Only ids the item store knows become links; anything else stays text.
 *
 * Known means: in the pushed Epics and their items (store.js `epics`, `epicItems`), else the item
 * read answers for it (a renamed id such as w806, or a Done item no longer pushed). One read per
 * id per page, only for an id-shaped word the push lacks.
 */
import { get } from './store.js';
import { request } from './request.js';

// The item store's ids (src/work-items.ts ID): w123, or a Jira key such as KAN-123.
const ID = /\b(w[1-9][0-9]*|[A-Z][A-Z0-9_]+-[1-9][0-9]*)\b/g;
const HAS_ID = new RegExp(ID.source); // a stateless test: the /g one carries lastIndex into matchAll
const read = new Map(); // id → Promise<item | null>

function pushed(id) {
  for (const list of [get('epics'), get('epicItems')]) {
    const hit = Array.isArray(list) ? list.find((item) => item?.id === id) : null;
    if (hit) return hit;
  }
  return null;
}

/** The item an id names, or null; from the push at once, else one read. */
export function knownItem(id) {
  const hit = pushed(id);
  if (hit) return hit;
  if (!read.has(id)) {
    read.set(id, request(`/api/work-items/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then((r) => (r.ok && r.data?.item?.id ? r.data.item : null), () => null));
  }
  return read.get(id);
}

function link(doc, id, item, open) {
  const a = doc.createElement('a');
  a.className = 'chat-item-link';
  a.href = '#';
  a.dataset.item = item.id;
  a.textContent = id;
  a.title = item.title || item.id;
  a.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (a.getAttribute('aria-busy') === 'true') return;
    a.setAttribute('aria-busy', 'true'); // the press answers at once; the overlay follows
    Promise.resolve(open(item)).finally(() => a.removeAttribute('aria-busy'));
  });
  return a;
}

/** Turns each known item id in `entry`'s text into a link that calls `open(item)`. Returns entry. */
export function linkItemIds(entry, open) {
  const doc = entry?.ownerDocument || globalThis.document;
  if (!open || !doc?.createTreeWalker) return entry;
  const walker = doc.createTreeWalker(entry, 4 /* NodeFilter.SHOW_TEXT */);
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('a, button, pre')) continue;
    if (HAS_ID.test(node.nodeValue)) nodes.push(node);
  }
  for (const node of nodes) {
    const text = node.nodeValue;
    const ids = [...new Set([...text.matchAll(ID)].map((m) => m[1]))];
    void Promise.all(ids.map((id) => knownItem(id))).then((items) => {
      const known = new Map(ids.map((id, i) => [id, items[i]]).filter(([, item]) => item));
      if (!known.size || !node.parentNode) return;
      const frag = doc.createDocumentFragment();
      let at = 0;
      for (const m of text.matchAll(ID)) {
        const item = known.get(m[1]);
        if (!item) continue;
        frag.append(text.slice(at, m.index), link(doc, m[1], item, open));
        at = m.index + m[1].length;
      }
      frag.append(text.slice(at));
      node.replaceWith(frag);
    });
  }
  return entry;
}
