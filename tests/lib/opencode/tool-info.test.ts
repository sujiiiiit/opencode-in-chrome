import { describe, expect, it } from 'vitest';
import type { ReplyToolPart } from '@/lib/opencode/reply';
import {
  editChange,
  languageOf,
  partialField,
  shellExit,
  toolDiff,
  toolOutput,
  toolLabel,
  toolResult,
  toolSubject,
  toolSummary,
  toolTitle,
} from '@/lib/opencode/tool-info';

const tool = (name: string, extra: Partial<ReplyToolPart> = {}): ReplyToolPart => ({
  kind: 'tool',
  id: `call_${name}`,
  name,
  status: 'completed',
  inputText: '',
  input: {},
  metadata: {},
  content: [],
  ...extra,
});

describe('partialField', () => {
  it('reads a string field from JSON that is still streaming', () => {
    expect(partialField('{"command":"npm te', 'command')).toBe('npm te');
    expect(partialField('{"command":"echo \\"hi\\"\\nls"}', 'command')).toBe('echo "hi"\nls');
    expect(partialField('{"command":"a\\', 'command')).toBe('a');
    expect(partialField('{"path":"x"}', 'command')).toBeUndefined();
  });

  it('waits for the closing quote when asked for whole values only', () => {
    expect(partialField('{"command":"npm te', 'command', true)).toBeUndefined();
    expect(partialField('{"command":"npm test","x', 'command', true)).toBe('npm test');
  });
});

