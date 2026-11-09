import {
  createClient,
  describeError,
  isFormGone,
  isSessionNotFound,
  isShellNotFound,
  isUnauthorized,
  NO_MODEL_MESSAGE,
  type OpenCodeClient,
} from './client';
import { releaseImage, type ImageAttachment, type PromptFile } from './attachments';
import { parseSentFiles, withFiles, type SentFile } from './sent-files';
import { authHeader, type Connection } from './connection';
import { EventHub, type HubStatus } from './events';
import { addForm, createdForm, parseForm, parseForms, removeForm, settledFormID, type FormAnswer, type PendingForm } from './forms';
import { createMessageID } from './ids';
import type { DurableSelection, Selection } from './models/selection';
import { isRecord, type ReplyState } from './reply';
import { EXTENSION_METADATA } from './sessions';
import type { ShellOutputLoader } from './shell-output';
import type { ServerEvent } from './sse';
import { Store } from './store';
import {
  admitPrompt,
  emptyTimeline,
  leadingOrphans,
  pendingStatus,
  prependHistory,
  reduceTimeline,
  timelineFromSnapshot,
  type GoalStart,
  type PendingPrompt,
  type PendingStatus,
  type Timeline,
  type Turn,
} from './timeline';
import { ensureWorkspace } from './workspace';
import type { PromptRefs } from './mentions';
import type { PermissionRequest } from '@opencode/client';
import type { PermissionMode } from './permission-mode';

/** Messages per page, for the first snapshot and for each "load earlier". */
const PAGE_LIMIT = 50;

/** Text to show when a finished reply did not succeed; null otherwise. */
export function replyErrorText(state: ReplyState): string | null {
  if (state.status === 'failed') {
    const { type = '', message = '' } = state.error ?? {};
    if (/model.*not.*selected/i.test(type)) return NO_MODEL_MESSAGE;
    return `Model error: ${message}`;
  }
  if (state.status === 'interrupted') return 'Stopped before the reply finished.';
  return null;
}

/** A prompt sent by this panel that the server has not admitted yet (the optimistic bubble). */
/** A prompt this panel sent that the server has not admitted yet; `files` show above its bubble. */
export type LocalPrompt = { id: string; text: string; files?: SentFile[] };

export type ChatPhase = 'idle' | 'loading' | 'ready' | 'failed';

export type ChatState = {
  /** `loading` connects the event stream and resolves the model; a send waits (is held) meanwhile. */
  phase: ChatPhase;
  /** The event stream is up. Sending is unavailable while a ready session reconnects. */
  connected: boolean;
  /** Why loading failed (offline, no model). */
  error: string | null;
  /** Null until the first prompt creates the session. */
  timeline: Timeline | null;
  /** The session's title; null until opencode names it. */
  title: string | null;
  /** The agent and model the server has for the session (null until known). */
  durable: DurableSelection | null;
  /** Session creation and last outcome, used for a child session's status. */
  sessionInfo?: { started?: number; ended?: number; outcome?: 'succeeded' | 'failed' | 'interrupted' };
  /** Older messages exist beyond the loaded ones. */
  hasEarlier: boolean;
  loadingEarlier: boolean;
  local: LocalPrompt[];
  submitting: boolean;
  interrupting: boolean;
  /** A transient failure to show (a failed send). */
  notice: string | null;
  /** Questions the server is waiting on (web search's first-use consent, a question tool). */
  forms: PendingForm[];
  permissions: PermissionRequest[];
};

export type ChatSessionOptions = {
  connection: Connection;
  /** The panel's shared event stream. Without one, the session opens (and owns) its own. */
  events?: EventHub;
  fetch?: typeof globalThis.fetch;
  /** Used only for a stream the session opens itself. */
  idleMs?: number;
  /** Used only for a stream the session opens itself. */
  retryMs?: number;
  /** Attach to an existing session instead of creating one on the first send. */
  sessionID?: string;
  /** Include pending requests from descendant sessions in this chat. */
  includeSubagents?: boolean;
  /** The first send created the session (with `selection`, when the send named one). */
  onCreated?: (sessionID: string, selection?: Selection) => void;
  /** Runs after the session is created and before the first prompt joins it (the browsing guide). Must not throw. */
  prepare?: (client: OpenCodeClient, sessionID: string) => Promise<unknown>;
  /** Rules for this session only; other MCPs and global skills remain available. */
  sessionPermissions?: () => Promise<ReadonlyArray<{ action: string; resource: string; effect: 'allow' | 'deny' | 'ask' }> | undefined>;
  /** Runs before every prompt so an enabled browser agent cannot answer without its tools. */
  beforePrompt?: () => Promise<void>;
  /** The attached session no longer exists (deleted elsewhere). */
  onMissing?: () => void;
  onUnauthorized?: () => void;
  /** The session went idle; `turn` is the turn that just ended (V4: the browser `done` check). Must not throw. */
  onTurnEnded?: (client: OpenCodeClient, sessionID: string, turn: Turn) => void;
};

