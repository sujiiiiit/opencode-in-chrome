import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PromptBox, type MentionSource, type PromptBoxHandle } from '@/components/chat/prompt-box/prompt-box';
import { DOODLE_NAMES } from '@/components/ui/doodle';
import { parseAgents, parseCommands, parseSkills } from '@/lib/opencode/mentions';

vi.mock('@/components/ui/use-text-color', async () => {
  const { useRef } = await import('react');
  return { useTextColor: () => [useRef(null), '#555'] };
});
vi.mock('@/components/ui/doodle', async (original) => {
  const actual = await original<typeof import('@/components/ui/doodle')>();
  const Doodle = ({ name }: { name: string }) => <canvas aria-label={name} />;
  return { ...actual, Doodle, AnimatedDoodle: Doodle };
});

const box = () => screen.getByRole('textbox', { name: /message/i });

function setup(source?: Partial<MentionSource>) {
  const onSubmit = vi.fn();
  const load = vi.fn();
  const ref = createRef<PromptBoxHandle>();
  const mentions: MentionSource = {
    catalog: {
      commands: parseCommands([{ name: 'review', description: 'Review changes' }, { name: 'init' }]),
      skills: parseSkills([{ id: 'pdf', name: 'PDF', description: 'Read PDFs' }]),
      agents: parseAgents([{ name: 'explore', mode: 'subagent' }, { name: 'general', mode: 'subagent' }]),
      references: [],
    },
    loading: false,
    load,
    findFiles: async () => [],
    ...source,
  };
  render(<PromptBox ref={ref} working={false} held={false} stopping={false} disabled={false} onChange={() => undefined} onSubmit={onSubmit} onStop={() => undefined} mentions={mentions} />);
  return { ref, onSubmit, load, user: userEvent.setup() };
}

const options = () => screen.queryAllByRole('option').map((option) => option.textContent);

