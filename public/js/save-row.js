/* part of the ronin-cowork client — see js/README.md */
/**
 * SAVE ROW — the Grey form's one factory: a row that saves itself (PATTERNS.md, Grey form).
 * Machine settings and the Desk identity fields save with it; configuration surfaces build on it.
 *
 * In: `say(state, message)` (the row's status line; state pending | valid | invalid),
 * `save(value)` (the write, answering { ok, message }) and `after(result)` (the re-read once a
 * save lands: the record, not the value typed, says what a save produced). Out: `commit(value)`,
 * which says saving…, saves, then says saved or the refusal. The caller draws the row.
 */
import { t } from './lexicon.js';

export const saveRow = ({ say, save, after }) => async (value) => {
  say('pending', t('settei.saving', 'saving…'));
  const result = await save(value);
  if (!result.ok) return say('invalid', result.message);
  say('valid', t('settei.saved', 'saved'));
  await after(result);
};
