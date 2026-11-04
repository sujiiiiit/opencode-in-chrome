import { act, createRef, type ComponentProps } from 'react';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PromptBox, type PromptBoxHandle } from '@/components/chat/prompt-box/prompt-box';
import { fileOf, transfer } from '@/tests/support/transfer';

const box = () => screen.getByRole('textbox', { name: /message/i });
const submit = () => screen.getByRole('button', { name: /^(send|stop)$/i });

type Props = ComponentProps<typeof PromptBox>;
function setup(props: Partial<Props> = {}) {
  const handlers = {
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onStop: vi.fn(),
  };
  const ref = createRef<PromptBoxHandle>();
  const all: Props = {
    working: false,
    held: false,
    stopping: false,
    disabled: true,
    ...handlers,
    ...props,
  };
  const view = render(<PromptBox ref={ref} {...all} />);
  return { ...handlers, ref, rerender: (next: Partial<Props>) => view.rerender(<PromptBox ref={ref} {...all} {...next} />) };
}

describe('PromptBox editor', () => {
  it('is a contenteditable textbox with a placeholder', () => {
    setup();
    expect(box()).toHaveAttribute('contenteditable', 'true');
    expect(box()).toHaveAttribute('aria-placeholder', 'Ask opencode');
    expect(screen.getByText('Ask opencode')).toBeInTheDocument();
  });

  it('shows a custom placeholder (follow-up while a turn runs)', () => {
    setup({ placeholder: 'Add a follow-up…' });
    expect(box()).toHaveAttribute('aria-placeholder', 'Add a follow-up…');
    expect(screen.getByText('Add a follow-up…')).toBeInTheDocument();
  });

  it('reports the draft as it changes and hides the placeholder', async () => {
    const { onChange } = setup();
    await userEvent.setup().type(box(), 'hi');
    expect(onChange).toHaveBeenLastCalledWith('hi');
    expect(screen.queryByText('Ask opencode')).toBeNull();
  });

  it('replaces the content through its handle and reports it', () => {
    const { ref, onChange } = setup();
    act(() => ref.current!.setText('restored\ntext'));
    expect(box()).toHaveTextContent('restored text');
    expect(onChange).toHaveBeenLastCalledWith('restored\ntext');
    act(() => ref.current!.setText(''));
    expect(box()).toBeEmptyDOMElement();
    expect(screen.getByText('Ask opencode')).toBeInTheDocument();
  });

  it('focuses through its handle', () => {
    const { ref } = setup();
    act(() => ref.current!.setText('x', { focus: true }));
    expect(box()).toHaveFocus();
  });

  it('pastes only plain text, never HTML', () => {
    const { onChange } = setup();
    box().focus();
    fireEvent.paste(box(), {
      clipboardData: { getData: (type: string) => (type === 'text/html' ? '<img src=x onerror=alert(1)>' : '<b>bold</b>') },
    });
    expect(box().querySelector('img, b')).toBeNull();
    expect(box()).toHaveTextContent('<b>bold</b>');
    expect(onChange).toHaveBeenLastCalledWith('<b>bold</b>');
  });
});