describe('mention menu', () => {
  it.each(['@', '/'])('reopens %s after Escape and deleting the trigger', async (trigger) => {
    const { user, ref } = setup();
    await user.type(box(), trigger);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    act(() => ref.current!.setText('', { focus: true }));
    await user.keyboard(trigger);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    expect(screen.getByText('Type to filter')).toBeInTheDocument();
  });

  it.each(['@', '/'])('closes the %s menu for a query with no matches, and reopens when it matches again', async (trigger) => {
    const { user } = setup();
    await user.type(box(), `${trigger}zzzz`);
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(screen.queryByText('Type to filter')).toBeNull();
    expect(box()).toHaveTextContent(`${trigger}zzzz`);
    await user.keyboard('{Backspace}'.repeat(4));
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    expect(screen.getByText('Type to filter')).toBeInTheDocument();
  });

  it('stays closed after Escape while the same trigger is typed on, and reopens for a new one', async () => {
    const { user } = setup();
    await user.type(box(), '@');
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    await user.type(box(), 'gen');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('listbox')).toBeNull();
    // Back to the bare `@`: the same trigger, still dismissed.
    await user.keyboard('{Backspace}'.repeat(3));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('listbox')).toBeNull();
    // Deleting the `@` clears the dismissal, so typing a new one opens the list again.
    await user.keyboard('{Backspace}');
    await user.type(box(), '@');
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
  });

  it('loads a source that becomes available after the trigger is typed', async () => {
    const load = vi.fn();
    const source: MentionSource = { catalog: { commands: [], skills: [], agents: [], references: [] }, loading: true, load, findFiles: async () => [] };
    const props = { working: false, held: false, stopping: false, disabled: false, onChange: vi.fn(), onSubmit: vi.fn(), onStop: vi.fn() };
    const { rerender } = render(<PromptBox {...props} />);
    await userEvent.setup().type(box(), '@');
    expect(screen.queryByRole('listbox')).toBeNull();
    rerender(<PromptBox {...props} mentions={source} />);
    await waitFor(() => expect(load).toHaveBeenCalledOnce());
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.getByText('Type to filter')).toBeInTheDocument();
  });

  it('assigns agent doodles in catalog order and keeps them when filtering', async () => {
    const { user } = setup();
    await user.type(box(), '@');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
    expect(screen.getAllByRole('option')[0]!.querySelector('canvas')).toHaveAttribute('aria-label', DOODLE_NAMES[0]);
    expect(screen.getAllByRole('option')[1]!.querySelector('canvas')).toHaveAttribute('aria-label', DOODLE_NAMES[1]);
    await user.type(box(), 'gen');
    await waitFor(() => expect(options()).toEqual(['general']));
    expect(screen.getByRole('option').querySelector('canvas')).toHaveAttribute('aria-label', DOODLE_NAMES[1]);
  });

  it.each(['/', '@'])('shows a filter hint after a bare %s and hides it while typing', async (trigger) => {
    const { user, onSubmit } = setup();
    await user.type(box(), trigger);
    await waitFor(() => expect(screen.getByText('Type to filter')).toBeInTheDocument());
    expect(box()).toHaveTextContent(trigger);
    await user.type(box(), 'p');
    expect(screen.queryByText('Type to filter')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('opens on @ after a space, filters while typing, and loads the catalog', async () => {
    const { user, load } = setup();
    await user.type(box(), 'ask @');
    await waitFor(() => expect(options()).toEqual(['explore', 'general', 'pdfRead PDFs']));
    expect(load).toHaveBeenCalled();
    await user.type(box(), 'ex');
    await waitFor(() => expect(options()).toEqual(['explore']));
  });

  it('does not open for an @ inside a word (an email address)', async () => {
    const { user } = setup();
    await user.type(box(), 'me@ex');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('picks the highlighted row with Enter as a chip, without sending', async () => {
    const { user, ref, onSubmit } = setup();
    await user.type(box(), 'ask @gen');
    await waitFor(() => expect(options()).toEqual(['general']));
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    const chip = box().querySelector('[data-mention="agent"]');
    expect(chip?.textContent).toBe('@general');
    expect(chip?.getAttribute('contenteditable')).toBe('false');
    await waitFor(() => expect(chip?.querySelector('[data-mention-icon] canvas')).toHaveAttribute('aria-label', DOODLE_NAMES[1]));
    expect(ref.current?.mentions()).toEqual([{ kind: 'agent', name: 'general', path: undefined, start: 4, end: 12, text: '@general' }]);
  });

  it('moves with the arrow keys and closes with Escape', async () => {
    const { user } = setup();
    await user.type(box(), '@');
    await waitFor(() => expect(options()).toHaveLength(3));
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(screen.queryByText('Type to filter')).toBeNull();
  });

  it('offers commands and skills for a leading slash only', async () => {
    const { user } = setup();
    await user.type(box(), '/re');
    await waitFor(() => expect(options()).toEqual(['reviewReview changes']));
    await user.keyboard('{Tab}');
    expect(box().querySelector('[data-mention="command"]')?.textContent).toBe('/review');
    expect(box().querySelector('[data-mention="command"] [data-mention-icon]')).toBeNull();
  });

  it('does not open for @ typed right after a chip, but does after a space', async () => {
    const { user, ref } = setup();
    ref.current?.insertMention(parseAgents([{ name: 'explore', mode: 'subagent' }])[0]!);
    // Type `@` straight after the chip: drop the space insertChip adds and put the caret there.
    const chip = box().querySelector('[data-mention]')!;
    chip.nextSibling!.remove();
    const typed = document.createTextNode('@');
    chip.after(typed);
    window.getSelection()!.collapse(typed, 1);
    fireEvent.input(box());
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.keyboard(' @');
    await waitFor(() => expect(options()).toHaveLength(3));
  });

  it('shows the placeholder again after a chip is deleted with select-all (Chrome leaves <br> + empty text)', () => {
    const { ref } = setup();
    ref.current?.insertMention(parseSkills([{ id: 'pdf' }])[0]!);
    fireEvent.input(box());
    expect(document.querySelector('[data-slot="prompt-placeholder"]')).toBeNull();
    // What Chrome leaves after Ctrl+A, Delete over a chip: a <br> followed by empty text nodes.
    box().replaceChildren(document.createElement('br'), document.createTextNode(''), document.createTextNode(''));
    fireEvent.input(box());
    expect(box().childNodes).toHaveLength(0);
    expect(document.querySelector('[data-slot="prompt-placeholder"]')).not.toBeNull();
  });

  it('opens a slash list only at the very start of the draft', async () => {
    const { user } = setup();
    await user.type(box(), 'hi /re');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens on @ at the start of a new line', async () => {
    const { user } = setup();
    await user.type(box(), 'hi{Shift>}{Enter}{/Shift}@ex');
    await waitFor(() => expect(options()).toEqual(['explore']));
  });

  it('puts a skill icon in a chip at the caret from the handle (the + menu skills)', async () => {
    const { ref } = setup();
    ref.current?.insertMention(parseSkills([{ id: 'pdf' }])[0]!);
    expect(box().querySelector('[data-mention="skill"]')?.textContent).toBe('/pdf');
    await waitFor(() => expect(box().querySelector('[data-mention="skill"] [data-mention-icon] svg')).toBeInTheDocument());
    expect(ref.current?.mentions()[0]).toMatchObject({ kind: 'skill', name: 'pdf', start: 0, end: 4 });
  });
});
