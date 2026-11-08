// Background subagents, as opencode runs them. A subagent call started with `background: true`, or
// moved there while it ran (POST /session/:id/background), returns at once: the tool call completes
// with `metadata.status: "running"` while the child session keeps working. When the child ends,
// the server admits a synthetic inbox item into the parent (metadata `source: "subagent"`, its
// `childID`, `agent` and outcome `state`), which wakes the parent: the main agent replies again.
import { isRecord, replyParts, type ReplyState, type ReplyToolPart } from './reply';

export type NoticeState = 'completed' | 'error' | 'cancelled';

/** A background subagent's completion, where the reply picked up again. */
export type BackgroundNotice = {
  id: string;
  childID: string;
  state: NoticeState;
};

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);
const noticeState = (v: unknown): NoticeState => (v === 'error' || v === 'cancelled' ? v : 'completed');

/**
 * A subagent completion from a synthetic item: an inbox item's `payload`, or a `synthetic`
 * message in the history (both carry `description` and `metadata`). Anything else is null.
 */
export function subagentNotice(id: string, source: unknown): BackgroundNotice | null {
  if (!isRecord(source) || !isRecord(source.metadata)) return null;
  const metadata = source.metadata;
  const childID = str(metadata.childID);
  if (metadata.source !== 'subagent' || !childID) return null;
  return { id, childID, state: noticeState(metadata.state) };
}

const AGENT_TOOLS = new Set(['subagent', 'task', 'agent']);

export const isAgentTool = (part: ReplyToolPart) => AGENT_TOOLS.has(part.name);

/** The child session an agent call runs in, once the server reports it. */
export function agentSessionID(part: ReplyToolPart): string | undefined {
  if (!isAgentTool(part)) return undefined;
  return str(part.metadata.sessionID) ?? str(part.metadata.sessionId) ?? str(part.metadata.session_id);
}

/** An agent call that returned while its subagent went on in the background. */
export const isBackgroundCall = (part: ReplyToolPart) =>
  isAgentTool(part) && part.status === 'completed' && part.metadata.status === 'running';

/**
 * The running reply is waiting on this subagent: its call to `childID` is still executing in the
 * foreground, so it can move to the background (POST /session/:id/background).
 */
export function foregroundAgent(reply: ReplyState | undefined, childID: string): boolean {
  if (reply?.status !== 'running') return false;
  return replyParts(reply).some((part) => part.kind === 'tool' && part.status === 'running' && agentSessionID(part) === childID);
}
