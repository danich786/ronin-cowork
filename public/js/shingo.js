/* part of the ronin-cowork client — see js/README.md
 *
 * SHINGO (信号) — the session's work record, made visible.
 *
 * Three surfaces, one payload, no second data path:
 *   the chip    a fixed-width readout in the tile header: the items held, with their status
 *   the record  the tile's Work record: the same, with each item's comments
 *   the roster  the same chip as a row per session, in the commons ⌂ Roster
 *
 * There is no ladder: a work item mirrors Jira, and Jira has none (owner, 2026-10-22).
 * Everything on this side is read-only: no element built in this module can touch a
 * session.
 */
import { t } from './lexicon.js';

export function clampTip(s, room = 120) {
  return s.length > room ? s.slice(0, room - 1) + '…' : s;
}

/** An item's comments, as text. */
const commentsOf = (item) => (item.comments || []).map((comment) => comment.text);

/** The work record: what the Agent is doing, the items it holds with their status, where
 *  it works, its Teams and its documents. */
export function buildWorkRecord(letter, deskEntry = null, { openDoc = null } = {}) {
  const box = document.createElement('div');
  box.className = 'shingo-ladder';
  if (!letter) return box;

  const section = (label, cls = '') => {
    const el = document.createElement('section');
    el.className = 'sl-section' + (cls ? ' ' + cls : '');
    const head = document.createElement('h4');
    head.textContent = label;
    el.appendChild(head);
    box.appendChild(el);
    return el;
  };

  if (letter.chip?.text && letter.chip.text !== '—') {
    const summary = document.createElement('div');
    summary.className = 'sl-summary' + (letter.chip.gate ? ' gate' : '');
    summary.textContent = letter.chip.text;
    box.appendChild(summary);
  }

  const task = section(t('ladder.task_at_hand', 'Task at hand'), 'sl-task');
  const objective = document.createElement('p');
  objective.textContent = letter.objective || t('ladder.task_unstated', 'No task stated in this work record.');
  task.appendChild(objective);
  if (letter.mandate) {
    const mandate = document.createElement('p');
    mandate.className = 'sl-action';
    mandate.append(
      t('glossary.mandate', 'mandate'),
      ' · ',
      [letter.mandate.reach, letter.mandate.recruit, letter.mandate.output].filter(Boolean).join(' · '),
    );
    task.appendChild(mandate);
  }

  if (letter.ladder_state) {
    const sr = document.createElement('div');
    sr.className = 'sl-side';
    sr.textContent = '↳ ' + t('ladder.side', '{state} — the work record below is held, not stale', { state: letter.ladder_state.replace(/_/g, ' ') });
    box.appendChild(sr);
  }

  // The items held, each with its status and its comments.
  const held = section(t('ladder.items', 'Work items'), 'sl-items');
  if (letter.items?.length) {
    for (const item of letter.items) {
      const row = document.createElement('div');
      row.className = 'sl-item' + (item.flagged ? ' flagged' : '');
      const title = document.createElement('p');
      title.textContent = item.title;
      const state = document.createElement('p');
      state.className = 'sl-action';
      state.textContent = [item.id, item.status, item.flagged ? '⚑ ' + t('team_kanban.flagged', 'flagged') : ''].filter(Boolean).join(' · ');
      row.append(title, state);
      for (const text of commentsOf(item)) {
        const comment = document.createElement('p');
        comment.className = 'sl-comment';
        comment.textContent = text;
        row.appendChild(comment);
      }
      held.appendChild(row);
    }
  } else {
    const empty = document.createElement('p');
    empty.className = 'sl-empty';
    empty.textContent = t('ladder.no_items', 'No work items held.');
    held.appendChild(empty);
  }

  const desks = deskEntry?.desks || [];
  if (desks.length || letter.repos?.length) {
    const checkout = section(t('ladder.worktrees', 'Worktrees'), 'sl-checkout');
    const rows = desks.length ? desks : letter.repos;
    for (const item of rows) {
      const line = document.createElement('div');
      line.className = 'sl-checkout-line';
      if (item.worktree) {
        const worktree = document.createElement('strong');
        worktree.className = 'sl-worktree';
        worktree.textContent = item.worktree;
        line.appendChild(worktree);
      }
      if (item.branch) {
        const branch = document.createElement('span');
        branch.className = 'sl-branch';
        branch.textContent = t('ladder.branch', 'Branch') + ' · ' + item.branch;
        line.appendChild(branch);
      }
      if (item.repo) {
        const repo = document.createElement('span');
        repo.className = 'sl-repo';
        repo.textContent = item.repo.replace(/^.*[/:]([^/]+\/[^/]+?)(\.git)?$/, '$1');
        repo.title = item.repo;
        line.appendChild(repo);
      }
      checkout.appendChild(line);
    }
  }

  if ((letter.teams ?? []).length) {
    const context = section(t('ladder.coworks', 'Teams'), 'sl-context');
    for (const entry of letter.teams ?? []) {
      const team = document.createElement('p');
      team.textContent = entry.team;
      context.appendChild(team);
    }
  }

  const docs = section(t('ladder.tracked_documents', 'Tracked documents'), 'sl-docs');
  if (letter.docs?.length) {
    for (const item of letter.docs) {
      // Where the reader can open a document (the tile's menu), each one is a press.
      const row = document.createElement(openDoc ? 'button' : 'p');
      row.textContent = typeof item === 'string' ? item : (item.path || item.file || item.title || '');
      row.title = row.textContent;
      if (openDoc) {
        const path = row.textContent;
        row.type = 'button';
        row.className = 'sl-doc';
        row.addEventListener('click', () => openDoc(path));
      }
      docs.appendChild(row);
    }
  } else {
    const empty = document.createElement('p');
    empty.className = 'sl-empty';
    empty.textContent = t('ladder.docs_none', 'No tracked documents.');
    docs.appendChild(empty);
  }

  return box;
}

/** `51m`, `3h`, `2d` — short enough to sit on a board row. */
export function humanAge(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}
