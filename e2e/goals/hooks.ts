// The agent-side hooks the goal suite applies to each session, matching what the side panel
// does for its own sessions.
import { BROWSER_GUIDE, GUIDE_KEY } from '../../lib/browser/guidance';
import type { SessionHooks } from './runner';

export const GOAL_HOOKS: SessionHooks = {
  prepare: async (server, sessionID) => {
    await server.client.experimental.session.instructions.entry.put({ sessionID, key: GUIDE_KEY, value: BROWSER_GUIDE });
  },
};

/** How the report names the agent side in use. */
export const GOAL_HOOKS_LABEL = 'browser guide and session skill routing';
