/* part of the ronin-cowork client — see js/README.md */
/**
 * THE HELP OUTLINE (owner, 2026-10-21; 2026-10-24): Workspace 1 of the Help workbench. The pages are
 * the user docs in docs/, read through the same door Setup's guides use (/api/file?product=1),
 * never copies. The header leads with what Ronin is for (one line on a phone); then 'START HERE:
 * 4 things you need to know', the four numbered 1-4, each opening to Return and its page as a Team's
 * stone does, then Getting started and Using Ronin as two stones that open to their pages (the
 * phalanx's levels). Mika in Workspace 2 answers what no page
 * does. One stone surface: press a page, the stones go to the rail and the page reads beside them;
 * a link to another guide opens that guide in the same place. Every page stone drags into a
 * workspace, where it reads whole (createHelpPage).
 */
import { WorkspaceKit } from './workspace-kit.js';
import { createPhalanx } from './phalanx.js';
import { request } from './request.js';
import { renderMarkdownDocument } from './markdown-reader.js';
import { localDocumentLink, productRepositoryHref } from './document-links.js';
import { SURFACE_DRAG } from './workbench.js';
import { t } from './lexicon.js';

export const HELP_PAGE_TYPE = 'help.page';

const el = (tag, cls, text) => { const out = document.createElement(tag); if (cls) out.className = cls; if (text != null) out.textContent = text; return out; };

/** A page stone that can be dragged into a workspace: the drop reads that page there. */
const draggable = (row) => ({
  ...row,
  draggable: true,
  events: { dragstart: (event) => {
    event.dataTransfer.setData(SURFACE_DRAG, JSON.stringify({ type: HELP_PAGE_TYPE, detail: { key: row.path } }));
    event.dataTransfer.setData('text/plain', row.label);
    event.dataTransfer.effectAllowed = 'copy';
  } },
});

/** The outline: each page is a doc path, in the order a new user meets them. */
function PAGES() {
  const four = { id: 'four', label: t('help_outline.start_here', 'Start here:'), secondary: t('help_outline.four', '4 things you need to know') };
  const more = { id: 'more', label: t('help_outline.more', 'Everything else') };
  // Each of the four is a level of its own, as a Team's stone is: pressed, Return and its page.
  const first = (n, path, label) => draggable({ id: path, group: four, label, path, items: [], glyph: String(n), className: 'help-outline-first' });
  const page = (path, label) => draggable({ id: path, label, path });
  // A shelf opens on its first page, pressed, so the page being read is always the stone that shows it.
  const shelf = (id, label, items) => ({ id, group: more, label, items, action: (row, api) => api.down(row.id, { select: row.items[0].id }) });
  return [
    first(1, 'docs/using-ronin/team-lead-and-edges.md', t('help_outline.lead', 'Team Lead and edges')),
    first(2, 'docs/using-ronin/what-agents-write-down.md', t('help_outline.records', 'Work records')),
    first(3, 'docs/using-ronin/agent-tools.md', t('help_outline.tools', 'Tools')),
    first(4, 'docs/getting-started/customize.md', t('help_outline.customize', 'Customizing your Ronin')),
    shelf('start', t('help_outline.start', 'Getting started'), [
      page('docs/getting-started/get-started.md', t('help_outline.get_started', 'Get started')),
      page('docs/getting-started/setup-workbench.md', t('help_outline.setup', 'Ronin Setup')),
      page('docs/getting-started/provider-sign-in.md', t('help_outline.sign_in', 'Provider sign-in')),
      page('docs/getting-started/workspace-folders.md', t('help_outline.folders', 'Workspace Folders')),
      page('docs/getting-started/services-activation.md', t('help_outline.services', 'Ronin Services')),
    ]),
    shelf('using', t('help_outline.using', 'Using Ronin'), [
      page('docs/using-ronin/workbench.md', t('help_outline.workbench', 'Workbench')),
      page('docs/using-ronin/tile.md', t('help_outline.tile', 'The tile')),
      page('docs/using-ronin/terminal-controls.md', t('help_outline.controls', 'Terminal controls')),
      page('docs/using-ronin/new-team.md', t('help_outline.new_team', 'New Team')),
      page('docs/using-ronin/share-a-file.md', t('help_outline.share', 'Share a file')),
      page('docs/using-ronin/work-items.md', t('help_outline.work_items', 'Work items')),
      page('docs/using-ronin/wipeboards.md', t('help_outline.wipeboards', 'Wipeboards')),
      page('docs/using-ronin/desks.md', t('help_outline.desks', 'Managed worktrees')),
      page('docs/using-ronin/archived-sessions.md', t('help_outline.archived', 'Archived sessions')),
      page('docs/using-ronin/feedback.md', t('help_outline.feedback', 'Feedback')),
    ]),
  ];
}

