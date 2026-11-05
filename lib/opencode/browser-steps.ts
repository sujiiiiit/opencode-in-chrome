// Browser tool calls in the timeline (spec chat/browser-activity). opencode 2.2.5 runs the
// extension's tools in code mode: the model writes an `execute` call whose metadata lists the
// inner `browser.<tool>` calls. A server that exposes them directly sends `browser_<tool>`
// parts instead. Both read as browser steps: "Opened example.com · Read the page".
import { isRecord, type ReplyToolPart } from './reply';

export type BrowserCall = { tool: string; input: Record<string, unknown>; status?: string };

const DIRECT = /^browser_(.+)$/;
const INNER = /^browser\.(.+)$/;

/** The browser calls a tool part made: itself (`browser_navigate`), or inside a code-mode `execute`. */
export function browserCalls(part: ReplyToolPart): BrowserCall[] {
  const direct = DIRECT.exec(part.name);
  if (direct) return [{ tool: direct[1]!, input: part.input, status: part.status }];
  if (part.name !== 'execute') return [];
  const calls = Array.isArray(part.metadata.toolCalls) ? part.metadata.toolCalls.filter(isRecord) : [];
  return calls.flatMap((c) => {
    const inner = typeof c.tool === 'string' ? INNER.exec(c.tool) : null;
    if (!inner) return [];
    return [{ tool: inner[1]!, input: isRecord(c.input) ? c.input : {}, status: typeof c.status === 'string' ? c.status : undefined }];
  });
}

export const isBrowserPart = (part: ReplyToolPart) => browserCalls(part).length > 0;

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const shortUrl = (url: string) => url.replace(/^[a-z]+:\/\//i, '').replace(/^www\./, '').replace(/\/$/, '');

type Words = [active: string, done: string];

const COMPUTER: Record<string, Words> = {
  left_click: ['Clicking', 'Clicked'],
  right_click: ['Right-clicking', 'Right-clicked'],
  double_click: ['Double-clicking', 'Double-clicked'],
  triple_click: ['Triple-clicking', 'Triple-clicked'],
  left_click_drag: ['Dragging', 'Dragged'],
  hover: ['Hovering', 'Hovered'],
  scroll: ['Scrolling', 'Scrolled'],
  scroll_to: ['Scrolling to an element', 'Scrolled to an element'],
  type: ['Typing', 'Typed'],
  key: ['Pressing keys', 'Pressed keys'],
  wait: ['Waiting', 'Waited'],
  dialog: ['Answering a dialog', 'Answered a dialog'],
  screenshot: ['Taking a screenshot', 'Took a screenshot'],
  zoom: ['Zooming in', 'Zoomed in'],
};

const TOOLS: Record<string, Words> = {
  tabs_context: ['Checking tabs', 'Checked tabs'],
  tabs_create: ['Opening a tab', 'Opened a tab'],
  tabs_close: ['Closing a tab', 'Closed a tab'],
  navigate: ['Opening', 'Opened'],
  read_page: ['Reading the page', 'Read the page'],
  find: ['Finding', 'Found'],
  get_page_text: ['Reading page text', 'Read page text'],
  form_input: ['Filling', 'Filled'],
  file_upload: ['Uploading files', 'Uploaded files'],
  upload_image: ['Uploading a screenshot', 'Uploaded a screenshot'],
  console: ['Reading the console', 'Read the console'],
  network: ['Reading network requests', 'Read network requests'],
  javascript: ['Running page script', 'Ran page script'],
  resize_window: ['Resizing the window', 'Resized the window'],
  gif: ['Recording a GIF', 'Recorded a GIF'],
  batch: ['Running browser steps', 'Ran browser steps'],
};

/** One browser call as a phrase: `Clicked: Opens the Filters menu`, `Opening news.ycombinator.com`. */
export function browserCallLabel(call: BrowserCall, done: boolean): string {
  const pick = (w: Words) => (done ? w[1] : w[0]);
  const summary = str(call.input.action_summary);
  if (call.tool === 'computer') {
    const words = COMPUTER[String(call.input.action)] ?? ['Using the browser', 'Used the browser'];
    return summary ? `${pick(words)}: ${summary}` : pick(words);
  }
  const special = specialLabel(call, done);
  if (special) return special;
  const words = TOOLS[call.tool] ?? [`Using ${call.tool.replace(/_/g, ' ')}`, `Used ${call.tool.replace(/_/g, ' ')}`];
  return summary ? `${pick(words)}: ${summary}` : pick(words);
}

function specialLabel(call: BrowserCall, done: boolean): string | undefined {
  if (call.tool === 'navigate') return navigateLabel(str(call.input.url), done);
  if (call.tool === 'tabs_create') return createLabel(str(call.input.url), done);
  if (call.tool === 'find') return findLabel(str(call.input.query), done);
  if (call.tool === 'batch') return batchLabel(call, done);
  if (call.tool === 'done') return doneLabel(str(call.input.outcome), done);
  return undefined;
}

function createLabel(url: string | undefined, done: boolean): string | undefined {
  return url ? `${done ? TOOLS.tabs_create![1] : TOOLS.tabs_create![0]}: ${shortUrl(url)}` : undefined;
}

function findLabel(query: string | undefined, done: boolean): string | undefined {
  return query ? `${done ? TOOLS.find![1] : TOOLS.find![0]} "${query}"` : undefined;
}

const OUTCOME_WORDS: Record<string, string> = { success: 'done', partial: 'partly done', failed: 'not done' };

/** `Finished: done` / `Finishing: partly done`. */
function doneLabel(outcome: string | undefined, done: boolean): string {
  const word = outcome ? OUTCOME_WORDS[outcome] : undefined;
  return `${done ? 'Finished' : 'Finishing'}${word ? `: ${word}` : ''}`;
}

function batchLabel(call: BrowserCall, done: boolean): string {
  const n = Array.isArray(call.input.actions) ? call.input.actions.length : 0;
  return n ? `${done ? 'Ran' : 'Running'} ${n} browser step${n === 1 ? '' : 's'}` : done ? TOOLS.batch![1] : TOOLS.batch![0];
}

function navigateLabel(url: string | undefined, done: boolean): string {
  if (url === 'back') return done ? 'Went back' : 'Going back';
  if (url === 'forward') return done ? 'Went forward' : 'Going forward';
  const verb = done ? TOOLS.navigate![1] : TOOLS.navigate![0];
  return url ? `${verb} ${shortUrl(url)}` : verb;
}

const MAX_SHOWN = 3;

/** The calls of a part as one line: up to three labels, then "+N more". */
export function browserStepsText(part: ReplyToolPart, done: boolean): string {
  const calls = browserCalls(part);
  const shown = calls.slice(0, MAX_SHOWN).map((c) => browserCallLabel(c, done && c.status !== 'running'));
  const more = calls.length - shown.length;
  return `${shown.join(' · ')}${more > 0 ? ` +${more} more` : ''}`;
}

/** Screenshots a browser call returned (image file parts), for thumbnails. */
export function browserImages(part: ReplyToolPart): Array<{ uri: string; mime: string }> {
  return part.content.flatMap((c) => (c.type === 'file' && c.mime.startsWith('image/') ? [{ uri: c.uri, mime: c.mime }] : []));
}
