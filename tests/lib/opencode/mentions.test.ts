import { describe, expect, it } from 'vitest';
import {
  fileURI,
  filterItems,
  rankFiles,
  matchScore,
  parseAgents,
  parseCommands,
  parseReferences,
  parseSkills,
  promptRefs,
  slashCommand,
  trimMentions,
  type PlacedMention,
} from '@/lib/opencode/mentions';

const wrap = (data: unknown[]) => ({ location: { directory: '/w' }, data });

describe('mention catalog parsing', () => {
  it('reads commands and skills as slash items, sorted', () => {
    expect(parseCommands(wrap([{ name: 'review', description: 'Review' }, { name: 'init' }, { nope: 1 }])).map((c) => c.label)).toEqual(['/init', '/review']);
    expect(parseSkills(wrap([{ id: 'pdf', name: 'PDF', description: 'Read PDFs' }]))[0]).toMatchObject({ id: 'skill:pdf', kind: 'skill', name: 'pdf', label: '/pdf', description: 'Read PDFs' });
  });

  it('keeps only visible subagents', () => {
    const agents = parseAgents(wrap([
      { name: 'build', mode: 'primary', hidden: false },
      { name: 'explore', mode: 'subagent', hidden: false },
      { name: 'general', mode: 'all', hidden: false },
      { name: 'secret', mode: 'subagent', hidden: true },
    ]));
    expect(agents.map((a) => a.label)).toEqual(['@explore', '@general']);
  });

  it('reads references with a path, describing them by their source', () => {
    const [ref] = parseReferences(wrap([{ name: 'docs', path: '/r/docs', source: { type: 'git', repository: 'github.com/x/docs' } }]));
    expect(ref).toMatchObject({ kind: 'reference', path: '/r/docs', description: 'github.com/x/docs' });
  });
});

describe('filtering', () => {
  it('ranks a prefix over a word start over a substring over a subsequence', () => {
    expect(matchScore('review', 're')).toBe(0);
    expect(matchScore('code-review', 're')).toBe(1);
    expect(matchScore('pre', 're')).toBe(2);
    expect(matchScore('rxexvxixexw', 'review')).toBe(3);
    expect(matchScore('init', 'zz')).toBe(-1);
  });

  it('filters, orders and limits', () => {
    const items = ['pre', 'code-review', 'review', 'init'].map((name) => ({ id: name, kind: 'command' as const, name, label: `/${name}` }));
    expect(filterItems(items, 're').map((i) => i.name)).toEqual(['review', 'code-review', 'pre']);
    expect(filterItems(items, '', 2).map((i) => i.name)).toEqual(['pre', 'code-review']);
  });
});

describe('sending', () => {
  const chip = (kind: PlacedMention['kind'], name: string, start: number, text: string, path?: string): PlacedMention => ({ kind, name, path, start, end: start + text.length, text });

  it('builds the agents, skills and files of a prompt with their spans', () => {
    const refs = promptRefs([chip('agent', 'explore', 0, '@explore'), chip('skill', 'pdf', 9, '/pdf'), chip('file', 'src/a.ts', 14, '@src/a.ts', 'src/a.ts')], '/home/me/ws');
    expect(refs.agents).toEqual([{ name: 'explore', mention: { start: 0, end: 8, text: '@explore' } }]);
    expect(refs.skills).toEqual([{ id: 'pdf', mention: { start: 9, end: 13, text: '/pdf' } }]);
    expect(refs.files).toEqual([{ uri: 'file:///home/me/ws/src/a.ts', name: 'a.ts', mention: { start: 14, end: 23, text: '@src/a.ts' } }]);
  });

  it('makes file URIs for Windows and POSIX paths', () => {
    expect(fileURI('C:\\Users\\me\\ws', 'a b.ts')).toBe('file:///C:/Users/me/ws/a%20b.ts');
    expect(fileURI(null, '/abs/x')).toBe('file:///abs/x');
  });

  it('finds a command from a leading chip or typed /name for a known command', () => {
    const commands = parseCommands([{ name: 'review' }]);
    expect(slashCommand('/review the diff', [chip('command', 'review', 0, '/review')], [])).toEqual({ name: 'review', args: 'the diff' });
    expect(slashCommand('/review  now', [], commands)).toEqual({ name: 'review', args: 'now' });
    expect(slashCommand('/unknown x', [], commands)).toBeNull();
    expect(slashCommand('please /review', [], commands)).toBeNull();
  });

  it('shifts mentions into the trimmed text', () => {
    expect(trimMentions('  @a hi ', [chip('agent', 'a', 2, '@a')])).toEqual([chip('agent', 'a', 0, '@a')]);
  });
});

describe('rankFiles', () => {
  const file = (path: string) => ({ id: `file:${path}`, kind: 'file' as const, name: path, label: `@${path}` });
  const names = (items: { name: string }[]) => items.map((item) => item.name);

  it('drops node_modules and .git paths and puts a file-name match first', () => {
    const found = [file('node_modules/x/generator.js'), file('docs/AGENTS.md'), file('.git/config'), file('src/gen/index.ts'), file('lib/generate.ts')];
    expect(names(rankFiles(found, 'gen', 8))).toEqual(['lib/generate.ts', 'docs/AGENTS.md', 'src/gen/index.ts']);
  });

  it('keeps vendored paths when the query names them, and honours the limit', () => {
    const found = [file('node_modules/ms/package.json'), file('package.json')];
    expect(names(rankFiles(found, 'node_modules/ms', 8))).toEqual(['node_modules/ms/package.json', 'package.json']);
    expect(rankFiles(found, 'package', 1)).toHaveLength(1);
  });
});
