// form_input, file_upload, upload_image (spec browser/page-actions, browser/screenshots).
import type { Actor } from '../actions';
import { isMcpSession } from '../native';
import type { FillResult } from '../page/actions-page';
import { staleRef, type PageReader } from '../snapshot/reader';
import type { Screenshots } from '../screenshots';
import type { ServerAccess } from '../server';
import type { TabScope } from '../tabs';
import { ToolError, type ErrorCode, type ToolDef } from './registry';
import { requirePage, tabIdProperty } from './tabs';
import type { ComputerDeps } from './computer';

type PageError = { error: ErrorCode; message: string };
const isError = (v: unknown): v is PageError => typeof v === 'object' && v !== null && 'error' in v;

export const UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;

export type FormDeps = {
  scope: TabScope;
  reader: PageReader;
  actor: Actor;
  screenshots: Screenshots;
  server: ServerAccess;
  /** The directory relative upload paths resolve in (the session's workspace). */
  directory: () => Promise<string | undefined>;
  guard?: ComputerDeps['guard'];
};

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', json: 'application/json', md: 'text/markdown', html: 'text/html',
  zip: 'application/zip', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const mimeOf = (name: string) => MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
const baseName = (path: string) => path.split(/[\\/]/).pop() || path;

/**
 * Files an MCP server read on its own machine (the extension cannot read disk). Only MCP
 * sessions may pass them; the total stays under the same 10 MB cap as paths.
 */
function embeddedFiles(args: Record<string, unknown>, sessionID: string): Array<{ name: string; type: string; base64: string }> | undefined {
  if (!isMcpSession(sessionID) || !Array.isArray(args.files)) return undefined;
  const files = (args.files as Array<{ name?: unknown; type?: unknown; base64?: unknown }>).map((f) => {
    if (typeof f.name !== 'string' || typeof f.base64 !== 'string') throw new ToolError('INVALID_INPUT', 'Each file needs a name and base64 content.');
    return { name: baseName(f.name), type: typeof f.type === 'string' ? f.type : mimeOf(f.name), base64: f.base64 };
  });
  const bytes = files.reduce((sum, f) => sum + (f.base64.length * 3) / 4, 0);
  if (bytes > UPLOAD_LIMIT_BYTES) throw new ToolError('INVALID_INPUT', `The files add up to more than 10 MB (${(bytes / 1048576).toFixed(1)} MB). Upload fewer or smaller files.`);
  return files;
}

