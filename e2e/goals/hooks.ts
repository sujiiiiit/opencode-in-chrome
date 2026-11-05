// The agent-side hooks the goal suite applies to each session, matching what the side panel
// does for its own sessions. Empty until the guidance and end-of-turn note exist (change
// add-autonomous-browsing groups 3 and 6); the baseline run uses none.
import type { SessionHooks } from './runner';

export const GOAL_HOOKS: SessionHooks = {};

/** How the report names the agent side in use. */
export const GOAL_HOOKS_LABEL = 'none (baseline)';
