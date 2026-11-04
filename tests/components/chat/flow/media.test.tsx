import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Markdown } from '@/components/chat/flow/markdown';
import { parseBlocks } from '@/components/chat/flow/media/image-blocks';

/** Image downloads the test settles by hand: `new Image()` only records the request. */
class FakeImage {
  static all: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  referrerPolicy = '';
  decoding = '';
  naturalWidth = 1200;
  naturalHeight = 800;
  src = '';
  constructor() {
    FakeImage.all.push(this);
  }
}

/** Every observed element counts as near the screen once `near()` is called. */
class FakeObserver {
  static all: FakeObserver[] = [];
  constructor(readonly callback: IntersectionObserverCallback) {
    FakeObserver.all.push(this);
  }
  observe() {}
  disconnect() {
    FakeObserver.all = FakeObserver.all.filter((observer) => observer !== this);
  }
}

const near = () =>
  act(() => {
    for (const observer of [...FakeObserver.all]) observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as never);
  });

/** The downloads asked for so far (preloads included), by URL. */
const requested = () => FakeImage.all.map((image) => image.src).filter(Boolean);

const settle = async (src: string, outcome: 'load' | 'error' = 'load') => {
  await act(async () => {
    for (const image of FakeImage.all.filter((each) => each.src === src)) (outcome === 'load' ? image.onload : image.onerror)?.();
    await Promise.resolve();
  });
};

