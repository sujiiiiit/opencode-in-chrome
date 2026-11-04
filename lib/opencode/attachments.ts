// Images attached to a prompt, sent inline the way opencode's composer sends media the model
// reads natively (packages/app/src/composer/attachments): as a `data:` URL in the prompt's
// `files` (PromptInput.FileAttachment). The server detects the type from the bytes and resizes.

/** The image types the server forwards to the model as media (core to-llm-message.ts). */
export const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;

/** The server rejects attachments above this size (core session/prompt.ts). */
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const EXTENSIONS: Record<string, (typeof IMAGE_MIMES)[number]> = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * An image attached to the draft. Keep only the File until the prompt is sent.
 */
export type ImageAttachment = {
  id: string;
  name: string;
  mime: string;
  file: File;
  /** An object URL for the thumbnail and the viewer; revoke it with `releaseImage`. */
  url: string;
};

/** What a prompt's `files` carries for one image (opencode's PromptInput.FileAttachment). */
export type PromptFile = { uri: string; name: string };

/** The file's image type (from the browser, else its extension), or undefined when not one we send. */
function imageMime(file: Pick<File, 'type' | 'name'>): string | undefined {
  const type = file.type.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if ((IMAGE_MIMES as readonly string[]).includes(type)) return type;
  if (type && type !== 'application/octet-stream') return undefined;
  const suffix = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
  return EXTENSIONS[suffix];
}

/** Attaches a picked file, or says why it cannot be attached. */
export function attachImage(file: File): { image: ImageAttachment } | { error: string } {
  const mime = imageMime(file);
  if (!mime) return { error: `${file.name} isn't a PNG, JPEG, GIF or WebP image.` };
  if (file.size > MAX_ATTACHMENT_BYTES) return { error: `${file.name} is larger than 20 MB.` };
  return { image: { id: crypto.randomUUID(), name: file.name, mime, file, url: URL.createObjectURL(file) } };
}

export function releaseImage(image: ImageAttachment): void {
  URL.revokeObjectURL(image.url);
}

/** Read only at send time, without a second byte array and binary string in the panel. */
function dataURL(image: ImageAttachment): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(`data:${image.mime};base64,${url.slice(url.indexOf(',') + 1)}`);
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Couldn't read ${image.name}`));
    reader.readAsDataURL(image.file);
  });
}

/** Read images one at a time; attaching must not decode or copy them. */
export async function promptFiles(images: readonly ImageAttachment[]): Promise<PromptFile[]> {
  const files: PromptFile[] = [];
  for (const image of images) {
    files.push({ uri: await dataURL(image), name: image.name });
  }
  return files;
}
