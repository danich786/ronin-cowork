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