export const INITIAL_CHAT_STATE: ChatState = {
  phase: 'idle',
  connected: false,
  error: null,
  timeline: null,
  title: null,
  durable: null,
  hasEarlier: false,
  loadingEarlier: false,
  local: [],
  submitting: false,
  interrupting: false,
  notice: null,
  forms: [],
  permissions: [],
};

/** The admitted inbox item a prompt POST answers with, falling back to what was sent. */
function parseAck(ack: unknown, local: LocalPrompt): PendingPrompt {
  const item = isRecord(ack) ? ack : {};
  const time = isRecord(item.time) ? item.time : {};
  const payload = isRecord(item.payload) ? item.payload : {};
  const delivery = item.delivery === 'queue' ? 'queue' : 'steer';
  return {
    id: typeof item.id === 'string' ? item.id : local.id,
    text: typeof payload.text === 'string' ? payload.text : local.text,
    delivery,
    created: typeof time.created === 'number' ? time.created : Date.now(),
    ...withFiles(ackFiles(local, payload)),
  };
}

/** The panel's own copy of the files, else the echo's: it carries the same bytes again. */
const ackFiles = (local: LocalPrompt, payload: Record<string, unknown>) => local.files ?? parseSentFiles(payload.files);

/**
 * A steer's request: exactly the user's text, plus its attachments and mentions when there are any
 * (a mentioned file travels with the attachments, its `mention` marking where it sits in the text).
 */
function promptBody(sessionID: string, local: LocalPrompt, files: readonly PromptFile[] = [], refs?: PromptRefs) {
  const body = { sessionID, id: local.id, text: local.text, delivery: 'steer' as const };
  const all = [...files, ...(refs?.files ?? [])];
  return {
    ...body,
    ...(all.length ? { files: all } : {}),
    ...(refs?.agents.length ? { agents: refs.agents } : {}),
    ...(refs?.skills.length ? { skills: refs.skills } : {}),
  };
}

/**
 * A newest-first message page as `{messages (chronological), next}`. The server always returns a
 * cursor, so a short page is taken as the last one.
 */
function readPage(page: unknown): { messages: unknown[]; next: string | null } {
  const record = isRecord(page) ? page : {};
  const messages = Array.isArray(record.data) ? [...record.data].reverse() : [];
  const cursor = isRecord(record.cursor) ? record.cursor : {};
  const next = typeof cursor.next === 'string' && messages.length >= PAGE_LIMIT ? cursor.next : null;
  return { messages, next };
}

const titleOf = (value: unknown): string | null =>
  isRecord(value) && typeof value.title === 'string' && value.title ? value.title : null;

/** A `{id, providerID, variant?}` model reference in the local `{providerID, modelID}` shape. */
function modelOf(value: unknown): DurableSelection['model'] {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.providerID !== 'string') return undefined;
  return {
    providerID: value.providerID,
    modelID: value.id,
    ...(typeof value.variant === 'string' ? { variant: value.variant } : {}),
  };
}

/** The agent and model a session record (or an assistant message) names. */
function durableOf(value: unknown): DurableSelection | null {
  if (!isRecord(value)) return null;
  const agent = typeof value.agent === 'string' && value.agent ? value.agent : undefined;
  const model = modelOf(value.model);
  return agent || model ? { agent, model } : null;
}

/** The selection's model as the server takes it (`id`, and no variant for the default). */
const wireModel = (selection: Selection) => ({
  id: selection.model.modelID,
  providerID: selection.model.providerID,
  ...(selection.variant ? { variant: selection.variant } : {}),
});

const selectionKey = (model: { providerID: string; modelID: string; variant?: string }) =>
  `${model.providerID}/${model.modelID}/${model.variant ?? ''}`;

/** What a session.model.selected / session.agent.selected event changes, or null for any other event. */
function durablePatch(event: ServerEvent): DurableSelection | null {
  if (event.type === 'session.model.selected') {
    const model = modelOf(event.data.model);
    return model ? { model } : null;
  }
  const agent = event.data.agent;
  return event.type === 'session.agent.selected' && typeof agent === 'string' ? { agent } : null;
}

/**
 * One opencode session for the side panel, as an external store (`subscribe` + `getState`).
 * It follows the panel's event stream (resyncing after a drop), sends every prompt as a steer
 * (it starts a turn, or joins the running one at its next step), interrupts, and pages back
 * through older messages.
 */
export class ChatSession extends Store<ChatState> {
  private childEvents: Promise<void> = Promise.resolve();
  private readonly descendants = new Set<string>();
  private permissionMode: PermissionMode = 'manual';
  private readonly answeringPermissions = new Set<string>();

  setPermissionMode(mode: PermissionMode): void {
    this.permissionMode = mode;
    if (mode === 'auto') for (const request of this.state.permissions) void this.answerPermission(request, 'once');
  }

  async answerPermission(request: PermissionRequest, decision: 'once' | 'always' | 'reject'): Promise<boolean> {
    if (this.answeringPermissions.has(request.id)) return false;
    this.answeringPermissions.add(request.id);
    try {
      await this.client.permission.reply({ sessionID: request.sessionID, requestID: request.id, decision }, { signal: this.signal });
      this.set((state) => ({ permissions: state.permissions.filter((item) => item.id !== request.id) }));
      return true;
    } catch (error) {
      if (!this.disposed && !this.unauthorized(error)) this.set({ notice: describeError(error) });
      return false;
    } finally {
      this.answeringPermissions.delete(request.id);
    }
  }

