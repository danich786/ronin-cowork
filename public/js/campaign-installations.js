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
import { applyFeatureProviderState, featureProviderState } from './feature-provider-installation.js';

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
  let defaultBehaviours = [];
  let stoneSurface = null;

  const providerState = (installation) => featureProviderState(installation, values, defaultBehaviours);
  const stateWord = (installation) => installation.effect === 'provider'
    ? ({ off: t('campaign_view.off', 'Off'), on: t('campaign_view.on', 'On'), all: t('campaign_view.shape_all', 'All') })[providerState(installation)]
    : values[installation.name] ? t('campaign_view.on', 'On') : t('campaign_view.off', 'Off');

  const servicesReady = () => values.ronin_services === true && (installed?.services?.parts || []).length > 0;
  const gated = (name) => (name === 'trello' || name === 'perplexity') && !servicesReady();
  const itemFor = (installation) => ({
    ...installation,
    id: installation.name,
    label: installation.label || installation.name,
    state: stateWord(installation),
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
      if (state) state.textContent = stateWord(installation);
      stone.toggleAttribute('data-gated', Boolean(reason));
      stone.title = reason;
    }
  };

  const saveProvider = async (installation, answer, notice) => {
    const row = campaign();
    if (!row) return;
    notice.textContent = t('campaign.saving', 'saving…');
    const { installations, defaults } = applyFeatureProviderState(
      installation, answer, completeMap(catalog, row.config?.installations),
      { ...(row.config?.defaults || {}), behaviours: defaultBehaviours },
    );
    const result = await saveCampaign(row.id, { config: { installations, defaults } });
    notice.textContent = result.ok ? t('settei.saved', 'saved') : result.message;
    notice.dataset.tone = result.ok ? 'success' : 'failed';
    if (result.ok) {
      values = installations;
      defaultBehaviours = defaults.behaviours;
      refreshStoneMarks();
      context.onInstallationChange?.(installation.name, answer !== 'off');
    }
    return result;
  };

  const featureProviderChoice = (installation, host) => {
    const reason = gated(installation.name) ? t('campaign_view.services_required', 'Ronin Services required') : '';
    const notice = el('p', 'setup-notice');
    const question = ask([{ fields: [{
      key: 'installation', label: installation.label || installation.name,
      options: [
        { v: 'off', l: t('campaign_view.off', 'Off') },
        { v: 'on', l: t('campaign_view.on', 'On') },
        { v: 'all', l: t('campaign_view.shape_all', 'All') },
      ],
    }] }], {
      value: { installation: providerState(installation) },
      onChange: async (answer) => {
        const before = providerState(installation);
        const result = await saveProvider(installation, answer.installation, notice);
        if (!result?.ok) question.set('installation', before);
      },
    });
    const control = question.el.querySelector('[data-ask-key="installation"]');
    if (reason && control) { control.disabled = true; control.title = reason; }
    host.append(question.el, notice);
  };

  const renderDetail = (installation, host) => {
    if (installation.effect === 'provider') featureProviderChoice(installation, host);
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
    defaultBehaviours = Array.isArray(campaign()?.config?.defaults?.behaviours) ? [...campaign().config.defaults.behaviours] : [];
    stoneSurface.setItems(catalog.map(itemFor));
    stoneSurface.select('ronin_services');
  };

  return { el: surface.el, enter, destroy: () => stoneSurface.destroy() };
}

export function installationsSummary(campaign) {
  const values = campaign?.config?.installations;
  const map = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  return t('campaign_view.installations_n', '{n} on', { n: Object.values(map).filter((value) => value === true).length });
}
