/* part of the ronin-cowork client — see js/README.md */
/**
 * CUSTOMIZE — the resource model, and the ONE place the v1 capability matrix is encoded.
 *
 * The matrix is the authority (docs/architecture/customize.md): each resource is
 * exactly one of DIRECT EDITOR, GUIDED AGENT HANDOFF or READ-ONLY, and a resource earns a
 * direct editor only where a typed, validating write API already exists. Two do. The rest
 * are handoff or read-only, and this file is where that ruling lives so a view cannot
 * quietly grant itself a capability by drawing a form.
 *
 * `read` IS THE WHOLE HONESTY TEST OF THIS PREVIEW. A resource with no route does not get
 * an empty list — an empty list is a claim that the shelf is empty, which is false. It
 * gets the `unavailable` state and says which route is missing. Tools is in that
 * position today because its read route requires a table parser the server does not have;
 * drawing it as empty would make the surface lie about the owner's own files.
 */
// Functions, not tables: the lexicon loads after this module is evaluated, so the words
// are read when the rail is drawn.
import { t } from './lexicon.js';

export function sections() {
  return [
    { id: 'behavior', label: t('customize.sec_behavior', 'Behavior') },
    { id: 'people', label: t('customize.sec_people', 'People & work') },
    { id: 'presentation', label: t('customize.sec_presentation', 'Presentation') },
  ];
}

/**
 * `capability` is the matrix verdict. `read` is the route that tells the truth today, or
 * null when none exists. `why` is what the surface says INSTEAD of an empty list — it
 * names the missing prerequisite, because "unavailable" without a reason is indistinguishable
 * from "broken".
 */
export function resources() {
  return [
    { id: 'behaviours', section: 'behavior', mark: '▤', label: t('customize.behaviours', 'Behaviors'),
      capability: 'read-only', read: '/api/ways', readLabel: t('customize.behaviours_read', 'Read behavior'),
      blurb: t('customize.behaviours_blurb', 'How this house works: floor, conditional, selectable, and situational guidance in one catalog.') },
    { id: 'tools', section: 'behavior', mark: '⚙', label: t('customize.tools', 'Tools'),
      capability: 'read-only', read: null,
      why: t('customize.tools_why', 'Agent tool teaching is composed from the capability files in ronin_catalogs/capabilities; Customize does not yet expose a reader for that catalog.'),
      blurb: t('customize.tools_blurb', 'The executables available to Agents. A markdown row cannot author one.') },

    { id: 'saved-launches', section: 'people', mark: '↗', label: t('customize.saved_launches', 'Saved launches'),
      capability: 'read-only', read: '/api/saved-launches',
      blurb: t('customize.saved_launches_blurb', 'The launcher form, filled in ahead of time and named.') },

    { id: 'skins', section: 'presentation', mark: '◐', label: t('customize.skins', 'Skins'),
      capability: 'read-only', read: '/api/skins', file: 'SKINS.md', what: t('customize.skins_what', 'a look — a set of design tokens, and nothing else'),
      blurb: t('customize.skins_blurb', 'A set of design tokens and nothing else. Choosing one is a setting, and stays on the gear.') },
    { id: 'desk-profiles', section: 'presentation', mark: '◫', label: t('customize.desk_profiles', 'Desk profiles'),
      capability: 'read-only', read: '/api/desk-profiles', dir: 'desk_profiles',
      blurb: t('customize.desk_profiles_blurb', 'Your standing defaults for the surfaces you work at — a skin, a lexicon, a campaign kind, a Team page arrangement. Choosing one is a setting, on the gear.') },
    { id: 'lexicons', section: 'presentation', mark: '言', label: t('customize.lexicons', 'Lexicons'),
      capability: 'read-only', read: '/api/lexicons', dir: 'lexicons',
      blurb: t('customize.lexicons_blurb', 'The words a surface uses — a wording or a language, one file each. Say only what changes; the rest falls through to the floor.') },
    { id: 'readings', section: 'presentation', mark: '▧', label: t('customize.readings', 'Session readings'),
      capability: 'read-only', read: '/api/session-readings', readLabel: t('customize.readings_read', 'Read reading'),
      blurb: t('customize.readings_blurb', 'What a new session reads before anything else. A reading you add reaches the next session born, never a running one.') },
  ];
}

export const byId = (id) => resources().find((r) => r.id === id) || null;

/** Sections with their resources, for the rail. Counts are filled in by the caller as
 *  reads resolve — never guessed, and absent until the read answers. */
export function railSections(counts = {}, marks = {}) {
  return sections().map((section) => {
    const items = resources().filter((r) => r.section === section.id).map((r) => ({
      id: r.id,
      label: `${r.mark} ${r.label}`,
      count: counts[r.id] ?? null,
      provenance: marks[r.id] ?? null,
    }));
    // A section count is the sum of the reads that ANSWERED. Sections whose resources
    // cannot be read carry none rather than a zero, for the same reason a resource does.
    const known = items.map((i) => i.count).filter((c) => typeof c === 'number');
    return { label: section.label, count: known.length ? known.reduce((a, b) => a + b, 0) : null, items };
  });
}