  private receivePermission(request: PermissionRequest): void {
    this.set((state) => ({ permissions: state.permissions.some((item) => item.id === request.id) ? state.permissions : [...state.permissions, request] }));
    if (this.permissionMode === 'auto') void this.answerPermission(request, 'once');
  }

  private async loadPermissions(sessionID: string): Promise<void> {
    try {
      const requests = await this.client.permission.list({ sessionID }, { signal: this.signal });
      if (sessionID !== this.sessionID || this.disposed) return;
      this.set((state) => ({ permissions: state.permissions.filter((item) => item.sessionID !== sessionID) }));
      for (const request of requests) this.receivePermission(request);
    } catch { /* Keep requests received from the stream. */ }
  }

  private async belongsToChat(id: string): Promise<boolean> {
    const visited = new Set<string>();
    let current = id;
    while (current && !visited.has(current)) {
      if (this.isKnownSession(current)) {
        for (const item of visited) this.descendants.add(item);
        return true;
      }
      visited.add(current);
      const info: unknown = await this.client.session.get({ sessionID: current }, { signal: this.signal }).catch(() => undefined);
      current = isRecord(info) && typeof info.parentID === 'string' ? info.parentID : '';
    }
    return false;
  }

  private isKnownSession(id: string): boolean {
    return id === this.sessionID || this.descendants.has(id);
  }

  private requestSessionID(event: ServerEvent): string {
    if (event.type === 'form.created') return parseForm(event.data.form)?.sessionID ?? '';
    return typeof event.data.sessionID === 'string' ? event.data.sessionID : '';
  }

  private async applyChildRequest(event: ServerEvent): Promise<void> {
    const id = this.requestSessionID(event);
    if (!id || id === this.sessionID || !(await this.belongsToChat(id)) || this.disposed) return;
    if (!this.applyPermission(event)) this.applyFormForSession(event, id);
  }

  private async loadChildRequests(): Promise<void> {
    if (!this.options.includeSubagents || !this.sessionID) return;
    const location = this.directory ? { directory: this.directory } : undefined;
    const [permissions, forms] = await Promise.all([
      this.client.permission.request.list({ location }, { signal: this.signal }).catch(() => undefined),
      this.client.form.list({ location }, { signal: this.signal }).catch(() => undefined),
    ]);
    if (permissions) this.set((state) => ({ permissions: state.permissions.filter((item) => item.sessionID === this.sessionID) }));
    if (forms) this.set((state) => ({ forms: state.forms.filter((item) => item.sessionID === this.sessionID) }));
    await this.restoreChildPermissions(permissions?.data ?? []);
    await this.restoreChildForms(parseForms(forms?.data));
  }

  private async restoreChildPermissions(requests: PermissionRequest[]): Promise<void> {
    for (const request of requests) {
      if (request.sessionID !== this.sessionID && await this.belongsToChat(request.sessionID) && !this.disposed) this.receivePermission(request);
    }
  }

  private async restoreChildForms(forms: PendingForm[]): Promise<void> {
    for (const form of forms) {
      if (form.sessionID !== this.sessionID && await this.belongsToChat(form.sessionID) && !this.disposed) this.set((state) => ({ forms: addForm(state.forms, form) }));
    }
  }
  private readonly previews = new Map<string, { files: SentFile[]; images: readonly ImageAttachment[] }>();

  /** Keep the original object URLs for this session, so admission and delivery do not reload thumbnails. */
  previewFiles = (id: string): SentFile[] | undefined => this.previews.get(id)?.files;

  /** Show a prompt immediately, before its images have been encoded for the request. */
  stagePrompt(id: string, text: string, images: readonly ImageAttachment[]): boolean {
    if (this.disposed || this.state.phase !== 'ready' || this.state.submitting) return false;
    const files = images.map((image) => ({ kind: 'image' as const, name: image.name, mime: image.mime, src: image.url }));
    if (files.length) this.previews.set(id, { files, images });
    this.set((state) => ({ submitting: true, notice: null, local: [...state.local, { id, text, ...withFiles(files.length ? files : undefined) }] }));
    return true;
  }

  /** A failed preparation returns ownership of the files to the composer. */
  cancelStagedPrompt(id: string): void {
    this.previews.delete(id);
    this.set((state) => ({ submitting: false, local: state.local.filter((prompt) => prompt.id !== id) }));
  }
  private readonly client: OpenCodeClient;
  private readonly events: EventHub;
  private readonly ownsEvents: boolean;
  /** The last model this panel switched the session to; SSE state can lag that switch. */
  private switched: string | null = null;
  private directory: string | null = null;
  private sessionID: string | null;
  private preparedSession = false;
  private createdUnannounced = false;
  private browserOpening: Promise<void> | null = null;
  /** Events that arrive while a snapshot is in flight; replayed on top of it. */
  private buffer: ServerEvent[] | null = null;
  /** Cursor to the page before the oldest loaded message. */
  private older: string | null = null;
  /** The oldest loaded page's leading messages: the tail of a turn on the page before. */
  private orphans: unknown[] = [];

