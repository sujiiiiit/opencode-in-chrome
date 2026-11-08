import { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AnimatedDoodle, Doodle, DOODLE_NAMES, type DoodleName } from '@/components/ui/doodle';
import { Icon } from '@/components/ui/icon';
import { useTextColor } from '@/components/ui/use-text-color';
import { agentSessionID } from '@/lib/opencode/background';
import type { ReplyToolPart } from '@/lib/opencode/reply';
import { agentLabel, agentState, toolSubject } from '@/lib/opencode/tool-info';
import { useBackground } from './background';
import { MorphText } from './morph-text';
import { useSubagentNavigation } from '../subagent-tabs';

// The drawings fill 84% of their box, so 20px reads about as tall as the squiggle reads wide.
const DOODLE_SIZE = 20;
// Its lines come out about 0.6px at that size; thickened a touch so they read as light as the squiggle.
const DOODLE_WEIGHT = 0.2;

/**
 * The doodles in turn, by the call's place among the reply's subagents: neighbours always differ,
 * and the reply's calls load in the same order, so each keeps its doodle after a refresh.
 */
const doodleAt = (index: number): DoodleName => DOODLE_NAMES[index % DOODLE_NAMES.length]!;

/**
 * The agent's doodle, acting out its story while it works and still once it is done. The canvas
 * paints with a literal colour, so the text colour (the work spinner's) is read from the box
 * first, as the squiggle does. It sits where the squiggle sits in the work group's header, so the
 * rows' words line up with the header's.
 */
function AgentDoodle({ index, running }: { index: number; running: boolean }) {
  const [box, color] = useTextColor<HTMLSpanElement>();
  const Shown = running ? AnimatedDoodle : Doodle;
  return (
    <span ref={box} aria-hidden="true" className="mr-0.5 flex h-5 w-5.5 shrink-0 items-center justify-center text-text-secondary">
      {color && <Shown name={doodleAt(index)} size={DOODLE_SIZE} weight={DOODLE_WEIGHT} color={color} />}
    </span>
  );
}

/**
 * One subagent from start to end: its doodle, what it is doing ("Running explore agent", then
 * "Ran", "Stopped" or "Failed") and its task. The label morphs like the work group's header, only
 * the changed word swapping while the width eases, so a state change never jolts the row. It sits
 * in the reply where the call was made, outside the folded work; parallel calls stack as rows.
 */
export const AgentRow = memo(function AgentRow({ part, index, live }: { part: ReplyToolPart; index: number; live: boolean }) {
  const { finished } = useBackground();
  const navigate = useSubagentNavigation();
  const childID = agentSessionID(part);
  const subject = toolSubject(part);
  const state = agentState(part, live, childID ? finished?.[childID] : undefined);
  const running = state === 'running';
  // A row that appears as the agent starts eases open; rows already there (a loaded chat) only fade in.
  const [opening] = useState(live);
  return (
    <div data-slot="agent-row" data-state={state} data-opening={opening || undefined}>
      <div className="min-h-0 overflow-hidden">
        <Button
          variant="quiet"
          size="disclosure"
          className="-ml-1.5 w-auto max-w-full gap-1.5 [--shimmer-text-highlight-color:var(--text-secondary)] hover:[--shimmer-text-highlight-color:var(--text-primary)]"
          disabled={!navigate || !childID}
          onClick={() => childID && navigate?.(childID, subject ?? 'Subagent')}
        >
          <AgentDoodle index={index} running={running} />
          <MorphText
            id={state}
            text={agentLabel(part, state)}
            shimmer={running}
            steady
            className="shrink-0 leading-relaxed"
            textClassName="font-normal"
            shimmerDuration={1.2}
          />
          {subject && <span className="min-w-0 truncate font-normal text-text-primary" title={subject}>{subject}</span>}
          {navigate && childID && <Icon name="arrow-right" className="shrink-0 text-text-tertiary" />}
        </Button>
      </div>
    </div>
  );
});
