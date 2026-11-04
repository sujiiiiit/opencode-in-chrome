import { describe, expect, it } from 'vitest';
import { isFileDrag, pastedFiles, transferFiles } from '@/lib/transfer-files';
import { fileOf, transfer } from '@/tests/support/transfer';

describe('isFileDrag', () => {
  it('is true only for a drag that carries files from the system', () => {
    expect(isFileDrag(transfer({ files: [fileOf('a.png')] }))).toBe(true);
    // Text or a link dragged within the page.
    expect(isFileDrag(transfer({ text: 'hello', types: ['text/html'] }))).toBe(false);
    expect(isFileDrag(transfer({ types: ['text/uri-list'] }))).toBe(false);
    expect(isFileDrag(null)).toBe(false);
  });
});

describe('transferFiles', () => {
  it('reads the file items, skipping string items', () => {
    const photo = fileOf('photo.jpg', 'image/jpeg');
    const data = { ...transfer({ files: [photo] }), items: [{ kind: 'string', getAsFile: () => null }, ...transfer({ files: [photo] }).items] };
    expect(transferFiles(data)).toEqual([photo]);
  });

  it('falls back to the files list when the browser fills no items', () => {
    const photo = fileOf('photo.jpg', 'image/jpeg');
    expect(transferFiles(transfer({ files: [photo], filesOnly: true }))).toEqual([photo]);
  });
});

describe('pastedFiles (Ctrl+V on Windows, Cmd+V on macOS: the same paste event)', () => {
  it('attaches a screenshot (Win+Shift+S, Cmd+Ctrl+Shift+4), which is only a picture', () => {
    const shot = fileOf('image.png');
    expect(pastedFiles(transfer({ files: [shot] }))).toEqual([shot]);
  });

  it('attaches an image copied from a page, which comes with HTML but no text', () => {
    const copied = fileOf('image.png');
    expect(pastedFiles(transfer({ files: [copied], types: ['text/html'] }))).toEqual([copied]);
  });

  it('attaches files copied in Explorer or Finder, which keep their names', () => {
    const files = [fileOf('holiday.jpg', 'image/jpeg'), fileOf('diagram.webp', 'image/webp')];
    // Finder also puts the names on the clipboard as text: the real files still win.
    expect(pastedFiles(transfer({ files, text: 'holiday.jpg\ndiagram.webp' }))).toEqual(files);
  });

  it('pastes text from Excel, Word or Docs, which add a rendered picture of the copy', () => {
    expect(pastedFiles(transfer({ files: [fileOf('image.png')], text: 'Q1\t120\nQ2\t140', types: ['text/html'] }))).toEqual([]);
  });

  it('pastes text when there are no files', () => {
    expect(pastedFiles(transfer({ text: 'just text' }))).toEqual([]);
    expect(pastedFiles(null)).toEqual([]);
  });
});
