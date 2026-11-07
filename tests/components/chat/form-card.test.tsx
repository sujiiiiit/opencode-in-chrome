import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormCard } from '@/components/chat/form-card';
import { parseForm } from '@/lib/opencode/forms';

const form = (fields: unknown[], title = 'Web Search') => parseForm({ id: 'frm_1', sessionID: 'ses_1', title, fields })!;

/** The shape opencode's question tool asks in: one field per question, own answers allowed. */
const video = {
  key: 'q0',
  title: 'Video',
  description: 'What kind of video should I make?',
  type: 'string',
  custom: true,
  options: [
    { value: 'Product demo (Recommended)', label: 'Product demo (Recommended)', description: 'Polished walkthrough' },
    { value: 'Tutorial / how-to', label: 'Tutorial / how-to', description: 'Step-by-step guide' },
  ],
};
const formats = {
  key: 'q1',
  title: 'Formats',
  description: 'Which output formats should the video use?',
  type: 'multiselect',
  custom: true,
  options: [
    { value: '16:9 landscape', label: '16:9 landscape', description: '1920x1080' },
    { value: '9:16 vertical', label: '9:16 vertical', description: '1080x1920' },
  ],
};

function setup(fields: unknown[], title?: string) {
  const onAnswer = vi.fn().mockResolvedValue(true);
  const onCancel = vi.fn().mockResolvedValue(true);
  const user = userEvent.setup();
  render(<FormCard form={form(fields, title)} onAnswer={onAnswer} onCancel={onCancel} />);
  return { onAnswer, onCancel, user };
}

/** The question panel on screen (the others stay mounted, inert, for the slide). */
const current = () => {
  const panel = document.querySelector<HTMLElement>('[data-panel-active]');
  if (!panel) throw new Error('no active question');
  return within(panel);
};
const own = () => current().getByRole('textbox', { name: /your own answer/i });

