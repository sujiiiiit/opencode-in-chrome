import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import { CopyButton } from '@/components/ui/copy-button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ReplyToolPart } from '@/lib/opencode/reply';
import { followShellOutput, plainTerminalText } from '@/lib/opencode/shell-output';
import {
  editChange,
  languageOf,
  shellID,
  shellRunning,
  toolDiff,
  toolField,
  toolOutput,
  toolPending,
} from '@/lib/opencode/tool-info';
import { useShellOutputLoader } from './live';
import { fenced, Markdown } from './markdown';

export type DetailProps = { part: ReplyToolPart; live: boolean };

/** Long tool output is cut to its end (the part a reader looks at) beyond this many characters. */
const OUTPUT_LIMIT = 8_000;
const clip = (text: string) => (text.length > OUTPUT_LIMIT ? `…${text.slice(-OUTPUT_LIMIT)}` : text);

/** Pre-formatted output that keeps its newest line in view while it grows (unless scrolled up). */
function OutputBlock({ text, label }: { text: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !follow.current) return;
    const bottom = Math.max(0, element.scrollHeight - element.clientHeight);
    if (Math.abs(element.scrollTop - bottom) >= 1) element.scrollTop = bottom;
  }, [text]);
  const onScroll = () => {
    const element = ref.current;
    if (element) follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 16;
  };
  return (
    <div className="group/output relative">
      <ScrollArea
        fade
        viewportClassName="max-h-60 overscroll-contain"
        viewportProps={{ ref, onScroll, 'aria-label': label }}
      >
        <pre className="px-3 py-2 font-mono font-normal type-work leading-5 whitespace-pre-wrap wrap-anywhere text-text-primary">
          {text}
        </pre>
      </ScrollArea>
      <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover/output:opacity-100 focus-within:opacity-100">
        <CopyButton text={text} label={`Copy ${label.toLowerCase()}`} variant="quiet" />
      </div>
    </div>
  );
}

const FINISHED_SHELL = new Set(['exited', 'timeout', 'killed']);

/** A shell call: the command, then its output, followed live while the shell runs. */
function ShellDetails({ part, live }: DetailProps) {
  const command = toolField(part, 'command') ?? '';
  const id = shellID(part);
  // A finished shell's saved result is authoritative; a running one is read from the server.
  const finished = FINISHED_SHELL.has(String(part.metadata.status));
  const running = toolPending(part, live) || shellRunning(part);
  const load = useShellOutputLoader();
  const [streamed, setStreamed] = useState('');
  useEffect(() => {
    if (!id || !load || finished) return;
    return followShellOutput({ id, running, load, onOutput: setStreamed });
  }, [id, load, running, finished]);
  const output = plainTerminalText((!finished && id && streamed) || toolOutput(part));

  return (
    <div className="overflow-hidden rounded-lg bg-console">
      {command && (
        <div className="flex items-start gap-2 border-b border-border-secondary-transparent py-1 pr-1 pl-3">
          <pre className="min-w-0 flex-1 py-1 font-mono font-normal type-work leading-5 whitespace-pre-wrap wrap-anywhere text-text-primary">
            <span className="text-text-tertiary select-none">$ </span>
            {command}
          </pre>
          <CopyButton text={command} label="Copy command" variant="quiet" />
        </div>
      )}
      {output ? (
        <OutputBlock text={clip(output)} label="Output" />
      ) : (
        <p className="px-3 py-2 type-work text-text-tertiary">{running ? 'Waiting for output…' : 'No output.'}</p>
      )}
    </div>
  );
}

/** The change as a unified diff: the server's, else built from the edit's before and after. */
function changeDiff(part: ReplyToolPart): string | undefined {
  const diff = toolDiff(part);
  if (diff) return diff;
  const change = editChange(part);
  if (!change) return undefined;
  const lines = (text: string, sign: string) => (text ? text.split('\n').map((line) => sign + line) : []);
  return [...lines(change.before, '-'), ...lines(change.after, '+')].join('\n');
}

function DiffDetails({ part }: DetailProps) {
  const diff = changeDiff(part);
  if (!diff) return <OutputDetails part={part} live={false} />;
  return <Markdown text={fenced(diff, 'diff')} animate={false} />;
}

/** A file being written: its content, highlighted, streaming in as the model writes it. */
function WriteDetails({ part, live }: DetailProps) {
  const content = toolField(part, 'content');
  if (content === undefined) return <OutputDetails part={part} live={live} />;
  const path = toolField(part, 'path') ?? toolField(part, 'filePath');
  return <Markdown text={fenced(content, languageOf(path))} animate={toolPending(part, live)} />;
}

function OutputDetails({ part }: DetailProps) {
  const output = toolOutput(part);
  if (!output) return null;
  return (
    <div className="overflow-hidden rounded-lg bg-console">
      <OutputBlock text={clip(output)} label="Output" />
    </div>
  );
}

/** Any other tool (plugins included): what it was asked, then what it returned. */
function GenericDetails({ part, live }: DetailProps) {
  const input = Object.keys(part.input).length ? JSON.stringify(part.input, null, 2) : part.inputText;
  return (
    <div className="flex flex-col gap-2">
      {input && (
        <div className="overflow-hidden rounded-lg bg-console">
          <OutputBlock text={clip(input)} label="Input" />
        </div>
      )}
      <OutputDetails part={part} live={live} />
    </div>
  );
}

/** Each tool's details; a tool missing here uses GenericDetails, one mapped to null has none. */
const DETAILS: Record<string, ComponentType<DetailProps> | null> = {
  shell: ShellDetails,
  bash: ShellDetails,
  edit: DiffDetails,
  patch: DiffDetails,
  write: WriteDetails,
  read: null,
  list: OutputDetails,
  glob: OutputDetails,
  grep: OutputDetails,
  webfetch: OutputDetails,
  websearch: OutputDetails,
  todowrite: OutputDetails,
};

/** The component that shows a tool's details, or null when the row says it all. */
export function toolDetails(part: ReplyToolPart): ComponentType<DetailProps> | null {
  const details = Object.hasOwn(DETAILS, part.name) ? (DETAILS[part.name] ?? null) : GenericDetails;
  if (details === OutputDetails && !toolOutput(part)) return null;
  return details;
}
