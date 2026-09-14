/* Shared release lifecycle; feeds are checked only by an explicit check(). */
import { request } from './request.js';
import { t } from './lexicon.js';

export function releaseIdentity(version) {
  return version?.release || (version?.commit ? `Dev checkout · ${version.commit}${version.dirty ? ' (dirty)' : ''}` : 'Version unavailable');
}

export function packageReading(fact) {
  if (!fact?.latest) return { state: 'unknown', text: 'No release information available', available: false };
  if (fact.upToDate === true) return { state: 'current', text: `Up to date · ${fact.installed || fact.latest}`, available: false };
  return { state: 'available', text: `${fact.latest} available${fact.installed ? ` · installed ${fact.installed}` : ' · installed version unknown'}`, available: true };
}

export function createReleaseUpdateController({ onChange = () => {}, send = request,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), reload = () => location.reload() } = {}) {
  let version = null;
  let facts = null;
  let busy = false;
  let message = '';
  let bad = false;
  const emit = () => onChange({ version, facts, busy, message, bad, canUpdate: !!version?.release });
  const say = (text, failed = false) => { message = text; bad = failed; emit(); };
  const identify = async () => {
    const result = await send('/api/version', { cache: 'no-store' });
    version = result.ok ? result.data : null;
    emit();
    return version;
  };
  const check = async () => {
    if (busy) return;
    busy = true;
    facts = null;
    say('Checking…');
    try {
      await identify();
      const result = await send('/api/update/check', { cache: 'no-store' });
      if (result.ok) { facts = { cowork: result.data, services: result.data.services }; say(''); }
      else say('Could not check for updates.', true);
    } finally { busy = false; emit(); }
  };
  /** After /run: the new operator answering a different release IS completion. */
  const watch = async () => {
    const was = version?.release;
    for (let i = 0; i < 100; i++) {
      await sleep(3000);
      const rv = await send('/api/version', { cache: 'no-store' });
      // A failed read is the restart itself — keep polling.
      if (rv.ok && rv.data.release && rv.data.release !== was) {
        say(t('desk.updated_reloading', '✓ updated to {release} — reloading', { release: rv.data.release }));
        await sleep(1200); reload();
        return;
      }
    }
    say(t('desk.update_timeout', 'no new version answered after 5 minutes — journalctl --user -u "ronin-update-*" has the transcript'), true);

  };

  /** Services completion: the operator restarts (startedAt moves) and the roster
   *  answers — a filled roster after a fresh start IS the install having landed. */
  const watchSvc = async () => {
    const was = version?.startedAt;
    for (let i = 0; i < 100; i++) {
      await sleep(3000);
      const rv = await send('/api/version', { cache: 'no-store' });
      // A failed read is the restart itself — keep polling.
      if (rv.ok && rv.data.startedAt !== was && (rv.data.services || []).length) {
        say(t('desk.services_live_reloading', '✓ services live: {list} — reloading', { list: rv.data.services.join(' · ') }));
        await sleep(1200); reload();
        return;
      }
    }
    say(t('desk.services_timeout', 'services did not answer after 5 minutes — journalctl --user -u "ronin-update-*" has the transcript'), true);

  };


  const run = async (pkg) => {
    if (busy || !version?.release || !['cowork', 'services'].includes(pkg) || !packageReading(facts?.[pkg]).available) return;
    busy = true;
    say(`Updating Ronin ${pkg === 'cowork' ? 'Cowork' : 'Services'}…`);
    try {
      const result = await send('/api/update/run', { method: 'POST', json: { package: pkg } });
      if (!result.ok) say(result.message || 'Could not start the update.', true);
      else await (pkg === 'cowork' ? watch() : watchSvc());
    } finally { busy = false; emit(); }
  };
  return { identify, check, run };
}