describe('PromptBox paste and drop of files', () => {
  it('hands a pasted screenshot to onPasteFiles and inserts nothing', () => {
    const onPasteFiles = vi.fn();
    const { onChange } = setup({ onPasteFiles });
    const shot = fileOf('image.png');
    const paste = createEvent.paste(box(), { clipboardData: transfer({ files: [shot] }) });
    fireEvent(box(), paste);
    expect(paste.defaultPrevented).toBe(true);
    expect(onPasteFiles).toHaveBeenCalledWith([shot]);
    expect(box()).toBeEmptyDOMElement();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('pastes copied spreadsheet cells as text, not as their picture', () => {
    const onPasteFiles = vi.fn();
    const { onChange } = setup({ onPasteFiles });
    box().focus();
    fireEvent.paste(box(), { clipboardData: transfer({ files: [fileOf('image.png')], text: 'Q1\t120' }) });
    expect(onPasteFiles).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith('Q1\t120');
  });

  it('without onPasteFiles, a paste with files still pastes only its text', () => {
    const { onChange } = setup();
    box().focus();
    fireEvent.paste(box(), { clipboardData: transfer({ files: [fileOf('holiday.jpg', 'image/jpeg')], text: 'holiday.jpg' }) });
    expect(onChange).toHaveBeenLastCalledWith('holiday.jpg');
  });

  it('leaves dropped files to the drop zone: no file name lands in the message', () => {
    const { onChange } = setup();
    fireEvent.drop(box(), { dataTransfer: transfer({ files: [fileOf('holiday.jpg', 'image/jpeg')], text: '/Users/me/holiday.jpg' }) });
    expect(box()).toBeEmptyDOMElement();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('PromptBox keyboard', () => {
  it('submits on Enter, and Ctrl/Cmd+Enter submits the same way', async () => {
    const { onSubmit } = setup({ disabled: false });
    const user = userEvent.setup();
    await user.type(box(), 'a{Enter}');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    expect(onSubmit).toHaveBeenCalledTimes(3);
  });

  it('submits a blank draft too, so the owner can stop a running turn', async () => {
    const { onSubmit } = setup({ working: true, stopping: true });
    await userEvent.setup().type(box(), '{Enter}');
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('inserts a line break on Shift+Enter instead of submitting', async () => {
    const { onSubmit, onChange } = setup({ disabled: false });
    await userEvent.setup().type(box(), 'a{Shift>}{Enter}{/Shift}b');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith('a\nb');
  });

  it('ignores Enter while an IME composes and a held-down Enter', () => {
    const { onSubmit } = setup({ disabled: false });
    fireEvent.keyDown(box(), { key: 'Enter', isComposing: true });
    fireEvent.keyDown(box(), { key: 'Enter', keyCode: 229 });
    fireEvent.keyDown(box(), { key: 'Enter', repeat: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('stops on Escape or Ctrl+G while a turn runs or a send is held', () => {
    const { onStop, rerender } = setup({ working: true });
    fireEvent.keyDown(box(), { key: 'Escape' });
    fireEvent.keyDown(box(), { key: 'g', ctrlKey: true });
    expect(onStop).toHaveBeenCalledTimes(2);
    rerender({ working: false, held: true });
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(onStop).toHaveBeenCalledTimes(3);
  });

  it('does not stop on Escape when idle', () => {
    const { onStop } = setup();
    fireEvent.keyDown(box(), { key: 'Escape' });
    fireEvent.keyDown(box(), { key: 'g', ctrlKey: true });
    expect(onStop).not.toHaveBeenCalled();
  });
});

describe('PromptBox submit button states', () => {
  it('Send, disabled: nothing to send', async () => {
    const { onSubmit } = setup({ disabled: true });
    expect(submit()).toHaveAccessibleName('Send');
    expect(submit()).toHaveAttribute('data-state', 'send');
    expect(submit()).toBeDisabled();
    await userEvent.setup().click(submit());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Send: submits with the plain delivery', async () => {
    const { onSubmit } = setup({ disabled: false });
    expect(submit()).toBeEnabled();
    await userEvent.setup().click(submit());
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('Held: shows a spinner and stays a Send button while models load', () => {
    setup({ held: true, disabled: false });
    expect(submit()).toHaveAccessibleName('Send');
    expect(submit()).toHaveAttribute('data-state', 'held');
    expect(submit()).toHaveAttribute('aria-busy', 'true');
  });

  it('Stop: enabled even with nothing to send, and stops instead of submitting', async () => {
    const { onSubmit, onStop } = setup({ working: true, stopping: true, disabled: true });
    expect(submit()).toHaveAccessibleName('Stop');
    expect(submit()).toHaveAttribute('data-state', 'stop');
    expect(submit()).toBeEnabled();
    await userEvent.setup().click(submit());
    expect(onStop).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Stop wins over the held spinner', () => {
    setup({ working: true, stopping: true, held: true });
    expect(submit()).toHaveAttribute('data-state', 'stop');
    expect(submit()).not.toHaveAttribute('aria-busy', 'true');
  });
});

describe('PromptBox delivery', () => {
  it('has no Steer or Queue choice: Send is the only way to send', () => {
    setup({ disabled: false, working: true });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /steer|queue/i })).toBeNull();
  });
});
