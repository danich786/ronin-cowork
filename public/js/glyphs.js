/* part of the ronin-cowork client — see js/README.md */
/**
 * THE RULED GLYPHS — one face per ruled word, product-wide. A square stone in ask() carries a
 * glyph and a word; the same word wears the same glyph on New Agent, New Team, Team
 * Configuration and the Campaign defaults, because it is read from here and nowhere else.
 * Change a glyph in this table and every form follows. `glyph(axis, value)` returns '' for a
 * word this table does not know, and a caller then draws that list as rectangles.
 */
export const GLYPHS = Object.freeze({
  reach: { open: '○', discuss: '💬', plan: '🗺', execute: '⚙' },
  recruit: { open: '○', nobody: '👤', 'propose agents': '💡', 'staff agents': '👥' },
  output: { open: '○', 'a plan': '📝', ideas: '💭', code: '⌨', 'an artifact': '📦', 'the team': '👥', 'no code': '🚫' },
  dial: { user: '👤', read: '👁', write: '🤖' },
  kind: { open: '○', coding: '⌨', work: '💼', personal: '🎩', household: '🏠', social: '🎪', school: '🎓' },
});

export const glyph = (axis, value) => GLYPHS[axis]?.[value] || '';

/** Rows for a ruled axis: `{ v, l, glyph }`, worded by the caller's `word(value)`. */
export const ruledRows = (axis, values, word = (value) => value) => values.map((value) => ({ v: value, l: word(value), glyph: glyph(axis, value) }));
