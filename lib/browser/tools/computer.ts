// computer: mouse, keyboard, scrolling, waiting, dialogs and screenshots (spec
// browser/page-actions, browser/screenshots). Pointer actions take a ref (preferred) or a
// coordinate in the latest screenshot's frame.
import type { Actor } from '../actions';
import type { TargetInfo } from '../page/actions-page';
import type { Dialogs } from '../dialogs';
import { click, drag, insertText, moveMouse, parseKeys, parseModifiers, pressChord, toViewport, wheel, type MouseButton } from '../input';
import type { PageReader } from '../snapshot/reader';
import type { Screenshots } from '../screenshots';
import type { VisionCheck } from '../server';
import type { TabScope } from '../tabs';
import { ToolError, type ToolDef, type ToolImage, type ToolOutput } from './registry';
import { requirePage, tabIdProperty } from './tabs';

const COMPUTER_ACTIONS = [
  'left_click',
  'right_click',
  'double_click',
  'triple_click',
  'hover',
  'left_click_drag',
  'scroll',
  'scroll_to',
  'type',
  'key',
  'wait',
  'dialog',
  'screenshot',
  'zoom',
] as const;
type Action = (typeof COMPUTER_ACTIONS)[number];

const CLICKS: Partial<Record<Action, { button: MouseButton; clicks: number; verb: string }>> = {
  left_click: { button: 'left', clicks: 1, verb: 'Clicked' },
  right_click: { button: 'right', clicks: 1, verb: 'Right-clicked' },
  double_click: { button: 'left', clicks: 2, verb: 'Double-clicked' },
  triple_click: { button: 'left', clicks: 3, verb: 'Triple-clicked' },
};

const coordinate = { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } as const;

export type ComputerDeps = {
  scope: TabScope;
  reader: PageReader;
  actor: Actor;
  dialogs: Dialogs;
  screenshots: Screenshots;
  vision: VisionCheck;
  /** P5: saves an image for the user (screenshot or zoom with save: true); returns where. */
  saveImage?: (image: ToolImage, name: string) => Promise<string>;
  /** Policy gate before input reaches the page (design D9); filled in by the safety layer. */
  guard?: (call: { sessionID: string; tabId: number; tool: string; action: string; summary?: string; target?: unknown; text?: string }) => Promise<void>;
};

export function computerTool(deps: ComputerDeps): ToolDef {
  const { scope, actor, dialogs, screenshots } = deps;

  const pointOf = async (tabId: number, args: Record<string, unknown>, checkCover = true) => {
    if (typeof args.ref === 'string' && args.ref) {
      const p = await actor.point(tabId, args.ref, checkCover);
      return { x: p.x, y: p.y, label: `${p.info.label} [${args.ref}]`, info: p.info };
    }
    if (Array.isArray(args.coordinate)) {
      const [x, y] = toViewport(args.coordinate as [number, number], screenshots.frameOf(tabId));
      return { x, y, label: `(${(args.coordinate as number[]).join(', ')})`, info: undefined };
    }
    throw new ToolError('INVALID_INPUT', `This action needs \`ref\` (from read_page or find) or \`coordinate\` (from a screenshot).`);
  };

  const needVision = async (sessionID: string) => {
    const { vision, model } = await deps.vision.supports(sessionID);
    if (vision === false) {
      throw new ToolError(
        'INVALID_INPUT',
        `The session's model (${model ?? 'unknown'}) does not accept images, so screenshots are not available. Use read_page or find instead.`,
      );
    }
  };

  return {
    name: 'computer',
    description:
      'Click, type, press keys, scroll, drag, hover, wait, answer page dialogs, take a screenshot or zoom into part of the page. ' +
      'Target elements by ref (from read_page/find, preferred) or by coordinate in the latest screenshot frame. ' +
      'Results say what changed on the page. action_summary (optional): the effect in a few words, shown when the user is asked to approve. ' +
      'screenshot and zoom need a model that accepts images.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: COMPUTER_ACTIONS },
        tabId: tabIdProperty,
        ref: { type: 'string', description: 'Element ref, e.g. e12.' },
        coordinate: { ...coordinate, description: '[x, y] in the latest screenshot frame; for left_click_drag, the end point.' },
        start_coordinate: { ...coordinate, description: 'Drag start [x, y].' },
        text: { type: 'string', description: 'Text to type, keys to press ("ctrl+a Backspace"), or a prompt dialog answer.' },
        repeat: { type: 'integer', minimum: 1, maximum: 100, description: 'Times to repeat the key sequence.' },
        modifiers: { type: 'string', description: 'Click modifiers, e.g. "ctrl" or "ctrl+shift".' },
        scroll_direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
        scroll_amount: { type: 'integer', minimum: 1, maximum: 10, description: 'Wheel ticks (default 3).' },
        duration: { type: 'number', minimum: 0, maximum: 10, description: 'Seconds to wait (at most 10).' },
        accept: { type: 'boolean', description: 'For dialog: accept (true) or dismiss (false).' },
        region: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4, description: 'For zoom: [x0, y0, x1, y1] in the frame.' },
        scale: { type: 'number', minimum: 0.1, maximum: 1, description: 'For screenshot/zoom: shrink the returned image.' },
        save: { type: 'boolean', description: 'For screenshot/zoom: also save the image as a file to show the user; returns its path.' },
        action_summary: { type: 'string', description: 'The effect in a few words, e.g. "Opens the Filters menu". No secrets.' },
      },
      required: ['action'],
    },
    async handler(args, { sessionID }): Promise<ToolOutput> {
      const action = args.action as Action;
      const summary = typeof args.action_summary === 'string' ? args.action_summary.trim() : '';
      if (action === 'wait') return waitAction(scope, args, sessionID);
      const tab = await requirePage(scope, sessionID, args.tabId);
      return pageAction(deps, pointOf, needVision, action, args, sessionID, tab.id, summary);
    },
  };
}

