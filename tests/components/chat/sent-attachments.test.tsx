import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SentAttachments } from '@/components/chat/sent-attachments';
import type { SentFile } from '@/lib/opencode/sent-files';

const image = (name: string): SentFile => ({ kind: 'image', name, mime: 'image/png', src: `data:image/png;base64,${btoa(name)}` });
const pdf = (name: string): SentFile => ({ kind: 'file', name, mime: 'application/pdf' });

describe('SentAttachments', () => {
  it('shows a line of file cards, then one line of every image that scrolls instead of wrapping (six images, two PDFs)', () => {
    const files = [image('1.png'), pdf('spec.pdf'), image('2.png'), image('3.png'), image('4.png'), pdf('notes.pdf'), image('5.png'), image('6.png')];
    render(<SentAttachments files={files} />);
    const cardRow = screen.getByRole('list', { name: 'Attached files' });
    const cards = within(cardRow).getAllByTitle(/\.pdf$/);
    expect(cards.map((card) => card.title)).toEqual(['spec.pdf', 'notes.pdf']);
    expect(within(cards[0]!).getByText('PDF')).toBeInTheDocument();
    const imageRow = screen.getByRole('list', { name: 'Attached images' });
    const tiles = within(imageRow).getAllByRole('button', { name: /^Preview / });
    expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual(['1.png', '2.png', '3.png', '4.png', '5.png', '6.png'].map((n) => `Preview ${n}`));
    for (const row of [cardRow, imageRow]) {
      // One line, inside a sideways ScrollArea that fades at an edge with more beyond it.
      expect(row.className).toContain('w-max');
      expect(row.className).not.toContain('flex-wrap');
      expect(row.closest('[data-slot="scroll-area-viewport"]')?.className).toContain('scroll-fade-x');
    }
  });

  it('opens the viewer on the clicked image, within the message’s whole set', async () => {
    render(<SentAttachments files={[image('a.png'), image('b.png'), image('c.png')]} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Preview b.png' }));
    const viewer = await screen.findByRole('dialog');
    expect(within(viewer).getByText('b.png')).toBeInTheDocument();
    expect(within(viewer).getByText('2 of 3')).toBeInTheDocument();
  });

  it('shows only cards when there are no images, and hides (keeping its place) while in flight', () => {
    const { container, rerender } = render(<SentAttachments files={[pdf('spec.pdf')]} />);
    expect(screen.queryByRole('button', { name: /^Preview / })).toBeNull();
    const root = container.querySelector('[data-slot="sent-attachments"]')!;
    expect(root.className).not.toContain('invisible');
    rerender(<SentAttachments files={[pdf('spec.pdf')]} hidden />);
    expect(root.className).toContain('invisible');
  });
});