  constructor(private readonly options: ChatSessionOptions) {
    super(INITIAL_CHAT_STATE);
    const { connection, fetch } = options;
    this.client = createClient({ baseUrl: connection.baseUrl, token: connection.token, fetch });
    this.sessionID = options.sessionID ?? null;
    this.ownsEvents = !options.events;
    this.events =
      options.events ??
      new EventHub({
        connection,
        fetch,
        idleMs: options.idleMs,
        retryMs: options.retryMs,
        onUnauthorized: () => this.options.onUnauthorized?.(),
      });
    this.cleanups.push(
      this.events.subscribe(this.onEvent),
      this.events.onStatus(this.onStatus),
      this.events.onReconnect(() =>
        this.sessionID && this.state.phase === 'ready' ? this.resync() : Promise.resolve(),
      ),
    );
    if (this.ownsEvents) this.cleanups.push(() => this.events.dispose());
  }

  private get signal() {
    return this.lifetime.signal;
  }

  private unauthorized(error: unknown): boolean {
    if (!isUnauthorized(error)) return false;
    this.options.onUnauthorized?.();
    return true;
  }

  // ─── Loading and the event stream ──────────────────────────────────────

  /** Connects the event stream and prepares the workspace. Safe to call again after a failure. */
  load(): Promise<void> {
    return this.disposed || this.state.phase === 'ready' ? Promise.resolve() : this.once(() => this.runLoad());
  }

  private async runLoad(): Promise<void> {
    this.set({ phase: 'loading', error: null });
    let streamed = false;
    try {
      // The stream reports its own rejected token.
      await this.events.start();
      streamed = true;
      this.directory = await ensureWorkspace(this.client, this.options.connection.baseUrl);
      if (this.sessionID) await Promise.all([this.resync(), this.loadInfo()]);
      this.set({ phase: 'ready', connected: this.events.getStatus().state === 'connected', error: null });
    } catch (error) {
      this.loadFailed(error, streamed);
    }
  }

  /**
   * The server's default model, for a send that names none. Always send an explicit model: the
   * agent's own default can be one the provider rejects.
   */
  private async defaultModel(directory: string): Promise<{ providerID: string; id: string }> {
    const fallback = await this.client.model.default({ location: { directory } }, { signal: this.signal });
    const model: unknown = fallback.data;
    if (!isRecord(model) || typeof model.id !== 'string' || typeof model.providerID !== 'string') {
      throw { _tag: 'ModelNotSelectedError', message: NO_MODEL_MESSAGE };
    }
    return { providerID: model.providerID, id: model.id };
  }

  /** `streamed`: the stream connected, so a rejected token came from a request of ours. */
  private loadFailed(error: unknown, streamed: boolean): void {
    if (this.disposed) return;
    if (isSessionNotFound(error)) {
      this.set({ phase: 'failed', connected: false, error: 'This chat no longer exists.' });
      this.options.onMissing?.();
      return;
    }
    if (streamed) this.unauthorized(error);
    this.set({ phase: 'failed', connected: false, error: describeError(error) });
  }

  private onStatus = (status: HubStatus): void => {
    if (status.state === 'connected') {
      if (this.state.phase === 'ready') this.set({ connected: true });
    } else if (status.state === 'failed') {
      if (this.state.phase === 'ready') this.set({ phase: 'failed', connected: false, error: status.error });
    } else if (this.state.connected) {
      this.set({ connected: false });
    }
  };

  private onEvent = (event: ServerEvent): void => {
    if (this.buffer) this.buffer.push(event);
    else this.apply(event);
  };

  private apply(event: ServerEvent): void {
    this.queueChildRequest(event);
    if (this.applyForm(event) || !this.sessionID || event.data.sessionID !== this.sessionID) return;
    if (this.applyPermission(event)) return;
    if (this.applyLifecycle(event)) return;
    const durable = durablePatch(event);
    if (durable) this.set((state) => ({ durable: { ...state.durable, ...durable } }));
    this.applyExecutionInfo(event);
    this.applyTimeline(event, this.sessionID);
  }

  /** Folds an event into the timeline; reports the turn that just ended when the session goes idle. */
  private applyTimeline(event: ServerEvent, sessionID: string): void {
    const timeline = this.state.timeline;
    if (!timeline) return;
    const next = reduceTimeline(timeline, event);
    if (next === timeline) return;
    this.set({ timeline: next });
    const ended = timeline.working && !next.working ? next.turns.at(-1) : undefined;
    if (ended) this.options.onTurnEnded?.(this.client, sessionID, ended);
  }

  private queueChildRequest(event: ServerEvent): void {
    if (!this.options.includeSubagents || !(event.type.startsWith('permission.') || event.type.startsWith('form.'))) return;
    this.childEvents = this.childEvents.then(() => this.applyChildRequest(event)).catch(() => undefined);
  }