type PointOf = (tabId: number, args: Record<string, unknown>, checkCover?: boolean) => Promise<{
  x: number; y: number; label: string; info: TargetInfo | undefined;
}>;
type NeedVision = (sessionID: string) => Promise<void>;

async function waitAction(scope: TabScope, args: Record<string, unknown>, sessionID: string): Promise<ToolOutput> {
  const seconds = typeof args.duration === 'number' ? args.duration : 1;
  await new Promise((r) => setTimeout(r, seconds * 1000));
  const tab = await scope.resolve(sessionID, args.tabId as number | undefined).catch(() => undefined);
  return { text: [`Waited ${seconds} s.`], tabId: tab?.id };
}

function pageAction(deps: ComputerDeps, pointOf: PointOf, needVision: NeedVision, action: Action, args: Record<string, unknown>, sessionID: string, tabId: number, summary: string): Promise<ToolOutput> {
  const simple = simplePageAction(deps, pointOf, needVision, action, args, sessionID, tabId);
  if (simple) return simple;
  if (action === 'scroll') return scrollAction(deps, pointOf, args, sessionID, tabId);
  if (action === 'hover') return hoverAction(deps, pointOf, args, sessionID, tabId);
  const clickKind = CLICKS[action];
  if (clickKind) return clickAction(deps, pointOf, args, sessionID, tabId, summary, action, clickKind);
  if (action === 'left_click_drag') return dragAction(deps, pointOf, args, sessionID, tabId, summary);
  if (action === 'type' || action === 'key') return typingAction(deps, args, sessionID, tabId, summary, action);
  throw new ToolError('INVALID_INPUT', `Unknown action ${String(action)}.`);
}

function simplePageAction(deps: ComputerDeps, pointOf: PointOf, needVision: NeedVision, action: Action, args: Record<string, unknown>, sessionID: string, tabId: number): Promise<ToolOutput> | undefined {
  if (action === 'dialog') return dialogAction(deps, args, tabId);
  if (action === 'screenshot' || action === 'zoom') return captureAction(deps, needVision, action, args, sessionID, tabId);
  if (action === 'scroll_to') return scrollToAction(pointOf, args, tabId);
  return undefined;
}

async function dialogAction(deps: ComputerDeps, args: Record<string, unknown>, tabId: number): Promise<ToolOutput> {
  const dialog = await deps.dialogs.answer(tabId, args.accept !== false, typeof args.text === 'string' ? args.text : undefined);
  await deps.actor.settle(tabId);
  return { text: [`${args.accept !== false ? 'Accepted' : 'Dismissed'} the ${dialog.type} dialog ${JSON.stringify(dialog.message)}.`], tabId };
}

async function captureAction(deps: ComputerDeps, needVision: NeedVision, action: 'screenshot' | 'zoom', args: Record<string, unknown>, sessionID: string, tabId: number): Promise<ToolOutput> {
  const save = args.save === true && !!deps.saveImage;
  // A saved image is for the user: a model without image input still gets its path.
  const sees = await needVision(sessionID).then(() => true, (error: unknown) => {
    if (save) return false;
    throw error;
  });
  deps.dialogs.assertClear(tabId);
  const scale = typeof args.scale === 'number' ? args.scale : 1;
  const result = action === 'screenshot'
    ? await deps.screenshots.screenshot(sessionID, tabId, scale)
    : await deps.screenshots.zoom(sessionID, tabId, requireRegion(args.region), scale);
  const text = [result.text];
  if (save) text.push(`Saved to ${await deps.saveImage!(result.shot.image, `${result.shot.id}.jpg`)}`);
  return { text, images: sees ? [result.shot.image] : [], tabId };
}

