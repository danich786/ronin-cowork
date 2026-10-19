/* part of the ronin-cowork client — see js/README.md */

export const MENTION_MIME = 'application/x-ronin-session-mention';
/** Put `@name ` where this tile's next words go: the composer, the live pane when locked,
 *  or the pending line. The menu's Mention list calls it (js/tilehead.js). */
export function insertMention(tile, name) {
  const mention = `@${name} `;
  const ta = tile.composerTa;
  if (ta && !tile.locked) {
    const start = ta.selectionStart;
    const lead = start > 0 && !/\s/.test(ta.value[start - 1]) ? ' ' : '';
    ta.setRangeText(lead + mention, start, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input'));
    ta.focus();
  } else if (tile.locked) {
    tile.sendRaw(mention);
    tile.focusTerminal();
  } else {
    tile.pending += mention;
    tile.renderPending();
  }
}
