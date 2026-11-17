/* part of the ronin-cowork client — see js/README.md */
/**
 * A CANVAS ON THE WORKSURFACE (KAN-626; src/canvases.ts). Pressing a canvas's name opens it over
 * the surface it was pressed on, read fresh from GET /api/canvases/read (the reading `canvas read`
 * prints) and painted as a document with the markdown reader: a heading per block, one line per
 * entry, links pressable. × puts the surface back as it was. Nothing is kept: every press reads again.
 */
import { request } from './request.js';
import { t } from './lexicon.js';
import { renderMarkdownDocument } from './markdown-reader.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

/** A line from a reading as Markdown: its URLs as links; a `*` that marks the Workspace's own site
 * is a star, so the reader never takes it for emphasis. */
const mdLine = (line) => String(line).trim().replace(/\*/g, '★').replace(/\bhttps?:\/\/[^\s)]+/g, (url) => `[${url}](${url})`);

/** The reading as the document the reader paints. Exported for the tests. */
export function canvasMarkdown(c) {
  const out = [`# ${c.title}`, '', `Workspace ${c.workspace} · from ${c.template || 'no template'} · made ${c.date} by ${c.by}`, ''];
  const hidden = [];
  for (const b of c.blocks) {
    if (!b.shown) { hidden.push(b.name); continue; }
    out.push(`## ${b.name}`, '');
    if (b.holds) out.push(`*${b.holds.replace(/\*/g, '')}*`, '');
    const lines = [
      ...b.lines.map(mdLine),
      ...(b.unavailable ? [`No reading: ${b.unavailable}`] : []),
      ...b.reads.flatMap((r) => r.lines.map(mdLine)),
      ...b.entries.map((e) => `**${e.name}**: ${mdLine(e.line)} (${e.by || '?'}, ${e.at || '?'})`),
    ];
    out.push(...lines.map((l) => `- ${l}`), '');
  }
  if (hidden.length) out.push(`Not here, nothing in them: ${hidden.join(', ')}.`);
  return out.join('\n');
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
  into.replaceChildren(renderMarkdownDocument(canvasMarkdown(r.data.canvas)));
}
