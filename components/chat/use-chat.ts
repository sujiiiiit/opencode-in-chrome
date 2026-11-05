import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { loadActiveChat, saveActiveChat } from '@/lib/opencode/active-chat';
import { promptFiles, type ImageAttachment } from '@/lib/opencode/attachments';
import { ChatSession, INITIAL_CHAT_STATE, type ChatState } from '@/lib/opencode/chat';
import type { Connection } from '@/lib/opencode/connection';
import { EventHub } from '@/lib/opencode/events';
import { HistoryStore, INITIAL_HISTORY_STATE } from '@/lib/opencode/history';
import { createMessageID } from '@/lib/opencode/ids';
import { NO_MODEL_MESSAGE } from '@/lib/opencode/client';
import type { ModelControls } from '@/lib/opencode/models/controls';
import type { ModelStore } from '@/lib/opencode/models/model-store';
import type { Selection } from '@/lib/opencode/models/selection';
import type { PromptBoxHandle } from './prompt-box/prompt-box';
import { launchSendFlight } from './send-flight';
import { useAttachedImages } from './use-attachments';
import { ensureBrowserToolsReady, prepareBrowserSession } from '@/lib/browser/guidance';

const noopSubscribe = () => () => undefined;

/** Keeps the latest callback in a ref, so long-lived objects never call a stale one. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * The panel's one event stream, shared by the open chat and the history list. Created inside
 * the effect so React StrictMode's mount/unmount/mount in development disposes the first one.
 */
export function useEventHub(connection: Connection, onUnauthorized: () => void): EventHub | null {
  const [hub, setHub] = useState<EventHub | null>(null);
  const unauthorized = useLatest(onUnauthorized);
  useEffect(() => {
    const events = new EventHub({ connection, onUnauthorized: () => unauthorized.current() });
    setHub(events);
    return () => events.dispose();
  }, [connection, unauthorized]);
  return hub;
}

/** Which chat to show: a stored session, or a new one (null). `key` remounts the same target. */
type Target = { sessionID: string | null; key: number };

export const DELETED_NOTICE = 'That chat was deleted. Starting a new one.';

/** Remembers the open chat for the next panel open; best effort. */
function rememberChat(baseUrl: string, sessionID: string | null): void {
  void saveActiveChat(baseUrl, sessionID).catch(() => undefined);
}

/** Resumes the chat the panel showed last on this server (null: a new chat) once storage answers. */
function useLastChat(baseUrl: string, resume: (sessionID: string | null) => void) {
  useEffect(() => {
    let cancelled = false;
    void loadActiveChat(baseUrl)
      .catch(() => null)
      .then((sessionID) => {
        if (!cancelled) resume(sessionID);
      });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, resume]);
}

type ChatHandlers = {
  onCreated: (sessionID: string, selection?: Selection) => void;
  onMissing: () => void;
  onUnauthorized: () => void;
};

/** The ChatSession for a target, rebuilt when the target changes; handlers are read through a ref. */
function useChatStore(connection: Connection, hub: EventHub | null, target: Target | null, handlers: RefObject<ChatHandlers>) {
  const [chat, setChat] = useState<ChatSession | null>(null);
  useEffect(() => {
    if (!hub || !target) return;
    const session = new ChatSession({
      connection,
      events: hub,
      sessionID: target.sessionID ?? undefined,
      onCreated: (sessionID, selection) => handlers.current.onCreated(sessionID, selection),
      prepare: prepareBrowserSession,
      beforePrompt: ensureBrowserToolsReady,
      onMissing: () => handlers.current.onMissing(),
      onUnauthorized: () => handlers.current.onUnauthorized(),
    });
    setChat(session);
    void session.load();
    return () => session.dispose();
  }, [connection, hub, target, handlers]);
  const state = useSyncExternalStore(chat?.subscribe ?? noopSubscribe, chat?.getState ?? (() => INITIAL_CHAT_STATE));
  return { chat, state };
}

/**
 * One ChatSession for the chat on screen. It resumes the chat the panel showed last, switches
 * to another (`open`) or a new one (`newChat`), and remembers the choice for the next time the
 * panel opens.
 */
