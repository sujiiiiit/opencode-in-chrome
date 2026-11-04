import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { followShellOutput, plainTerminalText, SHELL_OUTPUT_TAIL, type ShellPage } from '@/lib/opencode/shell-output';

let next = 0;
const uniqueID = () => `sh_test_${(next += 1)}`;

describe('followShellOutput', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reads a finished shell to its end in one go', async () => {
    const pages: ShellPage[] = [
      { output: 'a', cursor: 1, size: 2 },
      { output: 'b', cursor: 2, size: 2 },
    ];
    const load = vi.fn(async (_id: string, _cursor: number) => pages.shift()!);
    const seen: string[] = [];
    followShellOutput({ id: uniqueID(), running: false, load, onOutput: (o) => seen.push(o) });
    await vi.runAllTimersAsync();
    expect(seen).toEqual(['a', 'ab']);
    expect(load.mock.calls.map((call) => call[1])).toEqual([0, 1]);
  });

  it('polls a running shell from its cursor until stopped', async () => {
    let cursor = 0;
    const load = vi.fn(async (_id: string, from: number) => {
      cursor = from + 1;
      return { output: String(from), cursor, size: cursor };
    });
    const seen: string[] = [];
    const stop = followShellOutput({ id: uniqueID(), running: true, load, onOutput: (o) => seen.push(o) });
    await vi.advanceTimersByTimeAsync(2_100);
    expect(seen).toEqual(['0', '01', '012']);
    stop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('stops asking for a shell the server no longer keeps, and remembers that', async () => {
    const id = uniqueID();
    const load = vi.fn(async () => 'missing' as const);
    followShellOutput({ id, running: true, load, onOutput: () => undefined });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(load).toHaveBeenCalledTimes(1);
    followShellOutput({ id, running: true, load, onOutput: () => undefined });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('resumes from what it already read when a widget remounts', async () => {
    const id = uniqueID();
    const load = vi.fn(async (_id: string, from: number) => ({ output: from === 0 ? 'done' : '', cursor: 4, size: 4 }));
    followShellOutput({ id, running: false, load, onOutput: () => undefined });
    await vi.runAllTimersAsync();
    const seen: string[] = [];
    followShellOutput({ id, running: false, load, onOutput: (o) => seen.push(o) });
    await vi.runAllTimersAsync();
    expect(seen).toEqual(['done']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps only the tail of long output', async () => {
    const big = 'x'.repeat(SHELL_OUTPUT_TAIL + 10);
    const seen: string[] = [];
    followShellOutput({
      id: uniqueID(),
      running: false,
      load: async () => ({ output: big, cursor: big.length, size: big.length }),
      onOutput: (o) => seen.push(o),
    });
    await vi.runAllTimersAsync();
    expect(seen.at(-1)).toHaveLength(SHELL_OUTPUT_TAIL);
  });
});

describe('plainTerminalText', () => {
  it('strips colour codes and normalises line endings', () => {
    expect(plainTerminalText('\u001b[31mred\u001b[0m\r\nnext\rline')).toBe('red\nnext\nline');
  });
});
