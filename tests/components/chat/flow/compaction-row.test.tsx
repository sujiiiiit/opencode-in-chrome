import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssistantReply } from '@/components/chat/flow/assistant-reply';
import { CompactionRow } from '@/components/chat/flow/compaction-row';
import type { ReplyCompaction, ReplyState } from '@/lib/opencode/reply';
import { SESSION_ID } from '@/tests/support/testkit';

const item = (extra: Partial<ReplyCompaction> = {}): ReplyCompaction => ({
  id: 'c1', afterStep: 1, status: 'completed', summary: 'The summary', ...extra,
});
const label = () => document.querySelector('[data-slot="compaction-label"]')?.textContent;

describe('CompactionRow', () => {
  it('says Compacting while it runs, and opens to its summary', () => {
    render(<CompactionRow item={item({ status: 'running', summary: 'Partial' })} />);
    expect(label()).toBe('Compacting');
    expect(screen.getByRole('button')).not.toHaveAttribute('data-disabled');
  });

  it('says only Compacted once done', () => {
    const { container } = render(<CompactionRow item={item({ })} />);
    expect(label()).toBe('Compacted');
    expect(container.textContent).toBe('Compacted');
  });

  it('shows why it failed, but stays quiet about a stop', () => {
    const { rerender } = render(<CompactionRow item={item({ status: 'failed', summary: '', error: { type: 'provider', message: 'Too long' } })} />);
    expect(label()).toBe('Compaction failed');
    expect(screen.getByText('Too long')).toBeInTheDocument();
    rerender(<CompactionRow key="stop" item={item({ status: 'failed', summary: '', error: { type: 'aborted', message: 'Aborted' } })} />);
    expect(label()).toBe('Compaction cancelled');
    expect(screen.queryByText('Aborted')).not.toBeInTheDocument();
  });
});

describe('AssistantReply with a compaction', () => {
  it('puts a compaction after a finished reply below its footer', () => {
    const reply: ReplyState = {
      sessionID: SESSION_ID,
      status: 'succeeded',
      steps: [{ id: 'a1', parts: [{ kind: 'text', id: 't1', ordinal: 0, text: 'Answer', done: true }] }],
      compactions: [item()],
    };
    const { container } = render(<AssistantReply reply={reply} />);
    const slots = [...container.querySelectorAll('[data-slot="assistant-answer"], [data-slot="message-footer"], [data-slot="compaction"]')]
      .map((node) => node.getAttribute('data-slot'));
    expect(slots.at(-1)).toBe('compaction');
    expect(slots.indexOf('assistant-answer')).toBeLessThan(slots.indexOf('compaction'));
  });
});
