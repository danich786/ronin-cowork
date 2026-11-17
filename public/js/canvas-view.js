/* part of the ronin-cowork client — see js/README.md */
/**
 * A CANVAS ON THE WORKSURFACE (KAN-626; src/canvases.ts). Pressing a canvas's name opens it over
 * the surface it was pressed on, read fresh from GET /api/canvases/read (the reading `canvas read`
 * prints) and painted: a heading per block, its cards in a grid (KAN-630), other lines as a list,
 * links pressable. × puts the surface back as it was. Nothing is kept: every press reads again.
 */
import { request } from './request.js';
import { t } from './lexicon.js';
import { renderMarkdownDocument } from './markdown-reader.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

/** A line from a reading as Markdown: its URLs as links; a `*` that marks the Workspace's own site
 * is a star, so the reader never takes it for emphasis. */
const mdLine = (line) => String(line).trim().replace(/\*/g, '★').replace(/\bhttps?:\/\/[^\s)]+/g, (url) => `[${url}](${url})`);

/** A card (KAN-630): its title, then each row: its words, a quieter detail line, what is wrong
 * with it, and its short-named links. The lead row (KAN-631) is the one to look at first: larger,
 * its first link a button. */
function paintCard(card) {
  const box = el('section', 'canvas-card');
  box.append(el('h4', 'canvas-card-title', card.title));
  for (const row of card.rows || []) {
    const line = el('div', row.lead ? 'canvas-card-row canvas-card-lead' : 'canvas-card-row');
    if (row.text) line.append(el('p', 'canvas-card-text', row.text));
    if (row.detail) line.append(el('p', 'canvas-card-detail', row.detail));
    if (row.warn) line.append(el('p', 'canvas-card-warn', row.warn));
    const links = row.links || [];
    if (links.length) {
      const bar = el('p', 'canvas-card-links');
      links.forEach((link, n) => {
        const a = el('a', row.lead && n === 0 ? 'wk-action canvas-card-open' : 'canvas-card-link', link.text);
        a.href = link.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        bar.append(a);
      });
      line.append(bar);
    }
    box.append(line);
  }
  return box;
}

/** The reading painted: a heading per block; its cards in a grid, its other lines as a list. */
export function paintReading(c) {
  const doc = el('article', 'canvas-reading');
  doc.append(el('h2', 'canvas-title', c.title), el('p', 'canvas-meta', `Workspace ${c.workspace} · from ${c.template || 'no template'} · made ${c.date} by ${c.by}`));
  for (const b of c.blocks) {
    if (!b.shown) continue;
    const block = el('section', 'canvas-block');
    block.append(el('h3', 'canvas-block-title', b.name));
    // A typed entry is a card like the rest: its name, its line, who wrote it and when.
    const typed = b.entries.map((e) => ({ title: e.name, rows: [{ text: e.line, detail: [e.by, e.at].filter(Boolean).join(' · ') }] }));
    const cards = [...b.reads.flatMap((r) => r.cards || []), ...(b.cards || []), ...typed];
    if (cards.length) { const grid = el('div', 'canvas-cards'); grid.append(...cards.map(paintCard)); block.append(grid); }
    const lines = [
      ...b.lines.map(mdLine),
      ...(b.unavailable ? [`No reading: ${b.unavailable}`] : []),
      ...b.reads.flatMap((r) => r.lines.map(mdLine)),
    ];
    if (lines.length) block.append(renderMarkdownDocument(lines.map((l) => `- ${l}`).join('\n')));
    doc.append(block);
  }
  return doc;
}

/** Open `name`, a canvas of Workspace `workspace`, over `host`, else the surface that holds `from`. */
export async function openCanvas(from, workspace, name, host = null) {
  const surface = host || from.closest('.wk-surface-content') || from.parentElement;
  if (!surface) return;
  surface.querySelector(':scope > .canvas-view')?.remove();
  // Set aside, not `hidden`: a surface's own CSS may show a hidden child (the stone rail does).
  const kept = [...surface.children].map((child) => [child, child.style.display]);
  for (const [child] of kept) child.style.display = 'none';
  const view = el('div', 'canvas-view');
  const head = el('div', 'canvas-view-head');
  const close = el('button', 'canvas-view-close', '×'); close.type = 'button';
  close.title = t('canvas.close', 'Close the canvas');
  close.addEventListener('click', () => { view.remove(); for (const [child, was] of kept) child.style.display = was; });
  head.append(close);
  const body = el('div', 'canvas-view-body');
  view.append(head, body);
  surface.append(view);
  await paintCanvas(body, workspace, name);
}

/** Read `name` of `workspace` now and paint it into `into`: "Reading…" at once, then the canvas. */
export async function paintCanvas(into, workspace, name) {
  into.replaceChildren(el('p', 'fs-step-help', t('canvas.reading', 'Reading {name}: Netlify, repos, work items…', { name })));
  const query = new URLSearchParams({ workspace, name });
  const r = await request(`/api/canvases/read?${query}`, { cache: 'no-store' });
  if (!into.isConnected) return;
  if (!r.ok || !r.data?.canvas) { into.replaceChildren(el('p', 'fs-step-help', r.message || t('canvas.unread', 'The canvas could not be read.'))); return; }
  into.replaceChildren(paintReading(r.data.canvas));
}