export function formTools(deps: FormDeps): ToolDef[] {
  const { scope, reader, actor } = deps;

  const target = (tabId: number, ref: string) => {
    const t = reader.refs.lookup(tabId, ref);
    if (!t) throw staleRef(ref);
    return t;
  };

  const putFiles = async (tabId: number, sessionID: string, ref: string, files: Array<{ name: string; type: string; base64: string }>) => {
    const t = target(tabId, ref);
    const point = await actor.point(tabId, ref, false).catch(() => undefined);
    await deps.guard?.({ sessionID, tabId, tool: 'file_upload', action: 'upload', summary: `Uploads ${files.map((f) => f.name).join(', ')}`, target: point?.info });
    return actor.act(tabId, sessionID, async () => {
      const result = await reader.call<{ label: string; names: string[] } | PageError>(tabId, t.documentId, 'setFiles', [t.n, files]);
      if (isError(result)) {
        if (result.error === 'STALE_REF') throw staleRef(ref);
        throw new ToolError(result.error, result.message);
      }
      return `Uploaded ${result.names.map((n) => JSON.stringify(n)).join(', ')} to ${result.label} [${ref}].`;
    });
  };

  return [
    {
      name: 'form_input',
      description:
        'Fill a form field by ref: text inputs and textareas (string), selects/comboboxes (option value or text from read_page; do not click the dropdown first), checkboxes and radios (true/false), ' +
        'editable regions (string). Page frameworks see the change. Reports the previous and new value.',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: tabIdProperty,
          ref: { type: 'string', description: 'The field ref from read_page or find.' },
          value: { anyOf: [{ type: 'string' }, { type: 'boolean' }, { type: 'number' }], description: 'The value to set.' },
          action_summary: { type: 'string', description: 'The effect in a few words, e.g. "Sets the delivery date to 29 September". No secrets.' },
        },
        required: ['ref', 'value'],
      },
      async handler(args, { sessionID }) {
        const said = typeof args.action_summary === 'string' ? args.action_summary.trim() : '';
        const tab = await requirePage(scope, sessionID, args.tabId);
        const ref = String(args.ref);
        const t = target(tab.id, ref);
        const point = await actor.point(tab.id, ref, false).catch((e: unknown) => {
          if (e instanceof ToolError && e.code === 'STALE_REF') throw e;
          return undefined;
        });
        if (point?.info.secret) {
          throw new ToolError('DENIED', `${point.info.label} is a ${point.info.secret} field, and the agent never types into those. Ask the user to enter it themselves in this tab (the browser keeps their login), then continue when they say they have. Do not ask them to share it in chat.`);
        }
        await deps.guard?.({ sessionID, tabId: tab.id, tool: 'form_input', action: 'fill', summary: said || `Sets ${point?.info.label ?? ref}`, target: point?.info, text: String(args.value) });
        const done = await actor.act(tab.id, sessionID, async () => {
          const result = await reader.call<FillResult | PageError>(tab.id, t.documentId, 'fill', [t.n, args.value as string | number | boolean]);
          if (isError(result)) {
            if (result.error === 'STALE_REF') throw staleRef(ref);
            throw new ToolError(result.error, result.message);
          }
          return `Set ${result.label} [${ref}] to ${JSON.stringify(result.value)} (was ${JSON.stringify(result.previous)}).`;
        });
        return { text: [done.text], tabId: tab.id, effect: done.effect };
      },
    },
    {
      name: 'file_upload',
      description:
        'Upload files to a file input by ref, without opening the file picker (never click file inputs). ' +
        'Paths are files on the opencode machine: absolute, or relative to the session workspace (where chat attachments are saved). Under 10 MB in total.',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: tabIdProperty,
          ref: { type: 'string', description: 'The input[type=file] ref (it may be hidden; use find "file input").' },
          paths: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
        },
        required: ['ref', 'paths'],
      },
      async handler(args, { sessionID }) {
        const tab = await requirePage(scope, sessionID, args.tabId);
        const embedded = embeddedFiles(args, sessionID);
        if (embedded) {
          const done = await putFiles(tab.id, sessionID, String(args.ref), embedded);
          return { text: [done.text], tabId: tab.id, effect: done.effect };
        }
        const client = await deps.server();
        if (!client) throw new ToolError('NEEDS_APPROVAL', 'The extension is not paired with an opencode server, so it cannot read files.');
        const directory = await deps.directory();
        const files: Array<{ name: string; type: string; base64: string }> = [];
        let total = 0;
        for (const path of args.paths as string[]) {
          let bytes: Uint8Array;
          try {
            bytes = (await client.file.read({ path, location: directory ? { directory } : undefined })) as Uint8Array;
          } catch {
            throw new ToolError('INVALID_INPUT', `Could not read ${JSON.stringify(path)} on the opencode machine. Check the path.`);
          }
          total += bytes.byteLength;
          if (total > UPLOAD_LIMIT_BYTES) {
            throw new ToolError('INVALID_INPUT', `The files add up to more than 10 MB (${(total / 1048576).toFixed(1)} MB so far). Upload fewer or smaller files.`);
          }
          files.push({ name: baseName(path), type: mimeOf(path), base64: base64(bytes) });
        }
        const done = await putFiles(tab.id, sessionID, String(args.ref), files);
        return { text: [done.text], tabId: tab.id, effect: done.effect };
      },
    },
    {
      name: 'upload_image',
      description:
        'Upload a screenshot you took (computer action screenshot, by its id) to a file input by ref, or drop it on the page at a coordinate (drag & drop targets).',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: tabIdProperty,
          imageId: { type: 'string', description: 'A screenshot id like ss_ab12, from this session.' },
          ref: { type: 'string', description: 'A file input ref.' },
          coordinate: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: 'Drop point in the screenshot frame.' },
          filename: { type: 'string', description: 'File name (default image.png).' },
        },
        required: ['imageId'],
      },
      async handler(args, { sessionID }) {
        const tab = await requirePage(scope, sessionID, args.tabId);
        const shot = deps.screenshots.get(sessionID, String(args.imageId));
        const name = typeof args.filename === 'string' && args.filename ? args.filename : 'image.png';
        const file = { name, type: shot.image.mimeType, base64: shot.image.data };
        if (typeof args.ref === 'string' && args.ref) {
          const done = await putFiles(tab.id, sessionID, args.ref, [file]);
          return { text: [done.text], tabId: tab.id, effect: done.effect };
        }
        if (!Array.isArray(args.coordinate)) throw new ToolError('INVALID_INPUT', 'upload_image needs `ref` (a file input) or `coordinate` (a drop target).');
        await deps.guard?.({ sessionID, tabId: tab.id, tool: 'upload_image', action: 'upload', summary: `Drops ${name} on the page` });
        const [x, y] = args.coordinate as [number, number];
        const frame = deps.screenshots.frameOf(tab.id);
        const cx = frame ? (x * frame.cssW) / frame.frameW : x;
        const cy = frame ? (y * frame.cssH) / frame.frameH : y;
        const done = await actor.act(tab.id, sessionID, async () => {
          const ok = await reader.callTop<boolean>(tab.id, 'drop', [cx, cy, file]);
          if (!ok) throw new ToolError('NOT_INTERACTABLE', 'Nothing at that point accepts a dropped file.');
          return `Dropped ${JSON.stringify(name)} at (${x}, ${y}).`;
        });
        return { text: [done.text], tabId: tab.id, effect: done.effect };
      },
    },
  ];
}
