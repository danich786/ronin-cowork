/* part of the ronin-cowork client — see js/README.md */
import { subscribe } from './store.js';
import { serviceMissing } from './state.js';
import { request } from './request.js';
import { t } from './lexicon.js';

/** One Agent's share of RAM: max, when the office record names none (owner, 18 Nov). */
const AGENT_MB = 0.6 * 1024;

const pct = (share) => Math.round(share * 100);

/**
 * HOW FULL THE MACHINE IS, by part. Memory is RAM in use (total less MemAvailable, so page
 * cache is free) over RAM total; swap adds nothing (KAN-635). RAM is the real constraint, so
 * memory alone sets the face (KAN-640). CPU is the 5-minute load per core; disk is Ronin's home.
 */
export function occupancy(m) {
  const total = m.mem.total_mb || 1;
  const memory = Math.min(1, Math.max(0, total - Math.max(0, m.mem.available_mb)) / total);
  const cpu = Math.min(1, m.load[1] / (m.cpus || 1));
  const disk = m.disk && m.disk.total_mb ? Math.min(1, m.disk.used_mb / m.disk.total_mb) : null;
  return { full: memory, memory, cpu, disk };
}

/**
 * The popup's rows (KAN-638), label, value and share: Agents "12 of 25", Compute "40%",
 * Storage "12 of 80 GB". 12 is Agents running now (as /api/health presence.agents.live); 25
 * is the office record's agents.most, else RAM total in 0.6 GB. The share fills the row's bar.
 */
export function lines(m, live, most = null) {
  const max = most ?? Math.floor((m.mem.total_mb || 0) / AGENT_MB);
  const o = occupancy(m);
  return [
    [t('gauge.agents', 'Agents'), t('gauge.agents_of', '{live} of {max}', { live, max }), max ? Math.min(1, live / max) : 0],
    [t('gauge.compute', 'Compute'), `${pct(o.cpu)}%`, o.cpu],
    ...(o.disk !== null ? [[t('gauge.storage', 'Storage'),
      t('gauge.storage_of', '{used} of {total} GB', { used: Math.round(m.disk.used_mb / 1024), total: Math.round(m.disk.total_mb / 1024) }), o.disk]] : []),
  ];
}

function bandFor(full) {
  if (full >= 0.9) return 'red';
  if (full >= 0.6) return 'warn';
  return 'ok';
}

/** The five segments, filled to `share` and coloured by its band: the face and each row's bar. */
function segments(el, share) {
  el.dataset.band = bandFor(share);
  const filled = Math.min(5, Math.ceil((share * 100) / 20));
  if (el.children.length !== 5) el.replaceChildren(...Array.from({ length: 5 }, () => document.createElement('i')));
  Array.from(el.children).forEach((seg, i) => seg.classList.toggle('on', i < filled));
}

function render(el, m, said) {
  segments(el, occupancy(m).full);
  // The face carries no words; the title and aria label say the popup's lines.
  el.title = said.map(([label, value]) => `${label} ${value}`).join(' · ');
  el.setAttribute('aria-label', el.title);
}

function details() {
  const pop = document.createElement('div');
  pop.className = 'ramrpm-pop';
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', t('gauge.details', 'How full this office is'));
  const paint = (said) => {
    pop.replaceChildren(...said.map(([label, value, share]) => {
      const line = document.createElement('p');
      const term = document.createElement('strong'); term.textContent = label;
      const reading = document.createElement('span'); reading.textContent = value;
      const bar = document.createElement('b'); bar.className = 'ramrpm-bar'; bar.setAttribute('aria-hidden', 'true');
      segments(bar, share);
      line.append(term, reading, bar);
      return line;
    }));
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
  let live = 0;
  // The office record's agents.most (GET /api/office, as the Office section reads it), asked
  // once: Cloud writes it at provisioning and it does not move. Self-hosted: none.
  let most = null;
  const detail = details();
  document.body.append(detail.pop);
  const close = () => { detail.pop.hidden = true; el.setAttribute('aria-expanded', 'false'); };
  el.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!detail.pop.hidden) { close(); return; }
    const rect = el.getBoundingClientRect();
    detail.pop.hidden = false;
    detail.pop.style.top = `${rect.bottom + 8}px`;
    // Right-aligned under the gauge, but never off the left edge (a phone, KAN-640).
    const width = detail.pop.offsetWidth;
    detail.pop.style.right = `${Math.max(8, Math.min(window.innerWidth - rect.right, window.innerWidth - width - 8))}px`;
    el.setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('click', (event) => { if (!detail.pop.contains(event.target)) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  const paint = () => {
    el.hidden = !visible || off || !reading;
    if (!el.hidden) { const said = lines(reading, live, most); render(el, reading, said); detail.paint(said); }
    else close();
  };
  request('/api/office', { cache: 'no-store' }).then((r) => {
    most = (r.ok && r.data?.hosting === 'office_unit' && r.data.record.agents?.most) || null;
    paint();
  });
  // current: the pushed session list's Agents, counted as presence.agents.live counts them.
  subscribe('sessions', (list) => { live = list.filter((s) => s.agent).length; paint(); });
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