  private applyPermission(event: ServerEvent): boolean {
    if (event.type === 'permission.asked' && typeof event.data.id === 'string' && typeof event.data.action === 'string' && Array.isArray(event.data.resources)) {
      this.receivePermission(event.data as PermissionRequest);
      return true;
    }
    if (event.type === 'permission.replied' && typeof event.data.requestID === 'string') {
      this.set((state) => ({ permissions: state.permissions.filter((item) => item.id !== event.data.requestID) }));
      return true;
    }
    return false;
  }

  private applyExecutionInfo(event: ServerEvent): void {
    if (event.type === 'session.execution.started') {
      this.set((state) => ({ sessionInfo: { ...state.sessionInfo, outcome: undefined } }));
      return;
    }
    const outcomes = { 'session.execution.succeeded': 'succeeded', 'session.execution.failed': 'failed', 'session.execution.interrupted': 'interrupted' } as const;
    const outcome = outcomes[event.type as keyof typeof outcomes];
    if (outcome) this.set((state) => ({ sessionInfo: { ...state.sessionInfo, outcome, ended: event.created } }));
  }

  /** A rename or a deletion of the session; true when the event was one of those. */
  private applyLifecycle(event: ServerEvent): boolean {
    if (event.type === 'session.renamed') this.set({ title: titleOf(event.data) });
    else if (event.type === 'session.deleted') this.options.onMissing?.();
    else return false;
    return true;
  }

  /** Tracks the session's pending forms from the event stream; true when the event was a form event. */
  private applyForm(event: ServerEvent): boolean {
    if (!event.type.startsWith('form.')) return false;
    const sessionID = this.sessionID;
    if (sessionID) this.applyFormForSession(event, sessionID);
    return true;
  }

  private applyFormForSession(event: ServerEvent, sessionID: string): void {
    const created = createdForm(event, sessionID);
    const settled = settledFormID(event, sessionID);
    if (created) this.set((state) => ({ forms: addForm(state.forms, created) }));
    else if (settled) this.set((state) => ({ forms: removeForm(state.forms, settled) }));
  }

  /** The forms still waiting for an answer; best effort (the stream adds the rest). */
  private async loadForms(sessionID: string): Promise<void> {
    try {
      const forms = parseForms(await this.client.session.form.list({ sessionID }, { signal: this.signal }));
      if (sessionID === this.sessionID) this.set((state) => ({ forms: [...state.forms.filter((item) => item.sessionID !== sessionID), ...forms] }));
    } catch {
      // Keep the forms the stream delivered.
    }
  }

  /** Answers a pending form; the server's `form.replied` event then removes it. */
  async answerForm(formID: string, answer: FormAnswer): Promise<boolean> {
    return this.settleForm(formID, (sessionID) =>
      this.client.session.form.reply({ sessionID, formID, answer }, { signal: this.signal }),
    );
  }

  /** Declines a pending form, which fails the tool call that asked. */
  async cancelForm(formID: string): Promise<boolean> {
    return this.settleForm(formID, (sessionID) =>
      this.client.session.form.cancel({ sessionID, formID }, { signal: this.signal }),
    );
  }

  private async settleForm(formID: string, send: (sessionID: string) => Promise<unknown>): Promise<boolean> {
    const sessionID = this.state.forms.find((form) => form.id === formID)?.sessionID ?? this.sessionID;
    if (!sessionID) return false;
    try {
      await send(sessionID);
      this.set((state) => ({ forms: removeForm(state.forms, formID) }));
      return true;
    } catch (error) {
      if (this.disposed || this.unauthorized(error)) return false;
      // Answered or cancelled elsewhere, or gone: nothing left to ask.
      if (isFormGone(error)) this.set((state) => ({ forms: removeForm(state.forms, formID) }));
      else this.set({ notice: describeError(error) });
      return false;
    }
  }

  /**
   * The title, agent and model of an attached session; best effort (untitled until a
   * session.renamed event). A session that records no model keeps the one its last reply used.
   */
  private async loadInfo(): Promise<void> {
    try {
      const info = await this.client.session.get({ sessionID: this.sessionID! }, { signal: this.signal });
      const durable = durableOf(info);
      const record: Record<string, unknown> = isRecord(info) ? info : {};
      const time = isRecord(record.time) ? record.time : {};
      const outcome = record.outcome === 'succeeded' || record.outcome === 'failed' || record.outcome === 'interrupted' ? record.outcome : undefined;
      this.set((state) => ({
        title: titleOf(info),
        durable: durable?.model ? { ...state.durable, ...durable } : (state.durable ?? durable),
        sessionInfo: { started: typeof time.created === 'number' ? time.created : undefined, ended: typeof time.idle === 'number' ? time.idle : typeof time.updated === 'number' ? time.updated : undefined, outcome, ...state.sessionInfo },
      }));
    } catch {
      // Keep the current title.
    }
  }

