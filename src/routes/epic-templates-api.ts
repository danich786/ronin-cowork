/* /api/epic-templates — the `epic-template` tool's door (ronin_bin/epic-template; src/epic-templates.ts).
 * GET lists the templates; POST /:name/start makes the epic and its tasks through the item
 * functions, born held by the Agent named `to`, and tells it to walk the epic through. */
import type express from 'express';
import { listTemplates, startTemplate } from '../epic-templates.js';
import { answerError, callerOf } from './work-items-api.js';
import { changed, pushTeams } from '../ws/events.js';

const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;

export function registerEpicTemplates(app: express.Express): void {
  app.get('/api/epic-templates', async (_req, res) => {
    try {
      res.json({ ok: true, templates: (await listTemplates()).map(({ name, title, for: for_, order, origin, tasks }) => ({ name, title, for: for_, order, origin, tasks: tasks.map((task) => task.title) })) });
    } catch (error) { answerError(res, error); }
  });
  app.post('/api/epic-templates/:name/start', async (req, res) => {
    try {
      const by = callerOf(req);
      const started = await startTemplate(req.params.name!, { by, to: text(req.body?.to) ?? by, workspace: text(req.body?.workspace) });
      void pushTeams(); changed();
      res.json({ ok: true, ...started });
    } catch (error) { answerError(res, error); }
  });
}