async function scrollToAction(pointOf: PointOf, args: Record<string, unknown>, tabId: number): Promise<ToolOutput> {
  if (typeof args.ref !== 'string') throw new ToolError('INVALID_INPUT', 'scroll_to needs `ref`.');
  const point = await pointOf(tabId, args, false);
  return { text: [`Scrolled ${point.label} into view.`], tabId };
}

async function scrollAction(deps: ComputerDeps, pointOf: PointOf, args: Record<string, unknown>, sessionID: string, tabId: number): Promise<ToolOutput> {
  const direction = (args.scroll_direction as 'up' | 'down' | 'left' | 'right' | undefined) ?? 'down';
  const ticks = typeof args.scroll_amount === 'number' ? args.scroll_amount : 3;
  const send = deps.actor.input(tabId);
  const done = await deps.actor.act(tabId, sessionID, async () => {
    const point = args.ref || args.coordinate
      ? await pointOf(tabId, args, false)
      : await viewportCenter(deps.reader, tabId);
    const before = await scrollState(deps.reader, tabId);
    await wheel(send, point.x, point.y, direction, ticks);
    await new Promise((resolve) => setTimeout(resolve, SMOOTH_SCROLL_MS));
    return `Scrolled ${direction} ${ticks} tick(s)${scrollNote(before, await scrollState(deps.reader, tabId), direction)}`;
  });
  return { text: [done.text], tabId, effect: done.effect };
}

/** Smooth scrolling finishes after the wheel event returns; the position is read once it has. */
const SMOOTH_SCROLL_MS = 250;

type ScrollState = { height: number; scrollX: number; scrollY: number; scrollHeight: number };

const scrollState = (reader: PageReader, tabId: number): Promise<ScrollState | undefined> =>
  reader.callTop<ScrollState>(tabId, 'viewport').catch(() => undefined);

/** Where the page is after a scroll, whether it grew (an infinite list loaded more) and whether an edge was reached. */
export function scrollNote(before: ScrollState | undefined, after: ScrollState | undefined, direction: string): string {
  if (!after) return '.';
  const at = `; page now at ${after.scrollX},${after.scrollY} of ${after.scrollHeight} px`;
  if (before && after.scrollHeight - before.scrollHeight > 20) return `${at}. The page grew from ${before.scrollHeight} to ${after.scrollHeight} px: more content loaded.`;
  const atBottom = after.scrollY + after.height >= after.scrollHeight - 2;
  if (direction === 'down' && atBottom) return `${at}. This is the bottom of the page. If it loads more when you reach the bottom, wait_for {idle: true} and scroll again.`;
  if (direction === 'up' && after.scrollY <= 0) return `${at}. This is the top of the page.`;
  return `${at}.`;
}

async function viewportCenter(reader: PageReader, tabId: number): Promise<{ x: number; y: number }> {
  const v = await reader.callTop<{ width: number; height: number }>(tabId, 'viewport');
  return { x: (v?.width ?? 800) / 2, y: (v?.height ?? 600) / 2 };
}

async function hoverAction(deps: ComputerDeps, pointOf: PointOf, args: Record<string, unknown>, sessionID: string, tabId: number): Promise<ToolOutput> {
  const done = await deps.actor.act(tabId, sessionID, async () => {
    const p = await pointOf(tabId, args, false);
    await moveMouse(deps.actor.input(tabId), p.x, p.y);
    return `Hovered over ${p.label}.`;
  });
  return { text: [done.text], tabId, effect: done.effect };
}

async function clickAction(deps: ComputerDeps, pointOf: PointOf, args: Record<string, unknown>, sessionID: string, tabId: number, summary: string, action: Action, clickKind: { button: MouseButton; clicks: number; verb: string }): Promise<ToolOutput> {
  const p = await pointOf(tabId, args);
  await deps.guard?.({ sessionID, tabId, tool: 'computer', action, summary: summary || `${clickKind.verb} ${p.label}`, target: p.info });
  const done = await deps.actor.act(tabId, sessionID, async () => {
    await click(deps.actor.input(tabId), p.x, p.y, { button: clickKind.button, clicks: clickKind.clicks, modifiers: parseModifiers(args.modifiers as string | undefined) });
    return `${clickKind.verb} ${p.label}.`;
  }, [p.x, p.y]);
  return { text: [done.text], tabId, effect: done.effect };
}

