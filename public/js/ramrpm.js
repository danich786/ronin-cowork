/* part of the ronin-cowork client — see js/README.md */
import { request } from './request.js';
import { serviceMissing } from './state.js';
import { t } from './lexicon.js';

const POLL_MS = 60_000;
const gb = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`);

/** Headroom, not usage: the share of memory a new allocation could still get. */
function bandFor(freeShare) {
  if (freeShare < 0.10) return 'red';
  if (freeShare < 0.25) return 'warn';
  return 'ok';
}

function render(el, m) {
  const total = m.mem.total_mb || 1;
  const free = Math.max(0, m.mem.available_mb);
  const share = free / total;
  el.dataset.band = bandFor(share);
  el.textContent = gb(free);

  // The title carries what the face cannot. Kept short: the help box is a FIXED
  // rectangle and a long label spills out of it (scripts/check-tips.mjs).
  const swap = m.swap.total_mb === 0 ? t('gauge.no_swap', 'no swap') : t('gauge.swap', 'swap {used}', { used: gb(m.swap.used_mb) });
  const where = m.scope === 'container' ? ' ' + t('gauge.container_limit', '(container limit)') : '';
  el.title = t('gauge.ram_title', 'RAM_RPM — {free} free of {total}{where} · load {load} on {cpus} · {swap}', { free: gb(free), total: gb(total), where, load: m.load[0], cpus: m.cpus, swap });
}

function details() {
  const pop = document.createElement('div');
  pop.className = 'ramrpm-pop';
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', t('gauge.ram_details', 'Machine memory'));
  const row = (label, value) => {
    const line = document.createElement('p');
    const term = document.createElement('strong'); term.textContent = label;
    const reading = document.createElement('span'); reading.textContent = value;
    line.append(term, reading);
    return line;
  };
  const paint = (m) => {
    const where = m.scope === 'container' ? ` ${t('gauge.container_limit', '(container limit)')}` : '';
    const swap = m.swap.total_mb === 0
      ? t('gauge.no_swap', 'no swap')
      : t('gauge.swap_detail', '{used} of {total} used', { used: gb(m.swap.used_mb), total: gb(m.swap.total_mb) });
    pop.replaceChildren(
      row(t('gauge.ram_available', 'RAM available'), `${gb(Math.max(0, m.mem.available_mb))} ${t('gauge.free', 'free')}`),
      row(t('gauge.ram_total', 'RAM total'), `${gb(m.mem.total_mb)}${where}`),
      row(t('gauge.load', 'Load'), `${m.load[0]} ${t('gauge.on_cpus', 'on {cpus} CPUs', { cpus: m.cpus })}`),
      row(t('gauge.swap_label', 'Swap'), swap),
    );
  };
  return { pop, paint };
}

export function mountRamRpm() {
  const el = document.getElementById('ramrpm');
  const unavailable = { setVisible() {} };
  if (!el) return unavailable;
  // THE SWITCH, client half. Machine administration is a SERVICES capability, so on the
  // free build there is no /api/machine to ask — draw nothing rather than fetch into a
  if (serviceMissing('machine')) return unavailable;

  let timer = null;
  let visible = false;
  let reading = null;
  let off = false;
  const detail = details();
  document.body.append(detail.pop);
  const close = () => { detail.pop.hidden = true; el.setAttribute('aria-expanded', 'false'); };
  el.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!detail.pop.hidden) { close(); return; }
    const rect = el.getBoundingClientRect();
    detail.pop.hidden = false;
    detail.pop.style.top = `${rect.bottom + 8}px`;
    detail.pop.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    el.setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('click', (event) => { if (!detail.pop.contains(event.target)) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  const paint = () => {
    el.hidden = !visible || off || !reading;
    if (!el.hidden) { render(el, reading); detail.paint(reading); }
    else close();
  };
  const read = async () => {
    const r = await request('/api/machine', { cache: 'no-store' });
    // A failed read LEAVES THE LAST NUMBER STANDING rather than blanking or zeroing.
    // A gauge that reads 0 on a network blip says "the box is dying" — the one lie it
    // must never tell. Staleness is the honest failure here, not alarm.
    // OFF is a real answer, not a failure: the owner said do not watch this box. Hide
    // the gauge and STOP asking — a poll that keeps running after being switched off is
    // the switch not working, whatever the face shows.
    if (r && r.ok && r.data && r.data.off) { off = true; paint(); stop(); return; }
    if (r && r.ok && r.data && r.data.mem) { reading = r.data; paint(); }
  };

  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const start = () => { if (!timer) { void read(); timer = setInterval(() => void read(), POLL_MS); } };

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if (!document.hidden) start();
  return { setVisible(next) { visible = next === true; paint(); } };
}
