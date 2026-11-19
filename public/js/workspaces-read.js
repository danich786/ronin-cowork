/* part of the ronin-cowork client — see js/README.md */
import { request } from './request.js';

// EVERY LIST OF WORKSPACES ON THE PAGE HEARS EACH READ (KAN-724). A Workspace saved on its page
// reads the Workspaces again; New Team, seated on another bench, hears that read and reads its
// own list, so a Workspace just made is offered there without a reload. Nothing polls.
const heard = new Set();

/** The Workspaces of the Campaign a bench looks at: one read, every surface on the bench hears it. */
export function createWorkspacesRead(campaignId) {
  let workspaces = [];
  const listeners = new Set();
  return {
    list: () => workspaces,
    read: async () => {
      const query = campaignId() ? `?campaign_id=${encodeURIComponent(campaignId())}` : '';
      const answer = await request(`/api/workspaces${query}`, { cache: 'no-store' });
      if (answer.ok) workspaces = answer.data?.workspaces || [];
      for (const listener of [...listeners, ...heard]) listener(answer);
      return answer;
    },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

/** Hear every bench's Workspaces read on this page. Returns the unsubscribe. */
export function hearWorkspaces(listener) {
  heard.add(listener);
  return () => heard.delete(listener);
}
