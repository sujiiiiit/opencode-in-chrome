import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToolRow } from '@/components/chat/flow/tool-row';
import { SubagentTabs } from '@/components/chat/subagent-tabs';
import type { ReplyToolPart } from '@/lib/opencode/reply';

const part = (name: string, metadata: Record<string, unknown> = {}): ReplyToolPart => ({
  kind: 'tool', id: `tool-${name}`, name, status: 'completed', inputText: '',
  input: { description: 'Check the redirect' }, metadata,
  content: [{ type: 'text', text: 'Agent output' }],
});

function mount(tool: ReplyToolPart, live = false) {
  const user = userEvent.setup();
  render(
    <SubagentTabs rootID="root"
      renderChild={(id) => <p>Child chat {id}</p>}>
      <ToolRow part={tool} live={live} />
    </SubagentTabs>,
  );
  return user;
}

describe('ToolRow subagent navigation', () => {
  it.each([['task', 'sessionId'], ['subagent', 'sessionID']])('opens the child chat from a %s row', async (name, key) => {
    const user = mount(part(name, { [key]: 'ses_child' }));
    await user.click(screen.getByRole('button', { name: /ran agent.*check the redirect/i }));
    expect(screen.getByText('Child chat ses_child')).toBeVisible();
    expect(screen.queryByText('Agent output')).toBeNull();
  });

  it('waits for the child ID before allowing navigation', () => {
    mount(part('task'));
    expect(screen.getByRole('button', { name: /ran agent.*check the redirect/i })).toBeDisabled();
    expect(screen.queryByText('Agent output')).toBeNull();
  });

  it('opens a running named agent using its progress metadata', async () => {
    const user = mount({ ...part('task', { session_id: 'ses_live' }), status: 'running', input: { subagent_type: 'explore', description: 'Find files' } }, true);
    // A live row uses the same navigation once progress supplies the session ID.
    await user.click(screen.getByRole('button', { name: /running explore agent.*find files/i }));
    expect(screen.getByText('Child chat ses_live')).toBeVisible();
  });

  it('keeps non-agent tools as disclosures', async () => {
    const user = mount(part('shell', { sessionID: 'ses_child' }));
    await user.click(screen.getByRole('button', { name: /ran/i }));
    expect(screen.getByText('Agent output')).toBeVisible();
    expect(screen.queryByText('Child chat ses_child')).toBeNull();
  });
});
