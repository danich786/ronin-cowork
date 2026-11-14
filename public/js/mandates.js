/* part of the ronin-cowork client — see js/README.md */
/** THE MANDATE MENUS (BRIEF_MODEL §4): the listing is the files. Each Reach, Recruit and Output
 * value is a behaviour whose header says `mandate: <axis>`; /api/brief/catalog serves every one,
 * in `order:`, its `value` the title lower-cased. Every form reads its menus here, and no value
 * is listed by hand in the client: a file added is a value on the menu. A file a layer blocks,
 * or leaves out of its Only list, is off the menu below it (the preview's `off`, by file name). */
import { request } from './request.js';

export const AXES = ['reach', 'recruit', 'output'];
let rows = [];
let inflight = null;

/** Read the catalog's mandate files once per page; `force` reads again after a file is written. */
export function loadMandates({ force = false } = {}) {
  if (inflight && !force) return inflight;
  inflight = request('/api/brief/catalog', { cache: 'no-store' }).then((read) => {
    if (read.ok && Array.isArray(read.data)) setMandates(read.data);
    return rows;
  });
  return inflight;
}

/** Take the mandate files from a catalog the caller has already read. */
export function setMandates(catalog = []) {
  rows = catalog.filter((row) => AXES.includes(row.mandate))
    .map((row) => ({ axis: row.mandate, name: row.name, value: row.value || row.name, title: row.title || row.value || row.name, seed: row.seed || '' }));
}

/** One axis's menu as ask() rows, less what `screen` takes off: `{ block: [name] }` (screenOf). */
export function mandateRows(axis, screen = {}) {
  const block = screen.block || [];
  return rows.filter((row) => row.axis === axis && !block.includes(row.name))
    .map((row) => ({ v: row.value, l: row.title, sub: row.seed }));
}

/** What the layers in play take off, as the preview works it out (`{ team }`, `{ campaign_id }`
 *  or a New Agent draft): `{ block: [name] }` for mandateRows. */
export async function screenOf(body) {
  const read = await request('/api/brief/preview', { method: 'POST', json: body });
  return { block: read.ok && Array.isArray(read.data?.off) ? read.data.off : [] };
}

/** The word a person reads for a stored value: its file's title. */
export function mandateTitle(value) {
  return rows.find((row) => row.value === value)?.title || value;
}

/** The first value on an axis: the default a blank setting shows. */
export const firstMandate = (axis) => rows.find((row) => row.axis === axis)?.value || '';
