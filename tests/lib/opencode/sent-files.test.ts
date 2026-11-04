import { describe, expect, it } from 'vitest';
import { fileLabel, parseSentFiles } from '@/lib/opencode/sent-files';

const stored = (mime: string, name?: string, extra: Record<string, unknown> = {}) => ({
  data: 'iVBORw==',
  mime,
  source: { type: 'inline' },
  ...(name ? { name } : {}),
  ...extra,
});

describe('parseSentFiles', () => {
  it('reads files as the server stores them, images with their bytes as a data URL', () => {
    expect(parseSentFiles([stored('image/png', 'shot.png'), stored('application/pdf', 'spec.pdf')])).toEqual([
      { kind: 'image', name: 'shot.png', mime: 'image/png', src: 'data:image/png;base64,iVBORw==' },
      { kind: 'file', name: 'spec.pdf', mime: 'application/pdf' },
    ]);
  });

  it('reads files as this panel sends them (a data URL and a name)', () => {
    expect(parseSentFiles([{ uri: 'data:image/jpeg;base64,/9j/', name: 'photo.jpg' }])).toEqual([
      { kind: 'image', name: 'photo.jpg', mime: 'image/jpeg', src: 'data:image/jpeg;base64,/9j/' },
    ]);
  });

  it('leaves out what belongs to the text: mentions and files referenced by their server path', () => {
    const files = [
      stored('image/png', 'a.png', { mention: { start: 0, end: 9, text: '[Image 1]' } }),
      stored('text/plain', 'notes.md', { source: { type: 'uri', uri: 'file:///repo/notes.md' } }),
      { uri: 'media:' + 'a'.repeat(64), mime: 'image/png', name: 'stored.png' },
    ];
    expect(parseSentFiles(files)).toBeUndefined();
  });

  it('names a file that has no name', () => {
    expect(parseSentFiles([stored('application/pdf'), stored('text/plain')])?.map((file) => file.name)).toEqual(['PDF', 'Attachment']);
  });

  it('is undefined with no attachments, so a text-only message keeps its shape', () => {
    expect(parseSentFiles(undefined)).toBeUndefined();
    expect(parseSentFiles([])).toBeUndefined();
    expect(parseSentFiles([null, 'x', {}])).toBeUndefined();
  });
});

describe('fileLabel', () => {
  it('labels a PDF, else the extension, else a plain File', () => {
    expect(fileLabel({ name: 'spec', mime: 'application/pdf' })).toBe('PDF');
    expect(fileLabel({ name: 'notes.md', mime: 'text/plain' })).toBe('MD');
    expect(fileLabel({ name: '.env', mime: 'text/plain' })).toBe('File');
  });
});