beforeEach(() => {
  FakeImage.all = [];
  FakeObserver.all = [];
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(async () => {
  // Free the panel-wide download queue for the next test.
  await act(async () => {
    for (const image of FakeImage.all) image.onerror?.();
    await Promise.resolve();
  });
});

const show = (text: string) => render(<Markdown text={text} animate={false} />);
const photos = (count: number) => Array.from({ length: count }, (_, at) => `![Photo ${at + 1}](https://example.com/${at + 1}.png)`);

describe('parseBlocks', () => {
  it('joins images in their own paragraphs, or a list of images, into one block', () => {
    const blocks = parseBlocks(`Intro\n\n${photos(2).join('\n\n')}\n\n1. ![c](https://x/c.png)\n2. ![d](https://x/d.png)\n\nEnd`);
    expect(blocks).toEqual([
      'Intro\n\n',
      '![Photo 1](https://example.com/1.png)\n![Photo 2](https://example.com/2.png)\n![c](https://x/c.png)\n![d](https://x/d.png)\n\n',
      'End',
    ]);
  });

  it('never drops a tile while the next image streams in, through every cut-off step', () => {
    const next = '![Photo 3](https://example.com/3.png)';
    // From its first character (`!`) to its last, the image being typed counts as the third tile.
    const counts = Array.from({ length: next.length }, (_, at) => {
      const { container, unmount } = render(<Markdown text={`${photos(2).join('\n\n')}\n\n${next.slice(0, at + 1)}`} animate />);
      const count = Number(container.querySelector('[data-gallery]')?.getAttribute('data-gallery'));
      unmount();
      return count;
    });
    expect(new Set(counts)).toEqual(new Set([3]));
  });

  it('keeps a bare `!` or `![alt]` as text when it is not the end of a run of images', () => {
    expect(parseBlocks('Wow\n\n!')).toEqual(['Wow\n\n', '!']);
    expect(parseBlocks('![a](https://x/a.png)\n\n![b]\n\nEnd')).toEqual(['![a](https://x/a.png)\n\n', '![b]\n\n', 'End']);
  });

  it('leaves a list whose items say more than an image as it is', () => {
    const list = '- ![a](https://x/a.png) the front\n- ![b](https://x/b.png)';
    expect(parseBlocks(list)).toEqual([list]);
  });
});

describe('Markdown: a lone image', () => {
  it('holds its place, fetches nothing until near the screen, then fades in and opens the viewer', async () => {
    const { container } = show('![A cat](https://example.com/cat.png)');
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(requested()).toEqual([]);

    near();
    expect(requested()).toEqual(['https://example.com/cat.png']);
    expect(FakeImage.all[0]!.referrerPolicy).toBe('no-referrer');

    await settle('https://example.com/cat.png');
    const image = container.querySelector('img')!;
    expect(image).toHaveAttribute('alt', 'A cat');
    expect(image).toHaveClass('animate-reveal');
    expect(container.querySelector('.animate-pulse')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View A cat' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('A cat');
    expect(screen.queryByRole('button', { name: 'Next image' })).toBeNull();
  });

  it("gives its skeleton the image's own shape as soon as the download reveals the size", async () => {
    const { container } = show('![Tall](https://example.com/tall.png)');
    const skeleton = () => container.querySelector<HTMLElement>('[data-streamdown="image-wrapper"] > span')!;
    expect(skeleton().style.aspectRatio).toBe('4 / 3');
    near();
    Object.assign(FakeImage.all[0]!, { naturalWidth: 600, naturalHeight: 900 });
    await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
    // Still a skeleton (nothing has arrived), now portrait like the image.
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(skeleton().style.aspectRatio).toBe('600 / 900');
  });

  it('starts loading once its URL streams in after the stand-in', () => {
    const { container, rerender } = render(<Markdown text="![shot](http://127.0.0.1:4096/sh" animate />);
    expect(container.querySelector('[data-incomplete]')).not.toBeNull();
    // A live reply fades the held space in with its text.
    expect(container.querySelector('.animate-reveal .animate-pulse')).not.toBeNull();
    rerender(<Markdown text="![shot](http://127.0.0.1:4096/shot.png)" animate />);
    near();
    expect(requested()).toEqual(['http://127.0.0.1:4096/shot.png']);
  });

  it('says so when it fails', async () => {
    show('![Chart](https://example.com/chart.png)');
    near();
    await settle('https://example.com/chart.png', 'error');
    expect(screen.getByText("Couldn't load from example.com")).toBeInTheDocument();
  });

  it('drops sources that are not the web or an image', () => {
    const { container } = show('![x](javascript:alert(1))\n\n![y](data:text/html,hi)');
    expect(container.querySelector('[data-streamdown="image-wrapper"]')).toBeNull();
  });
});

describe('Markdown: several images', () => {
  it('shows a run of images as one mosaic card with "+N" on its last tile', () => {
    const { container } = show(`Here:\n\n${photos(8).join('\n\n')}`);
    const gallery = container.querySelector('[data-gallery]')!;
    expect(gallery).toHaveAttribute('data-gallery', '8');
    expect(gallery.querySelectorAll('[style*="grid-area"]')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'View 3 more images' })).toHaveTextContent('+3');
  });

  it('keeps one card shape, and its first tile in place, however many images stream in', () => {
    const shapes = new Set<string>();
    const firstTiles = new Set<string>();
    for (let count = 2; count <= 8; count += 1) {
      const { container, unmount } = show(photos(count).join('\n\n'));
      const card = container.querySelector<HTMLElement>('[data-gallery] > span')!;
      shapes.add(card.style.aspectRatio);
      // Where area `a` (the first image) sits: its row and column in the template.
      const rows = card.style.gridTemplateAreas.split('" "').map((row) => row.replace(/"/g, '').split(' '));
      firstTiles.add(`${rows.findIndex((row) => row.includes('a'))}:${rows[0]!.indexOf('a')}`);
      unmount();
    }
    expect([...shapes]).toEqual(['4 / 3']);
    expect(firstTiles.size).toBe(1);
  });

  it('loads at most four tiles at once', () => {
    show(photos(5).join('\n'));
    near();
    expect(requested()).toHaveLength(4);
  });

  it('opens the viewer at a tile and steps through the whole set', async () => {
    show(photos(7).join('\n\n'));
    fireEvent.click(screen.getByRole('button', { name: 'View 2 more images' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Photo 5');
    expect(dialog).toHaveTextContent('5 of 7');
    // The neighbours start downloading at once.
    expect(requested()).toEqual(expect.arrayContaining(['https://example.com/6.png', 'https://example.com/4.png']));

    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(dialog).toHaveTextContent('6 of 7');
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(dialog).toHaveTextContent('1 of 7');
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(dialog).toHaveTextContent('Photo 7');
  });

  it('is a gallery from the moment a second image starts streaming in, never loose images first', () => {
    const { container, rerender } = render(<Markdown text={`${photos(1)[0]}\n\n![Photo 2](https://exam`} animate />);
    expect(container.querySelector('[data-gallery]')).toHaveAttribute('data-gallery', '2');
    expect(container.querySelectorAll('[data-streamdown="image-wrapper"]')).toHaveLength(1);

    rerender(<Markdown text={photos(2).join('\n\n')} animate />);
    expect(container.querySelector('[data-gallery]')).toHaveAttribute('data-gallery', '2');
    expect(container.querySelectorAll('[data-streamdown="image-wrapper"]')).toHaveLength(1);
  });

  it('keeps a still-streaming tile as a skeleton that nothing fetches, and out of the viewer', () => {
    render(<Markdown text={`${photos(2).join('\n\n')}\n\n![Photo 3](https://exam`} animate />);
    near();
    expect(requested()).toEqual(['https://example.com/1.png', 'https://example.com/2.png']);
    fireEvent.click(screen.getByRole('button', { name: 'View Photo 2' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('2 of 2');
  });
});
