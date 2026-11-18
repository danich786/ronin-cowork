/* part of the ronin-cowork client — see js/README.md */
import { subscribe } from './store.js';
import { serviceMissing } from './state.js';
import { request } from './request.js';
import { t } from './lexicon.js';

/** One Agent's share of RAM: the gauge's unit (owner, 18 Nov). */
const AGENT_MB = 0.6 * 1024;

const pct = (share) => Math.round(share * 100);

/**
 * THE GAUGE IN AGENTS, NOT RAM (owner, 18 Nov, KAN-637): members buy Agents, so the face
 * shows no GB of RAM, swap or load; their Agents read the detail from the machine reading.
 * Agents is RAM in use (total less MemAvailable; swap not counted) in 0.6 GB slots. Compute
 * is the 5-minute load per core, capped at 100%. Storage is Ronin's home disk. `kind` is
 * the office record's `agents: { fewest, most }` (null self-hosted): the floor and ceiling
 * marks, and the point past which the fill turns orange; red is 90% of RAM either way.
 */
export function occupancy(m, kind = null) {
  const total = m.mem.total_mb || 1;
  const used = Math.min(total, Math.max(0, total - Math.max(0, m.mem.available_mb)));
  const slots = Math.max(1, Math.floor(total / AGENT_MB));
  const inUse = Math.min(slots, Math.round(used / AGENT_MB));
  const room = Math.max(0, Math.floor((0.9 * total) / AGENT_MB) - inUse);
  const memory = used / total;
  const cpu = Math.min(1, m.load[1] / (m.cpus || 1));
  const disk = m.disk && m.disk.total_mb ? Math.min(1, m.disk.used_mb / m.disk.total_mb) : null;
  const band = memory >= 0.9 ? 'red' : kind && used > kind.most * AGENT_MB ? 'warn' : 'ok';
  const closest = memory >= cpu && memory >= (disk ?? 0) ? 'agents' : cpu >= (disk ?? 0) ? 'compute' : 'storage';
  return { total, used, slots, inUse, room, memory, cpu, disk, band, closest };
}

/** The words the popup, title and aria label share. */
function words(m, o) {
  const name = { agents: t('gauge.agents', 'Agents'), compute: t('gauge.compute', 'Compute'), storage: t('gauge.storage', 'Storage') };
  const storage = m.disk && m.disk.total_mb
    ? t('gauge.storage_of', '{used} of {total} GB', { used: Math.round(m.disk.used_mb / 1024), total: Math.round(m.disk.total_mb / 1024) })
    : null;
  return {
    name,
    agents: t('gauge.agents_room', 'Room for about {room} more Agents ({used} of {slots} in use)', { room: o.room, used: o.inUse, slots: o.slots }),
    compute: `${pct(o.cpu)}%`,
    storage,
    closest: name[o.closest],
  };
}

function render(el, m, kind) {
  const o = occupancy(m, kind);
  const w = words(m, o);
  el.dataset.band = o.band;
  const bar = document.createElement('span');
  bar.className = 'ramrpm-bar';
  // One thin line per 0.6 GB: the bar is all of RAM, so each slot is AGENT_MB of it.
  bar.style.backgroundSize = `${(AGENT_MB / o.total) * 100}% 100%`;
  const fill = document.createElement('span');
  fill.className = 'ramrpm-fill';
  fill.style.width = `${pct(o.memory)}%`;
  bar.append(fill);
  if (kind) {
    for (const n of [kind.fewest, kind.most]) {
      const mark = document.createElement('span');
      mark.className = 'ramrpm-mark';
      mark.style.left = `${Math.min(100, ((n * AGENT_MB) / o.total) * 100)}%`;
      bar.append(mark);
    }
  }
  // Compute and Storage carry `ramrpm-more`: at phone width they go, and the popup says them.
  const part = (text, more) => { const s = document.createElement('span'); s.className = more ? 'ramrpm-more' : 'ramrpm-part'; s.textContent = text; return s; };
  el.replaceChildren(
    part(w.name.agents), bar,
    part(`${w.name.compute} ${w.compute}`, true),
    ...(w.storage ? [part(`${w.name.storage} ${w.storage}`, true)] : []),
  );
  el.title = [w.agents, `${w.name.compute} ${w.compute}`, ...(w.storage ? [`${w.name.storage} ${w.storage}`] : []),
    `${t('gauge.closest', 'Closest to full')}: ${w.closest}`].join(' · ');
  el.setAttribute('aria-label', el.title);
}

function details() {
  const pop = document.createElement('div');
  pop.className = 'ramrpm-pop';
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', t('gauge.details', 'How full this office is'));
  const row = (label, value) => {
    const line = document.createElement('p');
    const term = document.createElement('strong'); term.textContent = label;
    const reading = document.createElement('span'); reading.textContent = value;
    line.append(term, reading);
    return line;
  };
  const paint = (m, kind) => {
    const w = words(m, occupancy(m, kind));
    pop.replaceChildren(
      row(w.name.agents, w.agents),
      row(w.name.compute, w.compute),
      ...(w.storage ? [row(w.name.storage, w.storage)] : []),
      row(t('gauge.closest', 'Closest to full'), w.closest),
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
  // The kind's floor and ceiling, from the office record (GET /api/office, as the Office
  // section reads it), asked once: Cloud writes it at provisioning and it does not move.
  let kind = null;
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
    if (!el.hidden) { render(el, reading, kind); detail.paint(reading, kind); }
    else close();
  };
  request('/api/office', { cache: 'no-store' }).then((r) => {
    const agents = r.ok && r.data?.hosting === 'office_unit' ? r.data.record.agents : null;
    kind = agents || null;
    paint();
  });
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
