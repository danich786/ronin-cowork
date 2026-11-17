/* part of the ronin-cowork client — see js/README.md */
import { subscribe } from './store.js';
import { serviceMissing } from './state.js';
import { t } from './lexicon.js';

const gb = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`);

const pct = (share) => Math.round(share * 100);

/**
 * HOW FULL THE MACHINE IS: the tightest of memory, CPU and disk (owner, 17 Nov: "we're
 * selling agents", not RAM). Memory counts RAM in use (total less MemAvailable, so page
 * cache is free) plus swap in use; CPU is the 5-minute load per core; disk is Ronin's home.
 */
export function occupancy(m) {
  const total = m.mem.total_mb || 1;
  const memory = Math.min(1, (total - Math.max(0, m.mem.available_mb) + (m.swap.used_mb || 0)) / total);
  const cpu = Math.min(1, m.load[1] / (m.cpus || 1));
  const disk = m.disk && m.disk.total_mb ? Math.min(1, m.disk.used_mb / m.disk.total_mb) : null;
  return { full: Math.max(memory, cpu, disk ?? 0), memory, cpu, disk };
}

function bandFor(full) {
  if (full >= 0.9) return 'red';
  if (full >= 0.6) return 'warn';
  return 'ok';
}

function render(el, m) {
  const o = occupancy(m);
  el.dataset.band = bandFor(o.full);
  const filled = Math.min(5, Math.ceil((o.full * 100) / 20));
  if (el.children.length !== 5) el.replaceChildren(...Array.from({ length: 5 }, () => document.createElement('i')));
  Array.from(el.children).forEach((seg, i) => seg.classList.toggle('on', i < filled));

  // The title carries the state and the detail; the face carries none.
  const total = m.mem.total_mb || 1;
  const used = Math.max(0, total - Math.max(0, m.mem.available_mb));
  const swap = m.swap.used_mb > 0 ? ' ' + t('gauge.swap_in_use', '(swap {used})', { used: gb(m.swap.used_mb) }) : '';
  const where = m.scope === 'container' ? ' ' + t('gauge.container_limit', '(container limit)') : '';
  const disk = o.disk === null ? '' : ' · ' + t('gauge.disk_share', 'disk {pct}%', { pct: pct(o.disk) });
  el.title = t('gauge.title', '{full}% full · memory {used} of {total}{swap}{where} · CPU {cpu}%{disk}',
    { full: pct(o.full), used: total >= 1024 ? (used / 1024).toFixed(1) : String(used), total: gb(total), swap, where, cpu: pct(o.cpu), disk });
  el.setAttribute('aria-label', el.title);
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
      row(t('gauge.full_label', 'Full'), `${pct(occupancy(m).full)}%`),
      row(t('gauge.ram_available', 'RAM available'), `${gb(Math.max(0, m.mem.available_mb))} ${t('gauge.free', 'free')}`),
      row(t('gauge.ram_total', 'RAM total'), `${gb(m.mem.total_mb)}${where}`),
      row(t('gauge.load', 'Load'), `${m.load[0]} ${t('gauge.on_cpus', 'on {cpus} CPUs', { cpus: m.cpus })}`),
      row(t('gauge.swap_label', 'Swap'), swap),
      ...(m.disk ? [row(t('gauge.disk_label', 'Disk'), t('gauge.swap_detail', '{used} of {total} used', { used: gb(m.disk.used_mb), total: gb(m.disk.total_mb) }))] : []),
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
  // The reading is the store's `memory`, pushed from connect and whenever it moves. The
  // last number stands until a new one arrives: a gauge that reads 0 says "the box is
  // dying", the one lie it must never tell. OFF is a real answer — the owner said do not
  // watch this box — and hides the gauge until the server says otherwise.
  subscribe('memory', (next) => {
    off = next.off === true;
    if (next.mem) reading = next;
    paint();
  });
  return { setVisible(next) { visible = next === true; paint(); } };
}