async function dragAction(deps: ComputerDeps, pointOf: PointOf, args: Record<string, unknown>, sessionID: string, tabId: number, summary: string): Promise<ToolOutput> {
  if (!Array.isArray(args.start_coordinate) && !args.ref) throw new ToolError('INVALID_INPUT', 'left_click_drag needs `start_coordinate` (or `ref` for the start) and `coordinate` for the end.');
  if (!Array.isArray(args.coordinate)) throw new ToolError('INVALID_INPUT', 'left_click_drag needs `coordinate`, the end point.');
  const frame = deps.screenshots.frameOf(tabId);
  const from = args.ref ? await pointOf(tabId, { ref: args.ref }) : { ...toPoint(toViewport(args.start_coordinate as [number, number], frame)), label: '' };
  const to = toViewport(args.coordinate as [number, number], frame);
  await deps.guard?.({ sessionID, tabId, tool: 'computer', action: 'left_click_drag', summary: summary || 'Drags on the page' });
  const done = await deps.actor.act(tabId, sessionID, async () => {
    await drag(deps.actor.input(tabId), [from.x, from.y], to);
    return `Dragged from (${Math.round(from.x)}, ${Math.round(from.y)}) to (${Math.round(to[0])}, ${Math.round(to[1])}).`;
  });
  return { text: [done.text], tabId, effect: done.effect };
}

async function typingAction(deps: ComputerDeps, args: Record<string, unknown>, sessionID: string, tabId: number, summary: string, action: 'type' | 'key'): Promise<ToolOutput> {
  const text = typeof args.text === 'string' ? args.text : '';
  if (!text) throw new ToolError('INVALID_INPUT', `${action} needs \`text\`.`);
  const focused = await deps.reader.callTop<{ label: string; secret: string | null; editable: boolean; inForm: boolean } | null>(tabId, 'focused');
  assertSummaryHasNoSecret(action, focused?.secret, text, summary);
  const chords = action === 'key' ? parseKeysOrFail(text) : [];
  const said = summary || typingSummary(action, text, focused?.label);
  await deps.guard?.({ sessionID, tabId, tool: 'computer', action, summary: said, target: focused ?? undefined, text });
  const out = await deps.actor.act(tabId, sessionID, () => sendTyping(deps, action, args, tabId, text, focused ?? null, chords));
  return { text: [out.text], tabId, effect: out.effect };
}

/** The approval text when the model gave none. A typed value is never part of it. */
function typingSummary(action: 'type' | 'key', text: string, label: string | undefined): string {
  return action === 'key' ? `Presses ${text}` : `Types into ${label ?? 'the page'}`;
}

function assertSummaryHasNoSecret(action: 'type' | 'key', secret: string | null | undefined, text: string, summary: string): void {
  if (action === 'type' && secret && text.length >= 3 && summary.includes(text)) {
    throw new ToolError('INVALID_INPUT', 'action_summary must not contain the text typed into this field.');
  }
}

async function sendTyping(deps: ComputerDeps, action: 'type' | 'key', args: Record<string, unknown>, tabId: number, text: string, focused: { label: string; secret: string | null } | null, chords: ReturnType<typeof parseKeys>): Promise<string> {
  if (action === 'type') {
    await insertText(deps.actor.input(tabId), text);
    return `Typed ${JSON.stringify(focused?.secret ? '\u2022\u2022\u2022' : text)}${focused ? ` into ${focused.label}` : ''}.`;
  }
  const repeat = typeof args.repeat === 'number' ? args.repeat : 1;
  for (let i = 0; i < repeat; i++) for (const chord of chords) await pressChord(deps.actor.input(tabId), chord);
  return `Pressed ${text}${repeat > 1 ? ` \u00d7${repeat}` : ''}.`;
}


const toPoint = ([x, y]: [number, number]) => ({ x, y });

function requireRegion(region: unknown): [number, number, number, number] {
  if (!Array.isArray(region) || region.length !== 4) throw new ToolError('INVALID_INPUT', 'zoom needs `region`: [x0, y0, x1, y1] in the screenshot frame.');
  return region as [number, number, number, number];
}

function parseKeysOrFail(text: string) {
  try {
    return parseKeys(text);
  } catch (error) {
    throw new ToolError('INVALID_INPUT', (error as Error).message);
  }
}
