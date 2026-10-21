/* part of the ronin-cowork client — see js/README.md */
/**
 * THE HELP OUTLINE (owner, 2026-10-21): Workspace 1 of the Help workbench. The pages are the
 * user docs in docs/, read through the same door Setup's guides use (/api/file?product=1),
 * never copies. Two lists (owner, 2026-10-21): 'Start here', the four things numbered 1-4 and
 * the only emphasised part, then 'Everything else', quieter rows grouped for specific questions
 * (an FAQ group joins as it grows); Mika in Workspace 2 answers what no page does. One stone
 * surface: press a page, the stones go to the rail and the page reads beside them; a link to
 * another guide opens that guide in the same place.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { createPhalanx } from './phalanx.js';
import { request } from './request.js';
import { renderMarkdownDocument } from './markdown-reader.js';
import { localDocumentLink, productRepositoryHref } from './document-links.js';
import { t } from './lexicon.js';

const el = (tag, cls, text) => { const out = document.createElement(tag); if (cls) out.className = cls; if (text != null) out.textContent = text; return out; };

/** The outline: each page is a doc path, in the order a new user meets them. */
function PAGES() {
  const four = { id: 'four', label: t('help_outline.four', 'Start here: 4 things you need to know') };
  const start = { id: 'start', label: t('help_outline.start', 'Getting started') };
  const using = { id: 'using', label: t('help_outline.using', 'Using Ronin') };
  const first = (n, path, label) => ({ id: path, group: four, label, path, glyph: String(n), className: 'help-outline-first' });
  const page = (group, path, label) => ({ id: path, group, label, path, className: 'help-outline-row' });
  return [
    first(1, 'docs/using-ronin/team-lead-and-edges.md', t('help_outline.lead', 'Team Lead and edges')),
    first(2, 'docs/using-ronin/what-agents-write-down.md', t('help_outline.records', 'Work records')),
    first(3, 'docs/using-ronin/agent-tools.md', t('help_outline.tools', 'Tools')),
    first(4, 'docs/getting-started/customize.md', t('help_outline.customize', 'Customizing your Ronin')),
    page(start, 'docs/getting-started/get-started.md', t('help_outline.get_started', 'Get started')),
    page(start, 'docs/getting-started/setup-workbench.md', t('help_outline.setup', 'Ronin Setup')),
    page(start, 'docs/getting-started/provider-sign-in.md', t('help_outline.sign_in', 'Provider sign-in')),
    page(start, 'docs/getting-started/workspace-folders.md', t('help_outline.folders', 'Workspace Folders')),
    page(start, 'docs/getting-started/services-activation.md', t('help_outline.services', 'Ronin Services')),
    page(using, 'docs/using-ronin/workbench.md', t('help_outline.workbench', 'Workbench')),
    page(using, 'docs/using-ronin/tile.md', t('help_outline.tile', 'The tile')),
    page(using, 'docs/using-ronin/terminal-controls.md', t('help_outline.controls', 'Terminal controls')),
    page(using, 'docs/using-ronin/new-team.md', t('help_outline.new_team', 'New Team')),
    page(using, 'docs/using-ronin/share-a-file.md', t('help_outline.share', 'Share a file')),
    page(using, 'docs/using-ronin/wipeboards.md', t('help_outline.wipeboards', 'Wipeboards')),
    page(using, 'docs/using-ronin/team-kanban.md', t('help_outline.kanban', 'Task Manager')),
    page(using, 'docs/using-ronin/archived-sessions.md', t('help_outline.archived', 'Archived sessions')),
    page(using, 'docs/using-ronin/feedback.md', t('help_outline.feedback', 'Feedback')),
  ];
}

export function createHelpOutline() {
  const out = WorkspaceKit.primitives.createSurface({ label: t('help_outline.title', 'Help'), className: 'help-outline' });
  const pages = PAGES();
  let reading = 0; // the read in flight; a later press wins
  const open = (path, fragment = '') => {
    const known = pages.find((item) => item.path === path);
    if (known && !fragment) stones.select(path);
    else stones.openDetail({ ...(known || { id: path, label: path.split('/').pop(), path }), fragment });
  };
  // The two lists' words, put back after every paint: the four's one line, and the heading
  // over the rest.
  const label = () => {
    const four = stones.el.querySelector('[data-sws-group="four"]');
    if (four) four.querySelector('.sws-group-hint').textContent = t('help_outline.read_first', 'Read these first');
    const rest = stones.el.querySelector('[data-sws-group="start"]');
    if (rest && !rest.previousElementSibling?.classList.contains('help-outline-else')) rest.before(el('h2', 'help-outline-else', t('help_outline.everything_else', 'Everything else')));
  };
  const stones = createPhalanx({
    items: pages, className: 'help-outline-stones', onSelectionChange: () => label(), grouped: { groups: [...new Map(pages.map((item) => [item.group.id, item.group])).values()] },
    renderDetail: (item, host) => {
      host.scrollTop = 0;
      const page = el('article', 'help-outline-page', t('docs.loading', 'loading…'));
      host.append(page);
      const mine = ++reading;
      void request('/api/file?' + new URLSearchParams({ path: item.path, product: '1' }).toString()).then((result) => {
        if (mine !== reading || !page.isConnected) return;
        if (!result.ok) { page.textContent = result.message; return; }
        page.replaceChildren(renderMarkdownDocument(result.data.text || '', document, {
          resolveHref: (href) => productRepositoryHref(item.path, href),
          onLink: (href) => {
            const linked = localDocumentLink(item.path, href, true);
            if (!linked) return false;
            open(linked.path, linked.fragment);
            return true;
          },
        }));
        if (item.fragment) page.querySelector(`[id="${CSS.escape(item.fragment)}"]`)?.scrollIntoView?.({ block: 'start' });
      });
    },
  });
  stones.mount(out.content);
  label();
  return { el: out.el, destroy: () => stones.destroy() };
}