  /** The agent and model of the newest reply, for a session that does not record its own. */
  private restoreDurable(messages: unknown[]): void {
    if (this.state.durable?.model) return;
    const last = messages.findLast((message) => isRecord(message) && message.type === 'assistant');
    const durable = durableOf(last);
    if (durable?.model) this.set({ durable });
  }

  /**
   * Rebuilds the timeline from the server (snapshot, inbox and active state). Turns paged in
   * earlier that are older than the new snapshot stay in front of it.
   */
  private async resync(): Promise<void> {
    const sessionID = this.sessionID!;
    const signal = this.signal;
    this.buffer ??= [];
    try {
      const [page, inbox, active] = await Promise.all([
        this.client.message.list({ sessionID, order: 'desc', limit: PAGE_LIMIT }, { signal }),
        this.client.session.inbox.list({ sessionID }, { signal }),
        this.client.session.active({ signal }),
        this.loadForms(sessionID),
        this.loadPermissions(sessionID),
        this.loadChildRequests(),
      ]);
      const { messages, next } = readPage(page);
      this.restoreDurable(messages);
      const running = isRecord(active) && isRecord((active as Record<string, unknown>)[sessionID]);
      this.adopt(timelineFromSnapshot(sessionID, { messages, inbox, running, hasEarlier: next !== null }), messages, next);
    } finally {
      const pending = this.buffer ?? [];
      this.buffer = null;
      for (const event of pending) this.apply(event);
    }
  }

  /**
   * Shows a fresh snapshot. When it overlaps turns paged in earlier (a resync after a reconnect),
   * the older turns stay in front and paging continues where it was; otherwise paging restarts.
   */
  private adopt(snapshot: Timeline, messages: unknown[], next: string | null): void {
    const previous = this.state.timeline?.turns ?? [];
    const first = snapshot.turns[0];
    const overlap = first ? previous.findIndex((turn) => turn.id === first.id) : -1;
    const turns = overlap > 0 ? [...previous.slice(0, overlap), ...snapshot.turns] : snapshot.turns;
    if (overlap <= 0) {
      this.older = next;
      this.orphans = leadingOrphans(messages);
    }
    this.set({
      timeline: { ...snapshot, turns, reverted: this.state.timeline?.reverted ?? false },
      hasEarlier: this.older !== null,
    });
  }

  /** Loads the page of messages before the oldest one shown. */
  async loadEarlier(): Promise<void> {
    const sessionID = this.sessionID;
    if (!sessionID || !this.older || this.state.loadingEarlier || !this.state.timeline) return;
    this.set({ loadingEarlier: true });
    try {
      const page = await this.client.message.list(
        { sessionID, cursor: this.older, limit: PAGE_LIMIT },
        { signal: this.signal },
      );
      const { messages, next } = readPage(page);
      const { timeline, orphans } = prependHistory(this.state.timeline!, messages, this.orphans, next !== null);
      this.older = next;
      this.orphans = orphans;
      this.set({ timeline, hasEarlier: next !== null });
    } catch (error) {
      if (!this.disposed && !this.unauthorized(error)) this.set({ notice: describeError(error) });
    } finally {
      this.set({ loadingEarlier: false });
    }
  }

  /**
   * A page of a background shell's output from `cursor` (a shell tool's live output), or
   * `missing` once the server no longer keeps it. Other failures throw.
   */
  readonly shellOutput: ShellOutputLoader = async (id, cursor) => {
    try {
      const page = await this.client.shell.output(
        { id, cursor, ...(this.directory ? { location: { directory: this.directory } } : {}) },
        { signal: this.signal },
      );
      return { output: page.data.output, cursor: page.data.cursor, size: page.data.size };
    } catch (error) {
      if (isShellNotFound(error)) return 'missing';
      throw error;
    }
  };

  // ─── Sending and stopping ──────────────────────────────────────────────

  /** Creates the session on the first send, with the chosen agent and model (else the default model). */
  private async ensureSession(selection: Selection | undefined): Promise<{ sessionID: string; created: boolean }> {
    if (this.sessionID) {
      await this.prepareCurrentSession(selection);
      return { sessionID: this.sessionID, created: false };
    }
    const model = selection ? wireModel(selection) : await this.defaultModel(this.directory!);
    const permissions = await this.options.sessionPermissions?.();
    // No title: opencode names an untitled session from its first message.
    const session = await this.client.session.create(
      {
        location: { directory: this.directory! },
        ...(selection ? { agent: selection.agent } : {}),
        model,
        metadata: EXTENSION_METADATA,
        ...(permissions?.length ? { permissions } : {}),
      },
      { signal: this.signal },
    );
    this.adoptSession(session, { agent: selection?.agent, model: modelOf(model) });
    this.createdUnannounced = true;
    await this.prepareCurrentSession(selection);
    if (selection) this.switched = selectionKey({ ...selection.model, variant: selection.variant });
    return { sessionID: session.id, created: true };
  }