describe('tool rows', () => {
  it('names what the call works on', () => {
    expect(toolSubject(tool('shell', { input: { command: 'npm test\n--watch' } }))).toBe('npm test');
    expect(toolSubject(tool('execute', { input: { command: 'pnpm test', description: 'Run tests' } }))).toBe('pnpm test');
    expect(toolSubject(tool('execute', { input: { description: 'Run tests' } }))).toBe('Run tests');
    expect(toolSubject(tool('read', { input: { path: 'C:\\repo\\src\\app.ts' } }))).toBe('app.ts');
    expect(toolSubject(tool('grep', { input: { pattern: 'TODO' } }))).toBe('TODO');
    expect(toolSubject(tool('patch', { metadata: { files: [{}, {}] } }))).toBe('2 files');
    expect(toolSubject(tool('mystery_plugin', { input: { x: 1 } }))).toBeUndefined();
    expect(toolSubject(tool('mystery_plugin', { input: { x: 1, url: 'https://a.dev' } }))).toBe('https://a.dev');
  });

  it('drops a leading cd from commands and the scheme from URLs', () => {
    expect(toolSubject(tool('shell', { input: { command: 'cd /repo && npm test' } }))).toBe('npm test');
    expect(toolSubject(tool('shell', { input: { command: 'cd "C:\\my repo"; pnpm lint' } }))).toBe('pnpm lint');
    expect(toolSubject(tool('webfetch', { input: { url: 'https://www.example.com/docs/' } }))).toBe('example.com/docs');
  });

  it('names the file a one-file patch changed, the plan progress, and the question asked', () => {
    expect(toolSubject(tool('patch', { metadata: { files: [{ file: 'src/app.ts' }] } }))).toBe('app.ts');
    const todos = [{ status: 'completed' }, { status: 'in_progress' }, { status: 'pending' }];
    expect(toolSubject(tool('todowrite', { input: { todos } }))).toBe('1/3 done');
    expect(toolSubject(tool('question', { input: { questions: [{ question: 'Which DB?', header: 'DB' }] } }))).toBe('Which DB?');
  });

  it('reads a call as one sentence, without a field that is still streaming', () => {
    expect(toolLabel(tool('grep', { input: { pattern: 'TODO' } }), false)).toBe('Searched for "TODO"');
    expect(toolLabel(tool('list', { input: { path: '/repo/src' } }), false)).toBe('Listed files in src');
    expect(toolLabel(tool('subagent', { status: 'running', input: { description: 'Map the code' } }), true)).toBe('Running agent: Map the code');
    expect(toolLabel(tool('todowrite', { input: { todos: [{ status: 'completed' }] } }), false)).toBe('Updated plan · 1/1 done');
    expect(toolLabel(tool('shell', { status: 'streaming', inputText: '{"command":"npm te' }), true)).toBe('Running');
    expect(toolLabel(tool('shell', { status: 'streaming', inputText: '{"command":"npm test"' }), true)).toBe('Running npm test');
  });

  it('reports what a finished search found', () => {
    expect(toolResult(tool('grep', { metadata: { matches: 12 } }))).toBe('12 matches');
    expect(toolResult(tool('glob', { metadata: { count: 1 } }))).toBe('1 file');
    expect(toolResult(tool('grep', { status: 'running', metadata: { matches: 3 } }))).toBeUndefined();
  });

  it('shows the command while the model is still writing it', () => {
    expect(toolSubject(tool('shell', { status: 'streaming', inputText: '{"command":"git sta' }))).toBe('git sta');
    expect(toolSubject(tool('execute', { status: 'streaming', inputText: '{"command":"pnpm te' }))).toBe('pnpm te');
  });

  it('titles a call by whether it still works, which needs the turn to be live', () => {
    const running = tool('shell', { status: 'running' });
    expect(toolTitle(running, true)).toBe('Running');
    expect(toolTitle(running, false)).toBe('Ran');
    expect(toolTitle(tool('edit'), true)).toBe('Edited');
    expect(toolTitle(tool('mystery_plugin', { status: 'running' }), true)).toBe('Using Mystery plugin');
    expect(toolTitle(tool('chrome-devtools_navigate_page'), true)).toBe('Used Chrome devtools navigate page');
  });

  it('reads output, exit codes and diffs defensively', () => {
    const shell = tool('shell', {
      content: [
        { type: 'text', text: 'line 1' },
        { type: 'file', uri: 'file:///x', mime: 'text/plain' },
        { type: 'text', text: 'line 2' },
      ],
      metadata: { exit: 2 },
    });
    expect(toolOutput(shell)).toBe('line 1\nline 2');
    expect(shellExit(shell)).toBe(2);
    expect(shellExit(tool('shell', { metadata: { exit: 'NaN' } }))).toBeUndefined();
    expect(toolDiff(tool('patch', { metadata: { files: [{ patch: '+a' }, 'junk', { patch: '-b' }] } }))).toBe('+a\n-b');
    expect(editChange(tool('edit', { input: { oldString: 'a', newString: 'b' } }))).toEqual({ before: 'a', after: 'b' });
    expect(editChange(tool('edit', { input: { oldString: 'a' } }))).toBeNull();
  });

  it('summarises a group by family', () => {
    const parts = [tool('shell'), tool('bash'), tool('read'), tool('edit'), tool('mystery_plugin')];
    expect(toolSummary(parts)).toBe('1 file edited · 2 commands · 1 file read · 1 Mystery plugin call');
    expect(toolSummary([])).toBe('');
  });

  it('counts files rather than calls and leaves bookkeeping out', () => {
    const parts = [
      tool('edit', { id: 'e1', input: { filePath: 'a.ts' } }),
      tool('edit', { id: 'e2', input: { filePath: 'a.ts' } }),
      tool('patch', { id: 'p1', metadata: { files: [{ file: 'a.ts' }, { file: 'b.ts' }] } }),
      tool('read', { id: 'r1', input: { path: 'c.ts' } }),
      tool('read', { id: 'r2', input: { path: 'c.ts' } }),
      tool('websearch'),
      tool('webfetch'),
      tool('todowrite'),
      tool('skill'),
      tool('question'),
      tool('one_plugin', { id: 'o1' }),
      tool('two_plugin', { id: 't1' }),
    ];
    expect(toolSummary(parts)).toBe('2 files edited · 1 file read · 1 web search · 1 page opened · 2 tool calls');
  });

  it('maps file extensions to fence languages', () => {
    expect(languageOf('src/app.tsx')).toBe('tsx');
    expect(languageOf('script.py')).toBe('python');
    expect(languageOf('Makefile')).toBe('text');
    expect(languageOf(undefined)).toBe('text');
  });
});
