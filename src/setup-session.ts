import { createSession, setSessionIdentity, setTags } from './tmux.js';

export const PROVIDER_SETUP_TEAM = 'provider_setup';

export interface SetupSessionPrimitives {
  create(name: string, cwd: string, options: { agent: boolean; argv: string[] }): Promise<void>;
  tag(name: string, tags: string[]): Promise<void>;
  identify(name: string, identity: { sessionType: string; cli: string; provider: string; model: string }): Promise<void>;
}

/** One backend session shape for provider and GitHub installation, update, and sign-in. */
export async function createSetupSession(
  name: string,
  cli: string,
  cwd: string,
  options: { agent: boolean; argv: string[]; provider?: string },
  primitives: SetupSessionPrimitives = {
    create: createSession,
    tag: async (session, tags) => { await setTags(session, tags); },
    identify: setSessionIdentity,
  },
): Promise<void> {
  await primitives.create(name, cwd, { agent: options.agent, argv: options.argv });
  await primitives.tag(name, [PROVIDER_SETUP_TEAM]);
  await primitives.identify(name, { sessionType: 'provider_setup', cli, provider: options.provider || '', model: '' });
}

export function setupAttachment(session: string) {
  return { type: 'session' as const, key: session, team: PROVIDER_SETUP_TEAM, temporary: true as const } as const;
}
