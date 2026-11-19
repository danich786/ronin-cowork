/**
 * EPIC TEMPLATES (owner, 2026-11-15; KAN-557). A template is one file in `epic_templates/`:
 * stock in ronin_catalogs, the person's own in ~/ronin/epic_templates/ over stock by name.
 * Adding a template is adding a file; nothing else names them.
 *
 *   # <the epic's title>
 *   - **for:** when it is started, a few words
 *   - **order:** 10
 *
 *   <the epic's text: its objective, what the Agent is told to do>
 *
 *   ## <a task's title>
 *   Do: …
 *   Details: …
 *   Check: …
 *   Open: `setup.providers`   (optional: the surface the Agent opens with `show` for it; KAN-692)
 *
 *   ### <a subtask of that task>
 *   Do: … Details: … Check: …
 *
 * A template never names an item id: an Agent finds the tasks as the epic's children, by title.
 * Starting one makes the epic, its tasks in order and their subtasks through the item functions
 * (never the store), each born held by the receiving Agent, and tells it one line: walk this
 * epic through. With no receiver (the hosted front door, before Mika is born) they are made
 * unheld and the caller hands them on.
 */
import path from 'node:path';
import { STOCK_DIR, entryValue, isKeyLine, resolveFiles, rootDir } from './resources.js';
import { createItem, WorkItemBadInput, WorkItemMissing, type Holder } from './work-items.js';
import { enqueueMessage } from './message-queue.js';

export interface TemplateTask { title: string; objective: string; subtasks: Array<{ title: string; objective: string }> }
/** A task's `Open:` line: the surface the Agent opens with `show` for it, '' when it names none (KAN-692, KAN-696). */
export const taskOpens = (task: Pick<TemplateTask, 'objective'>): string => /^Open:\s*`([^`]+)`/m.exec(task.objective)?.[1] ?? '';
export interface EpicTemplate { name: string; title: string; for: string; order: number; objective: string; tasks: TemplateTask[]; origin: 'stock' | 'user' }

export const stockTemplatesDir = (): string => path.join(STOCK_DIR, 'epic_templates');
export const userTemplatesDir = (): string => path.join(rootDir('user'), 'epic_templates');

/** One template file: the title, its header, the epic's text up to the first `## `, then each
 * `## ` task with its text and the `### ` subtasks under it. */
export function parseTemplate(name: string, source: string): Omit<EpicTemplate, 'origin'> {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let at = 0;
  while (at < lines.length && !lines[at]!.trim()) at++;
  const title = /^#\s+(.+?)\s*$/.exec(lines[at] ?? '')?.[1] ?? name;
  if (/^#\s/.test(lines[at] ?? '')) at++;
  while (at < lines.length && !lines[at]!.trim()) at++;
  const header: string[] = [];
  while (at < lines.length && isKeyLine(lines[at]!)) header.push(lines[at++]!);
  type Part = { title: string; body: string[] };
  const epic: string[] = [];
  const tasks: Array<Part & { subtasks: Part[] }> = [];
  let into = epic;
  for (const line of lines.slice(at)) {
    const heading = /^(##|###)\s+(.+?)\s*$/.exec(line);
    if (heading?.[1] === '##') { tasks.push({ title: heading[2]!, body: [], subtasks: [] }); into = tasks.at(-1)!.body; continue; }
    if (heading?.[1] === '###' && tasks.length) { const sub = { title: heading[2]!, body: [] }; tasks.at(-1)!.subtasks.push(sub); into = sub.body; continue; }
    into.push(line);
  }
  const text = (body: string[]): string => body.join('\n').trim();
  return {
    name, title, for: entryValue(header, 'for'), order: Number(entryValue(header, 'order')) || 9999,
    objective: text(epic),
    tasks: tasks.map((task) => ({ title: task.title, objective: text(task.body), subtasks: task.subtasks.map((sub) => ({ title: sub.title, objective: text(sub.body) })) })),
  };
}

/** Every template, the person's own over stock by name, in `order:`. */
export async function listTemplates(): Promise<EpicTemplate[]> {
  const files = await resolveFiles({ stock: stockTemplatesDir(), user: userTemplatesDir(), include: (file) => file.endsWith('.md') && file !== 'README.md' });
  return files.map((file) => ({ ...parseTemplate(file.name, file.text), origin: file.origin }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function readTemplate(name: string): Promise<EpicTemplate> {
  const found = (await listTemplates()).find((one) => one.name === name);
  if (!found) throw new WorkItemMissing(`No epic template "${name}"; epic-template list shows them.`);
  return found;
}

/** The one line the receiving Agent is told. */
export const walkLine = (id: string, title: string, workspace?: string): string =>
  `Walk this epic through: ${id} '${title}'${workspace ? `, in the Workspace ${workspace}` : ''}. Read it (\`item read ${id}\`); its tasks are its children.`;

export interface StartOptions { by: string; to?: string; workspace?: string }
export interface Started { epic: string; tasks: string[]; told?: string }

/** Make the epic and its tasks from a template; with `to`, each is born held by that Agent and
 * it is told to walk the epic through. The Workspace, when named, is the epic's last line. */
export async function startTemplate(name: string, opts: StartOptions): Promise<Started> {
  const template = await readTemplate(name);
  if (!template.tasks.length) throw new WorkItemBadInput(`The epic template "${name}" has no tasks (## <title>).`);
  const holder: Holder | undefined = opts.to ? { kind: 'agent', name: opts.to } : undefined;
  const objective = opts.workspace ? `${template.objective}\nWorkspace: ${opts.workspace}` : template.objective;
  const { item: epic } = await createItem({ title: template.title, objective, kind: 'Epic', ...(holder ? { holder } : {}) }, opts.by);
  const tasks: string[] = [];
  for (const task of template.tasks) {
    const { item } = await createItem({ title: task.title, objective: task.objective, kind: 'Task', parent: epic.id, ...(holder ? { holder } : {}) }, opts.by);
    tasks.push(item.id);
    for (const sub of task.subtasks) tasks.push((await createItem({ title: sub.title, objective: sub.objective, kind: 'Subtask', parent: item.id, ...(holder ? { holder } : {}) }, opts.by)).item.id);
  }
  if (!opts.to) return { epic: epic.id, tasks };
  const told = walkLine(epic.id, epic.title, opts.workspace);
  if (opts.to !== opts.by) await enqueueMessage(opts.to, told, 'house', 'Epic templates', null, { when: 'ready' });
  return { epic: epic.id, tasks, told };
}
