/* part of the ronin-cowork client — see js/README.md */
/**
 * THE MODELS TILESPACE (KAN-236, the Agent Harness workbench; owner, 2026-11-03): what the launch form's Model
 * field will offer, across harnesses and accounts. Top to bottom: OFFERED PER ACCOUNT (the same
 * tick lists as Accounts), PRESETS (today's Hermes named setups, read with their harness and account), and
 * DEFAULTS (the Defaults surface embedded unchanged: Agent, Team lead and Mika). House roles beyond Mika join
 * when the launch tuple lands.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { request } from './request.js';
import { el } from './form-steps.js';
import { t } from './lexicon.js';
import { createModelDefaults } from './models-surface.js';
import { accountAction, button, kindWord, presetAction, presetForm, tickList } from './account-editors.js';

export function createModelsRecords(context) {
  const { createSurface } = WorkspaceKit.primitives;
  const out = createSurface({ label: t('models.records', 'Models'), className: 'setup-surface models-records' });
  const notice = el('p', 'setup-fine setup-provider-notice'); notice.hidden = true;
  const say = (text, bad = false) => { notice.className = `${bad ? 'setup-notice bad' : 'setup-fine'} setup-provider-notice`; notice.textContent = text; notice.hidden = !text; };
  const offered = el('section', 'models-records-section models-records-offered');
  const presets = el('section', 'models-records-section models-records-presets');
  const defaults = el('section', 'models-records-section models-records-defaults');
  const editor = el('div', 'accounts-editor');
  const body = el('div', 'models-records-body');
  out.content.append(body);
  body.append(notice, offered, presets, editor, defaults);
  const defaultsSurface = createModelDefaults();
  defaults.append(el('h3', null, t('models.defaults', 'Defaults')), defaultsSurface.el);
  let state = { accounts: [], presets: [] };
  let disposed = false;
  const section = (host, title, ...nodes) => { host.replaceChildren(el('h3', null, title), ...nodes); };
  const took = (answer) => { if (!answer || disposed) return; state = answer; editor.replaceChildren(); paint(); };
  const paintOffered = () => {
    const usable = state.accounts.filter((a) => !a.seeded);
    const blocks = usable.map((a) => {
      const block = el('div', 'accounts-list-block');
      block.append(el('p', 'setup-provider-note', `${kindWord(a.kind)} · ${a.name}`));
      block.append(a.models.length ? tickList(a.models.map((id) => [id, id]), a.offered, (ids) => accountAction('lists', { id: a.id, offered: ids }, say).then(took)) : el('p', 'setup-fine', t('accounts.not_discovered', 'Models not discovered')));
      return block;
    });
    section(offered, t('models.offered', 'Offered per account'), ...(blocks.length ? blocks : [el('p', 'setup-fine', t('models.offered_none', 'No accounts yet. Add one on Accounts or on a harness page.'))]));
  };
  const paintPresets = () => {
    const rows = state.presets.map((p) => {
      const row = el('div', 'hermes-card');
      const account = state.accounts.find((a) => a.id === p.account);
      const summary = el('div', 'hermes-card-summary');
      summary.append(el('strong', null, p.name), el('span', null, `${p.harness} · ${account?.name || t('accounts.missing_account', 'Missing account')} · ${p.model} · ${p.reasoning} · ${p.approvals === 'off' ? t('accounts.approvals_off_short', 'YOLO') : t('accounts.approvals_prompt', 'Ask for approval')}`));
      row.append(summary, WorkspaceKit.primitives.createActionBar({ actions: [
        button(t('accounts.edit', 'Edit'), () => editor.replaceChildren(presetForm(p, state.accounts, { onSaved: took, onCancel: () => editor.replaceChildren(), say }))),
        button(t('accounts.remove', 'Remove'), async () => took(await presetAction('delete', { id: p.id }, say))),
      ] }).el);
      return row;
    });
    const add = button(t('accounts.preset_add', 'Add preset'), () => editor.replaceChildren(presetForm({}, state.accounts, { onSaved: took, onCancel: () => editor.replaceChildren(), say })));
    add.disabled = !state.accounts.some((a) => a.configured && a.models.length);
    section(presets, t('models.presets', 'Presets'), el('p', 'setup-fine', t('models.presets_lede', 'A preset names harness, account, model and knobs; it appears under Model in New Agent. Today every preset is a Hermes named setup.')), ...rows, WorkspaceKit.primitives.createActionBar({ actions: [add] }).el);
  };
  const paint = () => { if (disposed) return; paintOffered(); paintPresets(); context.workbench?.refreshSelector?.(); };
  return {
    el: out.el,
    show: async () => {
      const accounts = await request('/api/accounts', { cache: 'no-store' });
      if (disposed) return;
      if (accounts.ok) state = accounts.data; else say(accounts.message, true);
      paint();
      await defaultsSurface.show?.();
    },
    destroy: () => { disposed = true; defaultsSurface.destroy?.(); },
  };
}
