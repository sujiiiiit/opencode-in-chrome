// Pure: read by the timeline, which must not pull in the client.

/**
 * Where a goal's work enters the conversation. The goal plugin writes a synthetic message for each
 * (`metadata: { source: "goal", goalID }`): the kickoff, with a `Goal: …` description (or, when the
 * `/goal` carried attachments, a user message with the same metadata), then one continuation per
 * round the reviewer sent back, whose text carries its verdict. They are not the reader's
 * messages, so the chat shows them as markers: the kickoff starts a goal turn, a round a divider.
 */
export type GoalMarker =
  | { kind: 'start'; id: string; goalID: string; objective: string }
  | { kind: 'round'; id: string; goalID: string; reason?: string; resumed: boolean };

const OBJECTIVE = /<untrusted_objective>\n?([\s\S]*?)\n?<\/untrusted_objective>/;
const KICKOFF = /^A goal is now active/;
const RESUMED = 'The user resumed the goal.';
/** Where a continuation's fixed instructions start, after the reviewer's feedback. */
const INSTRUCTIONS = /\n\s*Take the next concrete step/;

const unescapeObjective = (text: string) => text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

type GoalMessage = { text: string; description?: string; goalID: string };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The parts of a message the goal plugin wrote; null for any other message. */
function goalMessage(message: unknown): GoalMessage | null {
  if (!isObject(message) || !isObject(message.metadata)) return null;
  const { source, goalID } = message.metadata;
  if (source !== 'goal' || typeof goalID !== 'string' || typeof message.text !== 'string') return null;
  return { text: message.text, goalID, ...(typeof message.description === 'string' ? { description: message.description } : {}) };
}

/** A kickoff's objective: the text between its objective tags, else its `Goal: …` description. */
function kickoffObjective(message: GoalMessage): string {
  const objective = OBJECTIVE.exec(message.text)?.[1];
  if (objective) return unescapeObjective(objective).trim();
  return message.description?.replace(/^Goal:\s*/, '') ?? '';
}

/** A continuation's feedback (the reviewer's reason, then its next step), between the objective and the fixed instructions. */
function roundFeedback(text: string): string {
  const objective = OBJECTIVE.exec(text);
  const after = objective ? text.slice(objective.index + objective[0].length) : '';
  return after.split(INSTRUCTIONS)[0]!.trim();
}

/** The goal marker a synthetic (or user) message is, from its text and metadata; null when it is not one. */
export function goalMarker(id: string, message: unknown): GoalMarker | null {
  const goal = goalMessage(message);
  if (!goal) return null;
  if (goal.description !== undefined || KICKOFF.test(goal.text)) return { kind: 'start', id, goalID: goal.goalID, objective: kickoffObjective(goal) };
  const feedback = roundFeedback(goal.text);
  const resumed = feedback.includes(RESUMED);
  const reason = resumed ? undefined : feedback.split('\n')[0]?.trim();
  return { kind: 'round', id, goalID: goal.goalID, ...(reason ? { reason } : {}), resumed };
}
