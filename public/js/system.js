/* part of the ronin-cowork client — see js/README.md */
import { request } from './request.js';
import { button, field, status } from './ui.js';
import { buildMachinePanel } from './machine-panel.js';
import { followProfileSkin } from './skins.js';
import { activeProfile, deskProfiles, loadDeskProfile, setDeskProfile } from './desk-profile.js';
import { t } from './lexicon.js';
import { S } from './state.js';
import { createReleaseUpdateController, packageReading } from './release-update-controller.js';

/* ---------- passkeys ----------
 * REGISTRATION LIVES BEHIND THE GATE AND THAT IS THE DESIGN, NOT AN ACCIDENT. You add a
 * passkey by first proving you are already the owner; the login page can only SPEND one.
 * An unauthenticated "register a passkey" button would be a public become-the-owner
 * button, which is a worse door than no door at all (src/routes/passkey-api.ts).
 *
 * The two things that can make the button useless are both reported rather than hidden:
 * a non-secure context (the tailnet IP — WebAuthn simply does not exist there), and a
 * credential registered under a different name than the one this page was reached by. A
 * passkey is bound to its domain, so a key made on the MagicDNS name will not be offered
 * on any other address, and saying so beats an owner concluding it was lost.
 */
function buildPasskeyBlock() {
  const el = document.createElement('div');
  el.className = 'sys-passkeys';
  // Hidden until /api/health confirms a login exists — drawing it first and retracting
  // it a moment later is a flash of a control the owner may not even have.
  el.hidden = true;
  const head = document.createElement('div');
  head.className = 'sys-theme-lbl';
  head.textContent = t('desk.passkeys', 'passkeys');
  const list = document.createElement('div');
  const msg = status('sys-msg');

  const name = document.createElement('input');
  name.type = 'text';
  name.placeholder = t('desk.passkey_name_placeholder', 'this device');
  name.maxLength = 60;
  const nameField = field(name, { label: t('desk.passkey_name', 'passkey name') });

  const addBtn = button(t('desk.add_passkey', 'Add a passkey'), {
    cls: 'sys-run',
    title: t('desk.add_passkey_title', 'Register this device — Touch ID, Face ID or a security key'),
  });
  const row = document.createElement('div');
  row.className = 'sys-actions';
  row.append(addBtn);
  el.append(head, list, nameField.el, row, msg.el);

  const toBuf = (s) => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u.buffer;
  };
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const b64u = (buf) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const render = (d) => {
    list.innerHTML = '';
    const creds = (d && d.credentials) || [];
    if (!creds.length) {
      const none = document.createElement('small');
      none.textContent = t('desk.no_passkeys', 'none registered — this device can be the first.');
      list.append(none);
    }
    for (const c of creds) {
      const line = document.createElement('div');
      line.className = 'sys-theme';
      const lab = document.createElement('small');
      lab.textContent = c.label + (c.usable ? '' : ' ' + t('desk.passkey_elsewhere', '(registered on {rp} — not usable from this address)', { rp: c.rpId }));
      const rm = button(t('desk.remove', 'Remove'), { title: t('desk.remove_named', 'Remove {name}', { name: c.label }) });
      rm.addEventListener('click', async () => {
        // No confirm(): removing one of several passkeys is reversible by re-adding,
        // and the destructive-confirm primitive is reserved for work that is not.
        rm.disabled = true;
        const r = await request('/api/passkey/remove', { method: 'POST', json: { id: c.id } });
        msg.say(r.ok ? t('desk.removed', 'removed') : r.message, r.ok ? 'ok' : 'bad');
        refresh();
      });
      line.append(lab, rm);
      list.append(line);
    }
    if (d && d.recovery) {
      const rec = document.createElement('small');
      rec.textContent = t('desk.recovery_outstanding', 'a recovery code is outstanding until {time}', { time: new Date(d.recovery.expiresAt).toLocaleTimeString() });
      list.append(rec);
    }
  };

  const refresh = async () => {
    const r = await request('/api/passkey/list', { cache: 'no-store' });
    if (!r.ok) {
      // A 404 means this operator predates the routes — the same honest reading the
      // update button gives, rather than an error the owner cannot act on.
      msg.say(r.status === 404 ? t('desk.passkeys_predate', 'this operator predates passkeys — its next restart carries the routes') : r.message, 'bad');
      addBtn.disabled = true;
      return;
    }
    render(r.data);
    const secure = window.isSecureContext && !!(window.PublicKeyCredential && navigator.credentials);
    addBtn.disabled = !secure || !r.data.rpId;
    if (!secure) {
      msg.say(t('desk.passkey_needs_https', 'Adding a passkey needs the HTTPS address — this one is not a secure context.'), 'bad');
    } else if (!r.data.rpId) {
      msg.say(t('desk.passkeys_unavailable', 'Passkeys unavailable: {why}', { why: r.data.why || t('desk.no_rp_name', 'no relying-party name') }), 'bad');
    }
  };

  addBtn.addEventListener('click', async () => {
    addBtn.disabled = true;
    msg.say(t('desk.waiting_authenticator', 'waiting for the authenticator…'), 'busy');
    try {
      const o = await request('/api/passkey/register-options', { cache: 'no-store' });
      if (!o.ok) throw new Error(o.message);
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: toBuf(o.data.challenge),
          rp: { id: o.data.rpId, name: 'Ronin' },
          // ONE owner, so one stable user handle: a fixed id means re-registering the
          // same device REPLACES its entry in the keychain instead of littering it.
          user: { id: new TextEncoder().encode('ronin-owner'), name: `ronin@${o.data.rpId}`, displayName: 'Ronin owner' },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256 — what Apple's platform authenticator uses
            { type: 'public-key', alg: -257 }, // RS256 — Windows Hello and older keys
          ],
          // residentKey: the credential lives ON the device, which is what lets the
          // login page omit allowCredentials and never enumerate the owner's devices.
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
          excludeCredentials: (o.data.excludeCredentials || []).map((id) => ({ type: 'public-key', id: toBuf(id) })),
          attestation: 'none', // we do not check it, so we do not collect it
          timeout: 60000,
        },
      });
      // getPublicKey() is why this needs no CBOR parser on the server — see src/passkey.ts.
      const spki = cred.response.getPublicKey && cred.response.getPublicKey();
      const r = await request('/api/passkey/register', {
        method: 'POST',
        json: {
          id: cred.id,
          publicKey: spki ? b64(spki) : '',
          alg: cred.response.getPublicKeyAlgorithm ? cred.response.getPublicKeyAlgorithm() : 0,
          clientDataJSON: b64u(cred.response.clientDataJSON),
          label: name.value.trim(),
        },
      });
      if (!r.ok) throw new Error(r.message);
      name.value = '';
      msg.say(t('desk.passkey_added', '✓ passkey added'), 'ok');
      refresh();
      return;
    } catch (ex) {
      const cancelled = ex && (ex.name === 'NotAllowedError' || ex.name === 'AbortError');
      msg.say(cancelled ? t('desk.cancelled', 'cancelled') : ex.message, cancelled ? '' : 'bad');
    }
    addBtn.disabled = false;
  });

  return { el, refresh };
}