/** Read one page into `host`; `onLink` opens a linked guide. Returns the article. */
function readPage(item, host, onLink) {
  const page = el('article', 'help-outline-page', t('docs.loading', 'loading…'));
  host.append(page);
  void request('/api/file?' + new URLSearchParams({ path: item.path, product: '1' }).toString()).then((result) => {
    if (!page.isConnected) return;
    if (!result.ok) { page.textContent = result.message; return; }
    page.replaceChildren(renderMarkdownDocument(result.data.text || '', document, {
      resolveHref: (href) => productRepositoryHref(item.path, href),
      onLink: (href) => {
        const linked = localDocumentLink(item.path, href, true);
        if (!linked) return false;
        onLink(linked.path, linked.fragment);
        return true;
      },
    }));
    if (item.fragment) page.querySelector(`[id="${CSS.escape(item.fragment)}"]`)?.scrollIntoView?.({ block: 'start' });
  });
  return page;
}

/** Every page of the outline, wherever it sits, with the shelf it sits on. */
const allPages = (rows) => rows.flatMap((row) => row.items?.length ? row.items.map((item) => ({ item, shelf: row })) : [{ item: row, shelf: null }]);

/** `onRead(label)` hears each page the outline reads: a pressed stone or a followed link. */
export function createHelpOutline({ onRead = () => {} } = {}) {
  const out = WorkspaceKit.primitives.createSurface({ label: t('help_outline.title', 'Help'), className: 'help-outline' });
  const pages = PAGES();
  const open = (path, fragment = '') => {
    const found = allPages(pages).find(({ item }) => item.path === path);
    if (!found || fragment) { stones.openDetail({ ...(found?.item || { id: path, label: path.split('/').pop(), path }), fragment }); return; }
    const at = stones.level();
    if (found.shelf && at?.id === found.shelf.id) stones.select(path);
    else if (found.shelf) { if (at) stones.top(); stones.down(found.shelf.id, { select: path }); }
    else if (at?.id !== path) { if (at) stones.top(); stones.down(path); }
  };
  const stones = createPhalanx({
    items: pages, className: 'help-outline-stones', grouped: { groups: [...new Map(pages.map((item) => [item.group.id, item.group])).values()] },
    renderDetail: (item, host) => {
      host.scrollTop = 0;
      const page = item.items?.length ? item.items[0] : item; // a shelf whose page was pressed off still reads its first
      readPage(page, host, open);
      onRead(page.label);
    },
  });
  const intro = el('div', 'sws-intro help-outline-intro');
  intro.append(
    el('h2', '', t('help_outline.headline', 'Launch and go. Work across model providers. Simple Ronin tools facilitate agent coworking.')),
    el('p', '', t('help_outline.lead_line', 'Your Agents and accounts run remote, you access from browser on your computer or phone.')),
  );
  stones.mount(out.content, { before: [intro] });
  return { el: out.el, destroy: () => stones.destroy() };
}

/** One help page whole in a workspace, placed by a dragged stone; a link reads the linked guide here. */
export function createHelpPage(path) {
  const { createSurface } = WorkspaceKit.primitives;
  const label = (target) => allPages(PAGES()).find(({ item }) => item.path === target)?.item.label || target.split('/').pop();
  const out = createSurface({ label: label(path), className: 'help-page' });
  const show = (target, fragment = '') => {
    out.header.title.textContent = label(target);
    out.content.replaceChildren();
    out.content.scrollTop = 0;
    readPage({ path: target, fragment }, out.content, show);
  };
  show(path);
  return { el: out.el };
}
