import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormCard } from '@/components/chat/form-card';
import { parseForm } from '@/lib/opencode/forms';

const form = (fields: unknown[]) => parseForm({ id: 'frm_1', sessionID: 'ses_1', title: 'Web Search', fields })!;

describe('FormCard', () => {
  it('answers the consent form with the chosen option', async () => {
    const onAnswer = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn();
    render(
      <FormCard
        onAnswer={onAnswer}
        onCancel={onCancel}
        form={form([
          {
            key: 'choice',
            type: 'string',
            required: true,
            custom: false,
            options: [
              { value: 'allow', label: 'Allow search via Exa' },
              { value: 'disable', label: 'Disable web search' },
            ],
          },
        ])}
      />,
    );
    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toBeDisabled();
    expect(screen.queryByRole('textbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Allow search via Exa' }));
    await userEvent.click(submit);
    expect(onAnswer).toHaveBeenCalledWith('frm_1', { choice: 'allow' });
  });

  it('collects free text, numbers, booleans and multiple choices, and can be dismissed', async () => {
    const onAnswer = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn().mockResolvedValue(true);
    render(
      <FormCard
        onAnswer={onAnswer}
        onCancel={onCancel}
        form={form([
          { key: 'name', type: 'string', title: 'Name' },
          { key: 'count', type: 'integer', title: 'Count' },
          { key: 'ok', type: 'boolean', title: 'Sure?' },
          { key: 'tags', type: 'multiselect', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
        ])}
      />,
    );
    await userEvent.type(screen.getAllByRole('textbox')[0]!, 'Ada');
    await userEvent.type(screen.getByRole('spinbutton'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await userEvent.click(screen.getByRole('button', { name: 'A' }));
    await userEvent.click(screen.getByRole('button', { name: 'B' }));
    await userEvent.click(screen.getByRole('button', { name: 'A' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onAnswer).toHaveBeenCalledWith('frm_1', { name: 'Ada', count: 3, ok: true, tags: ['b'] });
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onCancel).toHaveBeenCalledWith('frm_1');
  });
});