export function useChatSession(
  connection: Connection,
  hub: EventHub | null,
  onUnauthorized: () => void,
  /** The new chat's first send created its session, with this selection. */
  onCreated?: (sessionID: string, selection?: Selection) => void,
) {
  const { baseUrl } = connection;
  const [target, setTarget] = useState<Target | null>(null);
  /** The server session on screen; null for a new chat until its first send. */
  const [activeID, setActiveID] = useState<string | null>(null);
  /** Why the panel moved to a new chat on its own. */
  const [notice, setNotice] = useState<string | null>(null);

  const show = useCallback(
    (sessionID: string | null) => {
      setActiveID(sessionID);
      setTarget((current) => ({ sessionID, key: (current?.key ?? 0) + 1 }));
      rememberChat(baseUrl, sessionID);
    },
    [baseUrl],
  );

  const resume = useCallback((sessionID: string | null) => {
    setActiveID(sessionID);
    setTarget({ sessionID, key: 0 });
  }, []);
  useLastChat(baseUrl, resume);

  const handlers = useLatest<ChatHandlers>({
    // The first send created the session: follow it and remember it for the next panel open.
    onCreated: (sessionID, selection) => {
      onCreated?.(sessionID, selection);
      setActiveID(sessionID);
      rememberChat(baseUrl, sessionID);
    },
    onMissing: () => {
      setNotice(DELETED_NOTICE);
      show(null);
    },
    onUnauthorized,
  });
  const { chat, state } = useChatStore(connection, hub, target, handlers);

  const open = useCallback(
    (sessionID: string) => {
      setNotice(null);
      if (sessionID !== activeID) show(sessionID);
    },
    [activeID, show],
  );
  const newChat = useCallback(() => {
    setNotice(null);
    show(null);
  }, [show]);
  const dismissNotice = useCallback(() => {
    setNotice(null);
    chat?.dismissNotice();
  }, [chat]);

  return { chat, state, activeID, notice: state.notice ?? notice, open, newChat, dismissNotice };
}

/**
 * The extension's chat history. The store is created the first time `enabled` is true (the
 * History view opens) and kept afterwards, so the list stays live and opens instantly.
 */
export function useHistory(connection: Connection, hub: EventHub | null, enabled: boolean, onUnauthorized: () => void) {
  const [store, setStore] = useState<HistoryStore | null>(null);
  const [active, setActive] = useState(enabled);
  const unauthorized = useLatest(onUnauthorized);
  useEffect(() => {
    if (enabled) setActive(true);
  }, [enabled]);

  useEffect(() => {
    if (!hub || !active) return;
    const history = new HistoryStore({ connection, events: hub, onUnauthorized: () => unauthorized.current() });
    setStore(history);
    void history.load();
    return () => history.dispose();
  }, [connection, hub, active, unauthorized]);

  const state = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getState ?? (() => INITIAL_HISTORY_STATE),
  );
  return { store, state };
}

const selectionKey = (selection: Selection | undefined) =>
  selection ? `${selection.agent}/${selection.model.providerID}/${selection.model.modelID}/${selection.variant ?? ''}` : '';

type ComposerModels = { store: ModelStore | null; controls: ModelControls; phase: string };
type Retry = { id: string; text: string; selection: string };

/** Why a send cannot go out with the loaded models, or null (a failed catalog sends with the default). */
function missingSelection(models: ComposerModels | undefined): string | null {
  if (models?.phase !== 'ready' || models.controls.selection) return null;
  return models.controls.empty ? NO_MODEL_MESSAGE : 'Choose a model and an agent to send.';
}

/** Image types xAI rejects with `invalid_image` (opencode's model-request.ts swaps them for an error). */
const XAI_REJECTED = new Set(['image/gif']);

/**
 * Why the chosen model cannot take these images, or null (an unknown model is left to the server).
 * Mirrors the server's `unsupportedMedia`, which would otherwise swap each image for an error note.
 */
function unreadableImages(models: ComposerModels | undefined, images: readonly ImageAttachment[]): string | null {
  const model = models?.controls.model.current;
  if (images.length === 0 || !model) return null;
  if (!model.inputs.includes('image')) return `${model.name} can't read images. Choose a model that supports images, or remove them.`;
  const rejected = model.providerID === 'xai' ? images.find((image) => XAI_REJECTED.has(image.mime)) : undefined;
  return rejected ? `${model.name} can't read GIF images (${rejected.name}). Remove it or choose another model.` : null;
}

/** What makes a retry the same prompt: the selection and the attached images. */
const retryKey = (selection: Selection | undefined, images: readonly ImageAttachment[]) =>
  [selectionKey(selection), ...images.map((image) => image.id)].join('|');

/** Why this send cannot go out, or null. */
const sendBlocker = (models: ComposerModels | undefined, images: readonly ImageAttachment[]) =>
  missingSelection(models) ?? unreadableImages(models, images);

/** A failed send's ID when this send repeats it (same text, images and selection), else a new one. */
function messageID(retry: Retry | null, text: string, selection: string): string {
  return retry && retry.text === text && retry.selection === selection ? retry.id : createMessageID();
}

/**
 * Reads the images after the local bubble is added and its flight has begun.
 * False when nothing was sent: an image that can no longer be read fails the whole send.
 */
