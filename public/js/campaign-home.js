/* part of the ronin-cowork client — see js/README.md */
/**
 * RONIN HOME — the quiet root arrival and three doors out of it: Models, Workspaces, Teams
 * (PATTERNS.md, Home; owner, 2026-10-19). Home stays a page; each door opens its own
 * workbench in this tab (door-workbenches.js), the bar reading RoninCowork • Home • <door>
 * with Home the way back. A door is a link: a plain press navigates here, a modified press
 * opens the workbench in a new tab.
 */
import { t } from './lexicon.js';
import { createReleaseUpdateController, packageReading } from './release-update-controller.js';
import { createSenmaida } from './senmaida.js';
import { createThemeToggle } from './theme-toggle.js';
import { campaignById, loadCampaigns, normalizeSelection, setupDefaultView } from './campaigns.js';
import { workbenchLaunchUrl } from './workspace.js';

const el = (tag, cls, text) => {
  const out = document.createElement(tag);
  if (cls) out.className = cls;
  if (text != null) out.textContent = String(text);
  return out;
};

function DOORS() {
  return [
    { key: 'models', route: 'models', glyph: '✶', name: t('campaign_home.models', 'Models'), is: t('campaign_home.models_is', 'Model providers on this machine: install, sign in, choose') },
    { key: 'workspaces', route: 'workspaces', glyph: '⌂', name: t('campaign_home.workspaces', 'Workspaces'), is: t('campaign_home.workspaces_is', 'The folders your Teams work in') },
    { key: 'teams', route: 'teams', glyph: '人人', name: t('campaign_home.teams', 'Teams'), is: t('campaign_home.teams_is', 'Your Teams; open one to its page') },
  ];
}

function doorGlyph(glyph) {
  const host = el('span', 'ch-glyph');
  host.setAttribute('aria-hidden', 'true');
  host.textContent = glyph;
  return host;
}

export function createCampaignHome() {
  const themeToggle = createThemeToggle();
  const root = el('main', 'ch-view');
  root.append(createSenmaida('page', 'ch-horizon'));
  const frame = el('div', 'ch-frame');
  const doors = el('div', 'ch-doors');
  const settings = el('button', 'ch-settings', t('campaign_home.settings', 'Settings'));
  settings.type = 'button';
  const release = el('div', 'ch-release');
  const check = el('button', 'ch-update', t('campaign_home.check_updates', 'Check for updates'));
  const answer = el('span', 'ch-update-answer');
  check.type = 'button';
  const readings = el('div', 'ch-update-readings');
  readings.hidden = true;
  answer.hidden = true;
  const controls = {};
  for (const pkg of ['cowork', 'services']) {
    const line = el('div', 'ch-update-package');
    const text = el('span', 'ch-update-reading');
    const update = el('button', 'ch-update', `Update ${pkg === 'cowork' ? 'Cowork' : 'Services'}`);
    update.type = 'button';
    update.hidden = true;
    update.addEventListener('click', () => void updates.run(pkg));
    line.append(text, update);
    readings.append(line);
    controls[pkg] = { text, update };
  }
  answer.setAttribute('aria-live', 'polite');
  readings.setAttribute('aria-live', 'polite');
  release.append(readings, answer, check);
  frame.append(doors);
  root.append(frame, settings, release);

  let ctx = null;
  let entered = false;
  let setupCampaign = null;

  // A DOOR IS A LINK to its workbench: pressed, it navigates this tab; with a modifier it
  // opens the workbench in a new tab through the same request the bar's doors carry.
  for (const door of DOORS()) {
    const route = door.route;
    const card = el('a', 'ch-door');
    card.dataset.door = door.key;
    card.href = workbenchLaunchUrl({ destination: route, mode: 'overlay' });
    card.append(doorGlyph(door.glyph), el('h2', null, door.name), el('p', 'ch-is', door.is));
    card.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      ctx?.navigate(route);
    });
    doors.append(card);
  }

  settings.addEventListener('click', () => {
    const route = setupDefaultView(setupCampaign);
    ctx?.navigate(route);
  });

  const updates = createReleaseUpdateController({ onChange: state => {
    check.setAttribute('aria-disabled', String(state.busy));
    answer.textContent = state.message;
    answer.hidden = !state.message;
    readings.hidden = !state.facts;
    answer.dataset.state = state.bad ? 'failed' : '';
    for (const pkg of ['cowork', 'services']) {
      const fact = packageReading(state.facts?.[pkg]);
      const { text, update } = controls[pkg];
      const installed = state.facts?.[pkg]?.installed;
      const detail = state.canUpdate ? fact.text : (fact.available ? `${state.facts[pkg].latest} available · This installation cannot be updated here.` : fact.text);
      text.textContent = `Ronin ${pkg === 'cowork' ? 'Cowork' : 'Services'} — ${installed && !state.canUpdate && fact.available ? `Installed ${installed} · ` : ''}${detail}`;
      text.dataset.state = fact.state;
      update.hidden = !fact.available || !state.canUpdate;
      update.disabled = !state.canUpdate || state.busy;
      update.title = '';
    }
  }});
  check.addEventListener('click', () => void updates.check());

  return {
    el: root,
    glyph: '⛩',
    title: () => t('campaign_home.ronin_home', 'Ronin Home'),
    header: { actions: [themeToggle] },
    enter: (context) => {
      ctx = context;
      entered = true;
      void loadCampaigns().then(() => {
        if (!entered) return;
        setupCampaign = campaignById(normalizeSelection(ctx?.state?.campaignSelection).primary_campaign_id);
      });
    },
    leave: () => { entered = false; },
    destroy: () => { entered = false; ctx = null; },
  };
}
