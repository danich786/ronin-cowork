/* part of the ronin-cowork client — see js/README.md */
/** Campaign installation choices, presented through the shared Setup stone work surface. */
import { t } from './lexicon.js';
import { request } from './request.js';
import { saveCampaign } from './campaigns.js';
import { WorkspaceKit } from './workspace-kit.js';
import { ask } from './ask.js';
import { createStoneWorkSurface } from './stone-work-surface.js';
import { createServicesSurface, createGbrainSurface } from './setup-surfaces.js';
import { completeInstallationMap as completeMap } from './installation-map.js';

const INSTALLATION_ORDER = ['ronin_services', 'gbrain', 'trello', 'perplexity'];

const el = (tag, cls = '', text = null) => {
  const out = document.createElement(tag);
  if (cls) out.className = cls;
  if (text != null) out.textContent = String(text);
  return out;
};

export const completeInstallationMap = completeMap;

export function createInstallationsSurface(campaign, context = {}) {
  const surface = WorkspaceKit.primitives.createSurface({ label: t('campaign_view.installations', 'Installations'), className: 'cv-surface' });
  let catalog = [];
  let installed = null;
  let values = {};
  let stoneSurface = null;

  const servicesReady = () => values.ronin_services === true && (installed?.services?.parts || []).length > 0;
  const gated = (name) => (name === 'trello' || name === 'perplexity') && !servicesReady();
  const itemFor = (installation) => ({
    id: installation.name,
    label: installation.label || installation.name,
    state: values[installation.name] ? t('campaign_view.on', 'On') : t('campaign_view.off', 'Off'),
    attrs: gated(installation.name)
      ? { 'data-gated': 'true', title: t('campaign_view.services_required', 'Ronin Services required') }
      : {},
  });
  const refreshStoneMarks = () => {
    for (const installation of catalog) {
      const stone = stoneSurface.el.querySelector(`[data-sws-id="${installation.name}"]`);
      if (!stone) continue;
      const reason = gated(installation.name) ? t('campaign_view.services_required', 'Ronin Services required') : '';
      const state = stone.querySelector('.sws-state');
      if (state) state.textContent = values[installation.name] ? t('campaign_view.on', 'On') : t('campaign_view.off', 'Off');
      stone.toggleAttribute('data-gated', Boolean(reason));
      stone.title = reason;
    }
  };

  const save = async (name, on, notice) => {
    const row = campaign();
    if (!row) return;
    notice.textContent = t('campaign.saving', 'saving…');
    const installations = { ...completeMap(catalog, row.config?.installations), [name]: on };
    const result = await saveCampaign(row.id, { config: { installations } });
    notice.textContent = result.ok ? t('settei.saved', 'saved') : result.message;
    notice.dataset.tone = result.ok ? 'success' : 'failed';
    if (result.ok) {
      values = installations;
      refreshStoneMarks();
    }
  };

  const choice = (installation, host) => {
    const reason = gated(installation.name) ? t('campaign_view.services_required', 'Ronin Services required') : '';
    const notice = el('p', 'setup-notice');
    const question = ask([{ group: installation.label || installation.name, fields: [{
      key: 'installation', label: t('campaign_view.installation_default', 'Available to Teams and Agents'),
      options: [
        { v: 'off', l: t('campaign_view.off', 'Off'), off: reason },
        { v: 'on', l: t('campaign_view.on', 'On'), off: reason },
      ],
    }] }], {
      value: { installation: values[installation.name] ? 'on' : 'off' },
      onChange: (answer) => void save(installation.name, answer.installation === 'on', notice),
    });
    host.append(question.el, notice);
  };

  const renderDetail = (installation, host) => {
    choice(installation, host);
    const sharedContext = {
      ...context,
      tenant: { ...(context.tenant || {}), campaign: campaign()?.id },
      onInstallationChange: (name, on) => {
        values = { ...values, [name]: on };
        refreshStoneMarks();
      },
    };
    const page = installation.id === 'ronin_services'
      ? createServicesSurface(sharedContext)
      : installation.id === 'gbrain' ? createGbrainSurface(sharedContext) : null;
    if (page) {
      host.append(page.el);
      void page.show?.();
      return () => page.destroy?.();
    }
    return null;
  };

  stoneSurface = createStoneWorkSurface({ items: [], className: 'campaign-installations-stones', renderDetail });
  stoneSurface.mount(surface.content);

  const enter = async () => {
    const [catalogResult, installedResult] = await Promise.all([
      request('/api/installations'),
      request('/api/installed', { cache: 'no-store' }),
    ]);
    const rows = catalogResult.ok && Array.isArray(catalogResult.data) ? catalogResult.data : [];
    catalog = INSTALLATION_ORDER.map((name) => rows.find((row) => row.name === name)).filter(Boolean);
    installed = installedResult.ok ? installedResult.data : null;
    values = completeMap(catalog, campaign()?.config?.installations);
    stoneSurface.setItems(catalog.map(itemFor));
  };

  return { el: surface.el, enter, destroy: () => stoneSurface.destroy() };
}

export function installationsSummary(campaign) {
  const values = campaign?.config?.installations;
  const map = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  return t('campaign_view.installations_n', '{n} on', { n: Object.values(map).filter((value) => value === true).length });
}
