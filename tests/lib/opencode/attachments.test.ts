import { describe, expect, it, vi } from 'vitest';
import { attachImage, promptFiles } from '@/lib/opencode/attachments';

const png = (name: string, type = 'image/png', bytes = [0x89, 0x50, 0x4e, 0x47]) =>
  new File([new Uint8Array(bytes)], name, { type });

describe('attachImage', () => {
  it('keeps the file with an object URL for the preview, without reading it', () => {
    const file = png('shot.png');
    const read = vi.spyOn(FileReader.prototype, 'readAsDataURL');
    const result = attachImage(file);
    if (!('image' in result)) throw new Error(result.error);
    expect(result.image).toMatchObject({ name: 'shot.png', mime: 'image/png', file });
    expect(result.image.url).toMatch(/^blob:/);
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
  });

  it('takes the type from the extension when the browser gives none', () => {
    const result = attachImage(png('photo.JPG', ''));
    expect('image' in result && result.image.mime).toBe('image/jpeg');
  });

  it('refuses files the model would never see', () => {
    expect(attachImage(png('notes.txt', 'text/plain'))).toEqual({
      error: "notes.txt isn't a PNG, JPEG, GIF or WebP image.",
    });
    expect(attachImage(png('icon.svg', 'image/svg+xml'))).toHaveProperty('error');
  });
});

describe('promptFiles', () => {
  it("builds opencode's prompt input files: a data URL under the image's type", async () => {
    const result = attachImage(png('photo.jpg', ''));
    if (!('image' in result)) throw new Error(result.error);
    expect(await promptFiles([result.image])).toEqual([{ uri: 'data:image/jpeg;base64,iVBORw==', name: 'photo.jpg' }]);
  });
});
