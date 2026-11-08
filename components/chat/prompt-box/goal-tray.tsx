import { memo, useState } from 'react';
import type { Goal, GoalAction } from '@/lib/opencode/goal';
import { TrayAction, TrayRow } from './composer-tray';

type Props = {
  /** The session's goal; null or a met goal folds the row away (showing the last one meanwhile). */
  goal: Goal | null;
  /** Why the last action failed; shown in place of the objective until the next one. */
  notice?: string | null;
  onAction: (action: GoalAction) => void;
};

/** Whether the goal row shows: a met goal folds away, so the tray only shows work still going on. */
export const showsGoal = (goal: Goal | null): goal is Goal => !!goal && goal.status !== 'complete';

const LABEL: Record<Goal['status'], string> = { active: 'Goal', paused: 'Goal paused', complete: 'Goal met' };

/**
 * The session's `/goal` as a tray row: its status, the objective (opening the full objective and
 * the reviewer's last reason), and the actions that apply. The agent's continuations are not shown
 * in the chat, so this is what tells the reader the loop is running and how to stop it.
 */
export const GoalRow = memo(function GoalRow({ goal, notice, onAction }: Props) {
  // The last goal stays on screen while the row folds away after a clear.
  const [last, setLast] = useState(goal);
  if (goal && goal !== last) setLast(goal);
  const shown = goal ?? last;
  if (!shown) return null;
  return (
    <TrayRow
      shown={showsGoal(goal)}
      icon="goal"
      label={LABEL[shown.status]}
      text={notice ? <span role="alert" className="text-text-primary">{notice}</span> : shown.objective}
      detailsLabel="Show goal"
      details={
        <>
          <p className="whitespace-pre-wrap text-text-primary">{shown.objective}</p>
          {shown.reason && <p className="mt-2 whitespace-pre-wrap">{shown.reason}</p>}
          {/* `rounds` counts the times the reviewer sent the agent back to keep going (none yet on a
              fresh goal); the goal pauses itself once it reaches `maxRounds`. */}
          {shown.rounds > 0 && shown.maxRounds > 0 && (
            <p className="mt-2 text-text-tertiary">Continued {shown.rounds} of {shown.maxRounds} times</p>
          )}
        </>
      }
      actions={
        <>
          {shown.status === 'active' && <TrayAction icon="pause-solid" label="Pause goal" onClick={() => onAction('pause')} />}
          {shown.status === 'paused' && <TrayAction icon="play-solid" label="Resume goal" onClick={() => onAction('resume')} />}
          <TrayAction icon="close" label="Cancel goal" onClick={() => onAction('clear')} />
        </>
      }
    />
  );
});