export function buildSystemPanel() {

  const idBlock = document.createElement('div');
  idBlock.className = 'sys-id';

  // and the light/dark choices are the Campaign's desk — components on the #/campaign
  // Desk profile surface — and a choice has one home, not two. "Dark on the Mac, light
  // are two Machine Settings rows, one per surface kind. The desk profile picker
  // stays: it is the same leaf ⚙ always wrote.
  // ⚙ THE MACHINE — the detail behind the header gauge, drawn only when the machine
  // service is installed. Null when it is not: no empty box explaining its own absence.
  const machineBlock = buildMachinePanel();

  const profBlock = document.createElement('div');
  profBlock.className = 'sys-skins';
  const profLab = document.createElement('span');
  profLab.className = 'sys-theme-lbl';
  profLab.textContent = t('desk_profile', 'desk profile');
  const profList = document.createElement('div');
  profList.className = 'sys-skinlist';
  profBlock.append(profLab, profList);
  const paintProfiles = () => {
    profList.innerHTML = '';
    const chosen = activeProfile()?.name || '';
    profLab.textContent = t('desk_profile', 'desk profile'); // re-read: a pick may have changed the words
    const rows = [{ name: '', label: t('desk.profile_stock', 'Stock'), blurb: t('desk.profile_stock_blurb', 'No profile — the look, the words and the tile as shipped.') }, ...deskProfiles()];
    for (const p of rows) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'sys-skin' + (p.name === chosen ? ' on' : '');
      const nm = document.createElement('b');
      nm.textContent = p.label;
      if (p.origin === 'user') {
        const mark = document.createElement('i');
        mark.className = 'sys-skin-mine';
        mark.textContent = p.shadowed ? t('desk.yours_shadowing', 'yours (replaces ours)') : t('desk.yours', 'yours');
        nm.appendChild(mark);
      }
      const why = document.createElement('small');
      why.textContent = p.blurb;
      row.append(nm, why);
      row.addEventListener('click', async () => {
        const r = await setDeskProfile(p.name);
        if (!r.ok) { say(t('desk.profile_not_saved', 'desk profile not saved — {message}', { message: r.message })); return; }
        await followProfileSkin(activeProfile()?.skin || '');
        paintProfiles();
      });
      profList.appendChild(row);
    }
  };

  const row = document.createElement('div');
  row.className = 'sys-actions';
  const checkBtn = button(t('desk.check_updates', 'Check for updates'), {
    title: t('desk.check_updates_title', 'Ask the release feeds what the latest versions are — both packages, only when pressed'),
  });
  const runBtn = button(t('release.update_cowork', 'Update Cowork'), { cls: 'sys-run' });
  runBtn.disabled = true;
  runBtn.hidden = true;
  // does it. Same updater underneath (--services): fetch, verify, CONTRACT CHECK
  // against the running cowork, into the store, into the tree, restart. It appears
  // only when the check names an installable services release.
  const svcBtn = button(t('release.update_services', 'Update Services'), { cls: 'sys-run' });
  svcBtn.disabled = true;
  svcBtn.hidden = true;
  // LOG OUT — only drawn when a login exists (/api/health `login`), because a button
  // that answers "you were never logged in" is furniture. Clearing the cookie sends
  // the next navigation through /login; the reload makes that immediate and visible.
  const outBtn = button(t('desk.log_out', 'Log out'), {
    cls: 'sys-logout',
    title: t('desk.log_out_title', 'End this device’s session — the next visit asks for the password'),
  });
  outBtn.hidden = true;
  outBtn.addEventListener('click', async () => {
    outBtn.disabled = true;
    await request('/api/logout', { method: 'POST' });
    location.reload();
  });
  // The release's buttons; `outBtn` leaves this row for the account's — the split that
  // makes three nav rows possible. Nothing about what any of them DO changes.
  row.append(checkBtn, runBtn, svcBtn);
  const outRow = document.createElement('div');
  outRow.className = 'sys-actions';
  outRow.append(outBtn);

  const msg = status('sys-msg');
  const passkeys = buildPasskeyBlock();

  const group = (...kids) => {
    const g = document.createElement('div');
    g.className = 'sys';
    // A null child is a surface that decided not to draw itself (an absent service), and
    // dropping it here is what lets those decide locally instead of every caller asking.
    g.append(...kids.filter(Boolean));
    return g;
  };
  // — it HAS a skin — and a person hunting it should find it in the desk's nav.
  const profile = group(profBlock);
  // The machine sits with the release block — both answer "what is this install running
  // on", and a person hunting either finds them together. group() drops a null child, so
  // an install without the machine service simply has one fewer row here.
  const coworkReading = document.createElement('p');
  const servicesReading = document.createElement('p');
  const readings = group(coworkReading, servicesReading);
  readings.setAttribute('aria-live', 'polite');
  const release = group(idBlock, row, readings, msg.el, machineBlock);
  const account = group(outRow, passkeys.el);

  let version = null; // the operator's /api/version answer, fetched on open

  const say = (text, bad) => msg.say(text, bad ? 'bad' : '');

  let identityKey;
  const renderId = () => {
    const key = JSON.stringify(version);
    if (key === identityKey) return;
    identityKey = key;
    idBlock.innerHTML = '';
    const name = document.createElement('div');
    name.className = 'sys-release';
    const detail = document.createElement('small');
    if (!version) {
      name.textContent = t('desk.unreachable', 'unreachable');
      detail.textContent = t('desk.no_version_answer', 'the operator did not answer /api/version');
    } else if (version.release) {
      name.textContent = version.release;
      detail.textContent = t('desk.release_detail', 'release · built from {commit} · contract {contract} · started {started}', { commit: version.commit, contract: version.contract, started: version.startedAt });
    } else {
      name.textContent = version.commit + (version.dirty ? ' ' + t('desk.dirty', '(dirty)') : '');
      detail.textContent = t('desk.checkout_detail', 'a dev checkout, not a release — updated by git, not by the button · started {started}', { started: version.startedAt });
    }
    idBlock.append(name, detail);
    // The roster line: which services this operator discovered at start. The honest
    // absence reads as the free build, not as an error.
    const svc = document.createElement('small');
    svc.className = 'sys-services';
    const roster = Array.isArray(version?.services) ? version.services : [];
    svc.textContent = roster.length ? t('desk.services_list', 'services: {list}', { list: roster.join(' · ') }) : t('desk.services_none', 'services: none — the free build');
    idBlock.append(svc);
  };

  const updates = createReleaseUpdateController({ onChange: state => {
    version = state.version;
    renderId();
    checkBtn.setAttribute('aria-disabled', String(state.busy));
    for (const [pkg, control, reading] of [['cowork', runBtn, coworkReading], ['services', svcBtn, servicesReading]]) {
      const fact = packageReading(state.facts?.[pkg]);
      reading.textContent = `${pkg === 'cowork' ? 'Ronin Cowork' : 'Ronin Services'} — ${state.facts ? fact.text : 'Not checked'}`;
      control.hidden = !fact.available;
      control.disabled = !state.canUpdate || state.busy;
      control.title = !state.canUpdate ? (state.version?.commit ? 'Dev checkout — release updating is disabled' : 'Version unavailable') : '';
    }
    say(state.message, state.bad);
  }});
  checkBtn.addEventListener('click', () => void updates.check());
  runBtn.addEventListener('click', () => void updates.run('cowork'));
  svcBtn.addEventListener('click', () => void updates.run('services'));

  const enter = () => {
    // Re-read every time: a hand-edit to a profile file — or an upgrade that ships a new
    // one — is visible on the next visit to this room without a reload.
    void loadDeskProfile().then(paintProfiles, paintProfiles);
    say('');
    void (async () => {
      await updates.identify();
      const h = await request('/api/health', { cache: 'no-store' });
      // Both the logout button and the passkey block hang off the same fact: a login
      // exists on this install. Passkeys mint the SAME session cookie the password does
      // and are signed by the secret stored beside the password record (src/auth.ts), so
      // on a Basic-only box there is nothing for either control to act on.
      outBtn.hidden = !(h.ok && h.data.login);
      passkeys.el.hidden = outBtn.hidden;
      if (!passkeys.el.hidden) passkeys.refresh();
    })();
  };

  return { profile, release, account, enter };
}