  /** Attach the panel's web tab before the first prompt, creating the chat if needed. */
  openBrowserSession(): Promise<void> {
    if (this.browserOpening) return this.browserOpening;
    if (this.disposed || this.state.phase !== 'ready' || this.state.submitting) return Promise.resolve();
    const opening = this.ensureSession(undefined).then(() => undefined).catch((error) => {
      if (!this.disposed && !this.unauthorized(error)) this.set({ notice: describeError(error) });
    });
    this.browserOpening = opening.finally(() => { this.browserOpening = null; });
    return this.browserOpening;
  }

  private async prepareCurrentSession(selection: Selection | undefined): Promise<void> {
    if (this.preparedSession || !this.sessionID) return;
    await this.options.prepare?.(this.client, this.sessionID);
    this.preparedSession = true;
    if (this.createdUnannounced) {
      this.options.onCreated?.(this.sessionID, selection);
      this.createdUnannounced = false;
    }
  }

  /** The created session is the chat's now. The server records what was sent; the response may not echo it. */
  private adoptSession(session: { id: string }, sent: DurableSelection): void {
    this.sessionID = session.id;
    const echoed = durableOf(session);
    this.set({
      timeline: emptyTimeline(session.id),
      title: titleOf(session),
      durable: { agent: echoed?.agent ?? sent.agent, model: echoed?.model ?? sent.model },
    });
  }

  /**
   * Switches the session's agent, then its model, before a prompt joins it. An unchanged model is
   * skipped so a send never waits on that request; an agent switch can move the model, and the
   * session's reported model can lag this panel's earlier switch, which must also match.
   */
  private async applySelection(sessionID: string, selection: Selection): Promise<void> {
    const current = this.state.durable;
    if (current?.agent !== selection.agent) {
      await this.client.session.switchAgent({ sessionID, agent: selection.agent }, { signal: this.signal });
    }
    const wanted = selectionKey({ ...selection.model, variant: selection.variant });
    if (this.hasModel(current, selection.agent, wanted)) return;
    await this.client.session.switchModel({ sessionID, model: wireModel(selection) }, { signal: this.signal });
    this.switched = wanted;
  }

  /**
   * The session already ran this agent with this model and variant before the send, as this panel
   * last left it. `current` is read before any agent switch, which can move the model.
   */
  private hasModel(current: DurableSelection | null, agent: string, wanted: string): boolean {
    const saved = current?.model && selectionKey(current.model);
    return current?.agent === agent && saved === wanted && (this.switched ?? wanted) === wanted;
  }

  /**
   * Sends a prompt as a steer: it starts a turn, or joins the running one at its next step.
   * Returns false when nothing was sent, so the caller can put the text back in the composer.
   * `id` lets the caller know the message's ID up front (the send animation follows it).
   * `selection` is the agent, model and variant to use; it is applied to the session first.
   * `files` are attachments sent inline with the text (images, as opencode's `Prompt.files`).
   */
  private localForSubmit(id: string, text: string, files?: readonly PromptFile[]): LocalPrompt | null {
    const staged = this.state.local.find((prompt) => prompt.id === id);
    if (this.disposed || this.state.phase !== 'ready' || (this.state.submitting && !staged)) return null;
    const local = staged ?? { id, text, ...withFiles(parseSentFiles(files)) };
    if (!staged) this.set((state) => ({ submitting: true, notice: null, local: [...state.local, local] }));
    return local;
  }

  async submit(
    text: string,
    id: string = createMessageID(),
    selection?: Selection,
    files?: readonly PromptFile[],
    refs?: PromptRefs,
  ): Promise<boolean> {
    const local = this.localForSubmit(id, text, files);
    if (!local) return false;
    try {
      const sessionID = await this.readyToSend(selection);
      const ack: unknown = await this.client.session.prompt(
        promptBody(sessionID, local, files, refs) as never,
        { signal: this.signal },
      );
      this.admit(ack, local);
      return true;
    } catch (error) {
      this.sendFailed(error);
      return false;
    } finally {
      this.set((state) => ({ submitting: false, local: state.local.filter((p) => p.id !== local.id) }));
    }
  }

  /**
   * Gets the chat ready for a send: the browser session attached, the session created (on a new
   * chat) or switched to `selection`, and the caller's pre-prompt step done. Returns the session.
   */
  private async readyToSend(selection: Selection | undefined): Promise<string> {
    await this.browserOpening;
    const { sessionID, created } = await this.ensureSession(selection);
    if (selection && !created) await this.applySelection(sessionID, selection);
    await this.options.beforePrompt?.();
    return sessionID;
  }

  /** A failed send says why, unless the chat is gone or the pairing was rejected. */
  private sendFailed(error: unknown): void {
    if (!this.disposed && !this.unauthorized(error)) this.set({ notice: describeError(error) });
  }

  /** The workspace this chat's paths are relative to; null until the chat loads. */
  get workspace(): string | null {
    return this.directory;
  }

  /**
   * Runs one of the server's slash commands (`/name args`) in this chat, creating the session on a
   * new chat's first send. The server adds the command's own prompt to the conversation, so no
   * local bubble is staged. Returns false when nothing was sent.
   */
  async command(name: string, args: string, selection?: Selection, files?: readonly PromptFile[]): Promise<boolean> {
    return this.sending(async () => {
      const sessionID = await this.readyToSend(selection);
      await this.client.session.command({ sessionID, name, text: args, ...(files?.length ? { files } : {}) }, { signal: this.signal });
    });
  }

