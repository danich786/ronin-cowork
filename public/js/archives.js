/* part of the ronin-cowork client — see js/README.md */
import { deleteArchivedSession, fetchArchivedSessions, rehydrateSession } from './api.js';
import { humanAge } from './work-record.js';
import { toast } from './ui.js';
import { WorkspaceKit } from './workspace-kit.js';
import { t } from './lexicon.js';

/** A team tag said as a title, the same way the Cowork page falls back: parts, capitalized. */
const readableTag = (tag) => tag.split(/[_-]+/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');

/** The archived sessions list. `onlyTeam`, when given, names the Team whose archives alone it holds
 * (a Team workbench's Rehydrate Agents, KAN-706), read at each enter. */
export function buildArchives(tile, host, onlyTeam = null) {
  host.className = 'home-archives';
  const head = document.createElement('div');
  head.className = 'home-archived-head';
  const title = document.createElement('b');
  title.textContent = t('archives.title', 'Archived sessions');
  const count = document.createElement('span');
  // THE SORT (owner, 2026-11-19, KAN-702): most recently archived first (the default), or grouped
  // by Team; the kit's compact pressed actions, the pick marked in place and the list repainted.
  let sort = 'recent';
  const sorts = document.createElement('div');
  sorts.className = 'home-archive-sort';
  sorts.setAttribute('role', 'group');
  sorts.setAttribute('aria-label', t('archives.sort', 'Sort'));
  const sortChoices = [['recent', t('archives.sort_recent', 'Recently archived')], ['team', t('archives.sort_team', 'Team')]].map(([value, label]) => {
    const choice = WorkspaceKit.primitives.createAction({ label, size: 'compact', selected: value === sort, action: () => {
      if (sort === value) return;
      sort = value;
      for (const [one, el] of sortChoices) el.setAttribute('aria-pressed', String(one === sort));
      paint();
    } });
    sorts.append(choice.el);
    return [value, choice.el];
  });
  // One Team's list (KAN-711) has no choice: always newest archived first.
  head.append(title, count, ...(onlyTeam ? [] : [sorts]));
  const list = document.createElement('div');
  list.className = 'home-archive-list';
  host.append(head, list);

  let rows = [];
  const newestFirst = (a, b) => String(b.archived_at).localeCompare(String(a.archived_at));
  const paint = () => {
    list.innerHTML = '';
    if (!rows.length) {
      list.replaceChildren(Object.assign(document.createElement('span'), { className: 'home-empty', textContent: t('archives.empty', 'no archived sessions') }));
      return;
    }
    if (sort === 'recent') {
      for (const item of [...rows].sort(newestFirst)) list.appendChild(archiveRow(item, tile, enter, true));
      return;
    }
    // GROUPED BY THE TEAM OF RECORD. The first tag is the group; the rest ride the
    // detail line. Groups alphabetical, Ronin (no team) last, newest first inside.
    const groups = new Map();
    for (const item of rows) {
      const key = item.tags?.[0] ?? '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const keys = [...groups.keys()].sort((a, b) => (a === '') - (b === '') || a.localeCompare(b));
    for (const key of keys) {
      if (groups.size > 1 || key) {
        list.appendChild(Object.assign(document.createElement('span'), {
          className: 'home-archive-group',
          textContent: key ? readableTag(key) : t('archives.group_none', 'Ronin — no team'),
        }));
      }
      for (const item of groups.get(key).sort(newestFirst)) list.appendChild(archiveRow(item, tile, enter, false));
    }
  };

  let generation = 0;
  const enter = async () => {
    const mine = ++generation;
    let read;
    try {
      read = await fetchArchivedSessions();
    } catch {
      if (mine !== generation) return;
      count.textContent = t('archives.unavailable', 'unavailable');
      list.replaceChildren(Object.assign(document.createElement('span'), { className: 'home-empty', textContent: t('archives.read_failed', 'archive could not be read') }));
      return;
    }
    if (mine !== generation) return;
    const only = onlyTeam?.();
    rows = only ? read.filter((item) => item.tags?.[0] === only) : read;
    count.textContent = String(rows.length);
    paint();
  };

  return { enter };
}

/** One archived session: the reading, then its two labelled acts. Sorted by recency there is no
 * group heading, so its Team rides the detail line with the other tags. */
function archiveRow(item, tile, enter, withTeam) {
  const row = document.createElement('div');
  row.className = 'home-archive-row';
  const info = document.createElement('div');
  info.className = 'home-archive-info';
  const name = document.createElement('b');
  name.textContent = item.name;
  const detail = document.createElement('span');
  detail.textContent = [
    item.agent,
    ...(item.tags ?? []).slice(withTeam ? 0 : 1).map(readableTag),
    item.archived_at ? t('archives.ago', '{age} ago', { age: humanAge(Date.now() - Date.parse(item.archived_at)) }) : '',
  ].filter(Boolean).join(' · ');
  info.append(name, detail);
  const revive = document.createElement('button');
  revive.type = 'button';
  revive.className = 'home-archive-rehydrate';
  revive.textContent = t('archives.rehydrate_btn', 'Rehydrate');
  revive.addEventListener('click', async () => {
    revive.disabled = true;
    revive.textContent = t('archives.rehydrating', 'rehydrating…');
    try {
      const liveName = await rehydrateSession(item.id);
      await enter();
      tile.connect(liveName);
    } catch (e) {
      revive.disabled = false;
      revive.textContent = t('archives.rehydrate_btn', 'Rehydrate');
      toast('could not rehydrate it — ' + e.message, false);
    }
  });
  const hard = document.createElement('button');
  hard.type = 'button';
  hard.className = 'home-archive-delete';
  hard.textContent = '\u{1F5D1}';
  hard.setAttribute('aria-label', t('archives.delete_aria', 'Permanently delete archived session {name}', { name: item.name }));
  hard.title = t('archives.delete_title', 'Hard delete this archive');
  hard.addEventListener('click', async () => {
    if (!confirm(t('archives.delete_confirm', 'Hard delete archived session "{name}"? Its saved Ronin record cannot be rehydrated after this.', { name: item.name }))) return;
    hard.disabled = true;
    try {
      await deleteArchivedSession(item.id);
      await enter();
    } catch (e) {
      hard.disabled = false;
      toast('could not hard delete the archive — ' + e.message, false);
    }
  });
  row.append(info, revive, hard);
  return row;
}