describe('FormCard: one question', () => {
  it('asks a single-answer question with radios, descriptions and an own-answer row', async () => {
    const { user, onAnswer } = setup([video]);
    expect(current().getByRole('heading', { name: 'What kind of video should I make?' })).toBeInTheDocument();
    const radios = current().getAllByRole('radio');
    // Two options and the own-answer row.
    expect(radios).toHaveLength(3);
    expect(current().queryByRole('checkbox')).toBeNull();
    expect(current().getByText('Polished walkthrough')).toBeInTheDocument();
    expect(own()).toHaveAttribute('placeholder', 'Or, describe your requirements');
    // One question: no paging.
    expect(screen.queryByText('1 / 1')).toBeNull();
    expect(screen.queryByRole('button', { name: /previous question/i })).toBeNull();

    // Nothing chosen: Skip. Chosen: Submit.
    expect(screen.getByRole('button', { name: 'Skip' })).toBeEnabled();
    await user.click(current().getByRole('radio', { name: /tutorial/i }));
    expect(current().getByRole('radio', { name: /tutorial/i })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onAnswer).toHaveBeenCalledWith('frm_1', { q0: 'Tutorial / how-to' });
  });

  it('switches to a typed answer as you type it, and back to an option when one is picked', async () => {
    const { user, onAnswer } = setup([video]);
    await user.click(current().getByRole('radio', { name: /product demo/i }));
    await user.type(own(), 'A launch teaser');
    expect(current().getByRole('radio', { name: /product demo/i })).not.toBeChecked();
    expect(current().getByRole('radio', { name: /describe your requirements/i })).toBeChecked();
    await user.click(current().getByRole('radio', { name: /tutorial/i }));
    expect(current().getByRole('radio', { name: /describe your requirements/i })).not.toBeChecked();
    // The typed text is kept while set aside.
    expect(own()).toHaveValue('A launch teaser');
    await user.click(own());
    await user.keyboard('{Enter}');
    expect(onAnswer).toHaveBeenCalledWith('frm_1', { q0: 'A launch teaser' });
  });

  it('asks a multiple-answer question with checkboxes, the typed answer included', async () => {
    const { user, onAnswer } = setup([formats]);
    expect(current().getAllByRole('checkbox')).toHaveLength(3);
    expect(current().queryByRole('radio')).toBeNull();
    await user.click(current().getByRole('checkbox', { name: /16:9/ }));
    await user.click(current().getByRole('checkbox', { name: /9:16/ }));
    await user.click(current().getByRole('checkbox', { name: /16:9/ }));
    await user.type(own(), '4:5 portrait');
    expect(current().getByRole('checkbox', { name: /describe your requirements/i })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onAnswer).toHaveBeenCalledWith('frm_1', { q1: ['9:16 vertical', '4:5 portrait'] });
  });

  it('unticks the typed answer out of a multiple-answer question', async () => {
    const { user, onAnswer } = setup([formats]);
    await user.type(own(), 'Square');
    await user.click(current().getByRole('checkbox', { name: /describe your requirements/i }));
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    await user.click(current().getByRole('checkbox', { name: /9:16/ }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onAnswer).toHaveBeenCalledWith('frm_1', { q1: ['9:16 vertical'] });
  });

  it('skips an unanswered question by sending no answer for it', async () => {
    const { user, onAnswer } = setup([video]);
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onAnswer).toHaveBeenCalledWith('frm_1', {});
  });

  it('closes (declines) the form from the x', async () => {
    const { user, onCancel, onAnswer } = setup([video]);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledWith('frm_1');
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe('FormCard: several questions', () => {
  it('pages through the questions with the arrows, keeping each answer', async () => {
    const { user } = setup([video, formats]);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    const back = screen.getByRole('button', { name: /previous question/i });
    const forward = screen.getByRole('button', { name: /next question/i });
    expect(back).toBeDisabled();
    expect(forward).toBeEnabled();
    await user.click(forward);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(current().getByRole('heading', { name: /output formats/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next question/i })).toBeDisabled();
    await user.click(current().getByRole('checkbox', { name: /16:9/ }));
    await user.click(screen.getByRole('button', { name: /previous question/i }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next question/i }));
    expect(current().getByRole('checkbox', { name: /16:9/ })).toBeChecked();
  });

  it('goes on by itself once an option of a one-answer question is picked', async () => {
    const { user, onAnswer } = setup([video, formats]);
    await user.click(current().getByRole('radio', { name: /tutorial/i }));
    // A short beat first, so the pick is seen before the page slides.
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(await screen.findByText('2 / 2')).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /previous question/i }));
    expect(current().getByRole('radio', { name: /tutorial/i })).toBeChecked();
  });

  it('stays put when the own-answer row is picked, so the answer can be typed', async () => {
    const { user } = setup([video, formats]);
    await user.click(current().getByRole('radio', { name: /describe your requirements/i }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('stays put on a many-answer question, where more can be ticked', async () => {
    const { user } = setup([formats, video]);
    await user.click(current().getByRole('checkbox', { name: /16:9/ }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('does not send on its own from the last question: Submit does', async () => {
    const { user, onAnswer } = setup([formats, video]);
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    await user.click(current().getByRole('radio', { name: /tutorial/i }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onAnswer).toHaveBeenCalledWith('frm_1', { q0: 'Tutorial / how-to' });
  });

  it('moves on with Skip or Next, and submits every answer from the last question', async () => {
    const { user, onAnswer } = setup([video, formats]);
    // Unanswered: Skip moves on without sending.
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /previous question/i }));
    // A typed answer (no auto-advance): Next.
    await user.type(own(), 'Teaser');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    await user.click(current().getByRole('checkbox', { name: /16:9/ }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onAnswer).toHaveBeenCalledWith('frm_1', { q0: 'Teaser', q1: ['16:9 landscape'] });
  });

  it('sets the footer button in normal weight, not bold', () => {
    setup([video]);
    expect(screen.getByRole('button', { name: 'Skip' })).toHaveClass('font-normal');
    expect(screen.getByRole('button', { name: 'Skip' })).not.toHaveClass('font-medium');
  });

  it('goes to the next question when Enter is pressed in a typed answer', async () => {
    const { user, onAnswer } = setup([video, formats]);
    await user.type(own(), 'Teaser{Enter}');
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe('FormCard: other forms', () => {
  it('answers the web search consent form, which needs a pick and takes no typed answer', async () => {
    const { user, onAnswer } = setup([
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
    ]);
    // A field without a question of its own is headed by the form's title.
    expect(current().getByRole('heading', { name: 'Web Search' })).toBeInTheDocument();
    expect(current().queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toBeDisabled();
    await user.click(current().getByRole('radio', { name: 'Allow search via Exa' }));
    await user.click(submit);
    expect(onAnswer).toHaveBeenCalledWith('frm_1', { choice: 'allow' });
  });

  it('collects free text, numbers and yes or no, one question at a time', async () => {
    const { user, onAnswer } = setup([
      { key: 'name', type: 'string', title: 'Name' },
      { key: 'count', type: 'integer', title: 'Count' },
      { key: 'ok', type: 'boolean', title: 'Sure?' },
    ]);
    const name = current().getByRole('textbox', { name: 'Name' });
    expect(name).toHaveAttribute('placeholder', 'Describe your answer');
    expect(name).toHaveClass('text-sm');
    await user.type(name, 'Ada');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.type(current().getByRole('spinbutton', { name: 'Count' }), '3');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(current().getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onAnswer).toHaveBeenCalledWith('frm_1', { name: 'Ada', count: 3, ok: true });
  });
});

describe('FormCard: browser approvals', () => {
  // Built by the real helper so the card is tested against the forms the extension creates.
  const approval = async (kind: 'site' | 'action') => {
    const { approvalForm } = await import('@/lib/browser/approvals');
    const spec = approvalForm({ sessionID: 'ses_1', kind, site: 'shop.test', tool: 'computer', summary: 'Places the order', tier: 'consequential' });
    return parseForm({ id: 'frm_b', sessionID: 'ses_1', ...spec })!;
  };

  it('shows the action, the site and Allow / Deny, and answers with the choice', async () => {
    const onAnswer = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    render(<FormCard form={await approval('action')} onAnswer={onAnswer} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Allow this action on shop.test?' })).toBeInTheDocument();
    expect(screen.getByText('Places the order')).toBeInTheDocument();
    expect(screen.getByText('shop.test')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByText('Allow')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /your own answer/i })).toBeNull();
    await user.click(screen.getByText('Deny'));
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
    expect(onAnswer).toHaveBeenCalledWith('frm_b', { choice: 'deny' });
  });

  it('offers allow for this chat, always and deny for a new site', async () => {
    const onAnswer = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    render(<FormCard form={await approval('site')} onAnswer={onAnswer} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Let the agent use shop.test?' })).toBeInTheDocument();
    expect(screen.getByText(/the agent wants to read and act on this site/i)).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    await user.click(screen.getByRole('radio', { name: 'Always allow shop.test' }));
    expect(onAnswer).toHaveBeenCalledWith('frm_b', { choice: 'always' });
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
  });
});
