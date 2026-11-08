import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ComposerTray } from '@/components/chat/prompt-box/composer-tray';
import { GoalRow, showsGoal } from '@/components/chat/prompt-box/goal-tray';
import type { Goal } from '@/lib/opencode/goal';

const goal = (status: Goal['status'], extra: Partial<Goal> = {}): Goal => ({ id: 'g1', objective: 'Ship the release', status, rounds: 1, maxRounds: 50, ...extra });

const tray = (value: Goal | null, onAction = vi.fn(), notice?: string) => (
  <ComposerTray open={showsGoal(value)}>
    <GoalRow goal={value} notice={notice} onAction={onAction} />
  </ComposerTray>
);

describe('goal tray row', () => {
  it('shows an active goal with Pause and Cancel', async () => {
    const onAction = vi.fn();
    render(tray(goal('active'), onAction));
    expect(screen.getByText('Goal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume goal' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Pause goal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel goal' }));
    expect(onAction.mock.calls).toEqual([['pause'], ['clear']]);
  });

  it('offers Resume for a paused goal', async () => {
    const onAction = vi.fn();
    render(tray(goal('paused'), onAction));
    expect(screen.getByText('Goal paused')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resume goal' }));
    expect(onAction).toHaveBeenCalledWith('resume');
  });

  it('folds the tray away once the goal is met, saying so while it goes', () => {
    const { rerender, container } = render(tray(goal('active')));
    rerender(tray(goal('complete')));
    expect(screen.getByText('Goal met')).toBeInTheDocument();
    for (const fold of container.querySelectorAll('[data-slot="tray-fold"]')) expect(fold).toHaveAttribute('data-hidden');
  });

  it('shows nothing for a session that opens on a goal already met', () => {
    const { container } = render(tray(goal('complete')));
    expect(container.querySelector('[data-slot="tray-fold"]')).toHaveAttribute('data-hidden');
  });

  it('opens the details inside the tray from the header, and closes them from it again', async () => {
    const user = userEvent.setup();
    const { container } = render(tray(goal('active', { reason: 'Tests still fail' })));
    const toggle = screen.getByRole('button', { name: 'Show goal' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Tests still fail')).toBeInTheDocument();
    expect(screen.getByText('Continued 1 of 50 times')).toBeInTheDocument();
    // In the tray, under the header row: not a floating overlay.
    const details = container.querySelector('[data-tray-details]')!;
    expect(details.closest('[data-slot="tray-row"]')).not.toBeNull();
    expect(details.className).not.toMatch(/absolute/);
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'false'));
  });

  it('leaves out the count on a goal the reviewer has not sent back yet', async () => {
    render(tray(goal('active', { rounds: 0 })));
    await userEvent.click(screen.getByRole('button', { name: 'Show goal' }));
    expect(screen.queryByText(/Continued/)).toBeNull();
  });

  it('keeps the last goal on screen while the tray folds away after a clear', () => {
    const { rerender, container } = render(tray(goal('active')));
    rerender(tray(null));
    expect(screen.getByText('Ship the release')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="tray-fold"]')).toHaveAttribute('data-hidden');
  });

  it('shows a failed action in place of the objective', () => {
    render(tray(goal('active'), vi.fn(), 'No active goal to pause.'));
    expect(screen.getByRole('alert')).toHaveTextContent('No active goal to pause.');
  });
});
