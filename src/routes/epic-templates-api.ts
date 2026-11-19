/* /api/epic-templates — the `epic-template` tool's door (ronin_bin/epic-template; src/epic-templates.ts).
 * GET lists the templates (each task's title, and in `opens` the surface its Open line names, '' none); POST /:name/start makes the epic and its tasks through the item
 * functions, born held by the Agent named `to`, and tells it to walk the epic through. */
import type express from 'express';
import { listTemplates, startTemplate, taskOpens } from '../epic-templates.js';
import { answerError, callerOf } from './work-items-api.js';
import { pushTeams } from '../ws/events.js';

const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;

export function registerEpicTemplates(app: express.Express): void {
  app.get('/api/epic-templates', async (_req, res) => {
    try {
      res.json({ ok: true, templates: (await listTemplates()).map(({ name, title, for: for_, order, origin, tasks }) => ({ name, title, for: for_, order, origin, tasks: tasks.map((task) => task.title), opens: tasks.map(taskOpens) })) });
    } catch (error) { answerError(res, error); }
  });
  app.post('/api/epic-templates/:name/start', async (req, res) => {
    try {
      const by = callerOf(req);
      const started = await startTemplate(req.params.name!, { by, to: text(req.body?.to) ?? by, workspace: text(req.body?.workspace) });
      void pushTeams();
      res.json({ ok: true, ...started });
    } catch (error) { answerError(res, error); }
  });
}