async function submitPrompt(
  chat: ChatSession,
  prompt: { text: string; id: string; selection: Selection | undefined; images: readonly ImageAttachment[] },
  notify: (message: string) => void,
): Promise<boolean> {
  const files = await promptFiles(prompt.images).catch(() => null);
  if (!files) {
    notify("Couldn't read an attached image. Remove it and attach it again.");
    return false;
  }
  return chat.submit(prompt.text, prompt.id, prompt.selection, files);
}

/** Tells the store an existing chat is switching selection; returns the cancel for a failed send. */
function trackCommit(store: ModelStore | null | undefined, chat: ChatSession, selection: Selection | undefined) {
  const sessionID = chat.getState().timeline?.sessionID;
  return (sessionID && selection && store?.trackCommit(sessionID, selection)) || (() => undefined);
}

/**
 * The composer's behavior, ported from opencode's composer model: a submit sends the draft as a
 * steer (or stops a running turn when the box is empty) with the chosen agent, model and effort,
 * and a send is held while the chat or the models load.
 */
export function useComposer(input: {
  chat: ChatSession | null;
  state: ChatState;
  box: RefObject<PromptBoxHandle | null>;
  models?: ComposerModels;
}) {
  const { chat, state, box, models } = input;
  const modelStore = models?.store;
  const selection = models?.controls.selection;
  // A failed send keeps its ID: retrying the same text with the same selection is the same prompt.
  const retry = useRef<Retry | null>(null);
  const [draft, setDraft] = useState('');
  // The draft a send waits on while the models load; it only goes out if the box still holds it.
  const [held, setHeld] = useState<string | null>(null);
  // Async handlers read the latest draft, not the render they started in.
  const draftRef = useRef('');
  const setText = useCallback((text: string, focus = false) => box.current?.setText(text, { focus }), [box]);
  const attachments = useAttachedImages(box, modelStore);

  const working = state.timeline?.working ?? false;
  const blank = draft.trim() === '';
  // A ready session that lost its event stream cannot send until it reconnects.
  const available = state.phase !== 'ready' || state.connected;

  const onChange = useCallback((text: string) => {
    draftRef.current = text;
    setDraft(text);
    setHeld((current) => (current !== null && current !== text ? null : current));
  }, []);

  /** The models are still loading (a failed catalog falls back to the server's default model). */
  const modelsLoading = !!models && (models.phase === 'idle' || models.phase === 'loading');

  const send = async () => {
    const text = draftRef.current.trim();
    if (!chat || !text) return;
    const notice = sendBlocker(models, attachments.current.current);
    if (notice) return void modelStore?.notify(notice);
    const key = retryKey(selection, attachments.current.current);
    const id = messageID(retry.current, text, key);
    retry.current = null;
    // The text flies from where it sits in the box to its bubble, so measure before clearing.
    const from = box.current?.textOrigin() ?? null;
    setText('');
    const attached = attachments.take();
    if (!chat.stagePrompt(id, text, attached)) {
      setText(joinDraft(draftRef.current, text), true);
      attachments.restore(attached);
      return;
    }
    launchSendFlight({ id, from });
    const cancel = trackCommit(modelStore, chat, selection);
    const notify = (message: string) => modelStore?.notify(message);
    if (await submitPrompt(chat, { text, id, selection, images: attached }, notify)) return;
    chat.cancelStagedPrompt(id);
    cancel();
    retry.current = { id, text, selection: key };
    // A failed send puts the text and images back, after anything added meanwhile.
    setText(joinDraft(draftRef.current, text), true);
    attachments.restore(attached);
  };

  // A held send goes out once the chat and the models are loaded, if the draft did not change meanwhile.
  useEffect(() => {
    if (held === null || state.phase === 'loading' || modelsLoading) return;
    setHeld(null);
    if (state.phase === 'ready' && draftRef.current === held) void send();
  }, [state.phase, modelsLoading, held]);

  const submit = () => {
    if (!chat) return;
    if (!draftRef.current.trim()) {
      // Enter on an empty box stops a running turn, like the Stop button.
      if (working) void chat.stop();
      return;
    }
    if (!available || state.submitting) return;
    if (state.phase === 'ready' && !modelsLoading) {
      void send();
      return;
    }
    setHeld(draftRef.current);
    void chat.load();
    void modelStore?.load();
  };

  const stop = () => {
    // Stopping a held send cancels it and leaves the prompt in the composer.
    if (held !== null) setHeld(null);
    else void chat?.stop();
  };

  return {
    working,
    held: held !== null,
    stopping: working && blank,
    disabled: !available || blank,
    placeholder: working ? 'Add a follow-up…' : undefined,
    onChange,
    submit,
    stop,
    images: attachments.images,
    addFiles: attachments.addFiles,
    removeImage: attachments.removeImage,
  };
}

/** Appends restored text to a draft after a blank line. */
function joinDraft(draft: string, text: string): string {
  return draft.trim()
    ? `${draft}

${text}`
    : text;
}
