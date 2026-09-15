import { listWays, wayFile } from './resources.js';

export interface DeliveredBehaviour {
  book: string;
  file: string;
}

export interface ResolvedBehaviours {
  delivered: DeliveredBehaviour[];
  ignored: string[];
}

export async function resolveBehaviourBooks(input: readonly string[]): Promise<ResolvedBehaviours> {
  const ways = new Map((await listWays()).map((row) => [row.name, row.origin]));
  const delivered: DeliveredBehaviour[] = [];
  const ignored: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const book = String(raw).trim();
    if (!book || seen.has(book)) continue;
    seen.add(book);
    const name = book.replace(/^ways:/, '');
    // `mandates` was an elective behaviour before 2026-09-15. It is now part of
    // every Cowork Agent's base reading, so tolerate the old token without
    // delivering or reporting it as a selectable behaviour.
    if (name === 'mandates') continue;
    const resolved = ways.get(name);
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(name) || !resolved) {
      ignored.push(`behaviours[${book || String(raw)}]`);
      continue;
    }
    const file = await wayFile(name, resolved);
    delivered.push({ book, file });
  }
  return { delivered, ignored: ignored.sort() };
}

/** A canonical behaviour whose application scope is the Cowork Agent floor, not a selection. */
export async function resolveFloorBehaviour(name: string): Promise<DeliveredBehaviour | null> {
  const way = (await listWays()).find((row) => row.name === name);
  return way ? { book: name, file: await wayFile(name, way.origin) } : null;
}