  /** Runs one request a send makes, flagging the chat as submitting meanwhile. False when it failed or could not start. */
  private async sending(send: () => Promise<void>): Promise<boolean> {
    if (this.disposed || this.state.phase !== 'ready' || this.state.submitting) return false;
    this.set({ submitting: true, notice: null });
    try {
      await send();
      return true;
    } catch (error) {
      this.sendFailed(error);
      return false;
    } finally {
      this.set({ submitting: false });
    }
  }

  /**
   * Asks the server to compact this chat (`/compact`): it summarises the conversation so far and
   * goes on from the summary. Behind a running turn it waits in the queue; the compaction's events
   * then show it in the chat. Returns false when nothing was sent.
   */
  async compact(): Promise<boolean> {
    const sessionID = this.sessionID;
    const timeline = this.state.timeline;
    if (!sessionID || !timeline?.turns.length) {
      this.set({ notice: 'Nothing to compact yet.' });
      return false;
    }
    return this.sending(async () => {
      await this.client.session.compact({ sessionID, ...(timeline.working ? { delivery: 'queue' as const } : {}) }, { signal: this.signal });
    });
  }

  override dispose(): void {
    if (this.disposed) return;
    for (const preview of this.previews.values()) preview.images.forEach(releaseImage);
    this.previews.clear();
    super.dispose();
  }

  private admit(ack: unknown, local: LocalPrompt): void {
    const timeline = this.state.timeline;
    if (timeline) this.set({ timeline: admitPrompt(timeline, parseAck(ack, local)) });
  }

  /**
   * Moves the running turn's blocking work (its foreground subagents and shell commands) to the
   * background, so the agent goes on while it runs. The server moves all of it at once, ignores a
   * repeated move, and tells the agent in the conversation; the calls then return as running.
   */
  async moveToBackground(): Promise<void> {
    if (!this.sessionID) return;
    try {
      await this.client.session.background({ sessionID: this.sessionID }, { signal: this.signal });
    } catch (error) {
      if (!this.disposed && !this.unauthorized(error)) this.set({ notice: describeError(error) });
    }
  }

  /**
   * The panel is closing: stop the agent it started, so it does not keep working unseen. A
   * `keepalive` request outlives the page; the SDK client's requests would be cancelled with it.
   * Queued prompts are dropped too (no `resume`), since nobody is left to watch them run.
   */
  interruptOnClose(): void {
    const { timeline, submitting } = this.state;
    const running = timeline?.working === true || (timeline?.pending.length ?? 0) > 0;
    if (!this.sessionID || !(running || submitting)) return;
    const { baseUrl, token } = this.options.connection;
    void (this.options.fetch ?? fetch)(`${baseUrl}/api/session/${encodeURIComponent(this.sessionID)}/interrupt`, {
      method: 'POST',
      keepalive: true,
      headers: { authorization: authHeader(token) },
    }).catch(() => undefined);
  }

  /** Interrupts the running turn. `resume` lets prompts that are still waiting continue. */
  async stop(resume = true): Promise<void> {
    if (!this.sessionID || this.state.interrupting) return;
    this.set({ interrupting: true });
    try {
      await this.client.session.interrupt({ sessionID: this.sessionID, ...(resume ? { resume: true } : {}) }, { signal: this.signal });
    } catch (error) {
      // The execution events report the outcome; a failed stop leaves the turn running.
      if (!resume && !this.disposed && !this.unauthorized(error)) this.set({ notice: describeError(error) });
    } finally {
      this.set({ interrupting: false });
    }
  }
}

export type PendingMessage = { id: string; text: string; status: PendingStatus; local: boolean; files?: SentFile[]; goal?: GoalStart };

/**
 * Prompts waiting for delivery, shown after the conversation: the ones the server holds (in its
 * order), then the ones this panel sent that it has not admitted yet.
 */
export function pendingMessages(state: Pick<ChatState, 'timeline' | 'local'>, previewFiles?: (id: string) => SentFile[] | undefined): PendingMessage[] {
  const t = state.timeline;
  const items = t?.pending ?? [];
  const admitted = items.map((item) => ({
    id: item.id,
    text: item.text,
    status: t ? pendingStatus(t, item) : ('starting' as PendingStatus),
    local: false,
    files: previewFiles?.(item.id) ?? item.files,
    ...(item.goal && { goal: item.goal }),
  }));
  // Runs on every streamed update: skip the id set when this panel has nothing unadmitted.
  if (state.local.length === 0) return admitted;
  const known = new Set([...items.map((item) => item.id), ...(t?.turns.map((turn) => turn.id) ?? [])]);
  const waiting: PendingStatus = t?.working && t.deliveredSinceIdle ? 'steering' : 'starting';
  const local = state.local
    .filter((prompt) => !known.has(prompt.id))
    .map((prompt) => ({ id: prompt.id, text: prompt.text, status: waiting, local: true, files: prompt.files }));
  return [...admitted, ...local];
}
