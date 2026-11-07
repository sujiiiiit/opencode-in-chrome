import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToolRow } from '@/components/chat/flow/tool-row';
import { SubagentTabs } from '@/components/chat/subagent-tabs';
import type { ReplyToolPart } from '@/lib/opencode/reply';

function agent(id: string, title: string): ReplyToolPart {
  return { kind: 'tool', id: `tool-${id}`, name: 'task', status: 'completed', inputText: '',
    input: { description: title }, metadata: { sessionID: id }, content: [] };
}

describe('SubagentTabs without a tab strip', () => {
  it('marks the back button when another session needs attention', async () => {
    const user = userEvent.setup();
    const view = render(<SubagentTabs rootID="root" pendingSessionIDs={['root']} renderChild={() => <p>Child</p>}>
      <ToolRow part={agent('child', 'Research')} live={false} />
    </SubagentTabs>);
    await user.click(screen.getByRole('button', { name: /ran agent.*research/i }));
    expect(screen.getByRole('status', { name: 'Another chat needs approval' })).toBeInTheDocument();
    view.rerender(<SubagentTabs rootID="root" pendingSessionIDs={['child']} renderChild={() => <p>Child</p>}>
      <ToolRow part={agent('child', 'Research')} live={false} />
    </SubagentTabs>);
    expect(screen.queryByRole('status', { name: 'Another chat needs approval' })).toBeNull();
  });
  it('opens from a work row and returns to the preserved main chat', async () => {
    const user = userEvent.setup();
    render(<SubagentTabs rootID="root" renderChild={(id) => <p>Transcript {id}</p>}>
      <><p>Main transcript</p><ToolRow part={agent('research', 'Research')} live={false} /></>
    </SubagentTabs>);
    expect(screen.queryByRole('tablist')).toBeNull();
    await user.click(screen.getByRole('button', { name: /ran agent.*research/i }));
    expect(screen.getByText('Transcript research')).toBeVisible();
    const back = screen.getByRole('button', { name: 'Back to main chat: Research' });
    expect(back).toBeVisible();
    expect(screen.queryByRole('tablist')).toBeNull();
    await user.click(within(back).getByText('Research'));
    expect(screen.getByText('Main transcript')).toBeVisible();
  });

  it('returns through nested child chats one parent at a time', async () => {
    const user = userEvent.setup();
    render(<SubagentTabs rootID="root" renderChild={(id) => id === 'research'
      ? <><p>Research chat</p><ToolRow part={agent('sources', 'Sources')} live={false} /></>
      : <p>Sources chat</p>}>
      <ToolRow part={agent('research', 'Research')} live={false} />
    </SubagentTabs>);
    await user.click(screen.getByRole('button', { name: /ran agent.*research/i }));
    await user.click(screen.getByRole('button', { name: /ran agent.*sources/i }));
    expect(screen.getByText('Sources chat')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back to Research: Sources' }));
    expect(screen.getByText('Research chat')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back to main chat: Research' }));
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('returns to the parent on Escape', async () => {
    const user = userEvent.setup();
    render(<SubagentTabs rootID="root" renderChild={() => <p>Child transcript</p>}>
      <ToolRow part={agent('child', 'Research')} live={false} />
    </SubagentTabs>);
    await user.click(screen.getByRole('button', { name: /ran agent.*research/i }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /ran agent.*research/i })).toBeVisible();
  });
});
