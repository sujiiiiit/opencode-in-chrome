import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsContent, TabsContentWrapper, useTabPanelActive } from '@/components/ui/tabs';
import { ChatSession, INITIAL_CHAT_STATE, pendingMessages, type ChatState } from '@/lib/opencode/chat';
import type { Turn } from '@/lib/opencode/timeline';
import { PINNED_SERVER_VERSION } from '@/lib/opencode/client';
import type { Connection } from '@/lib/opencode/connection';
import type { EventHub } from '@/lib/opencode/events';
import type { Selection } from '@/lib/opencode/models/selection';
import { displayTitle, isUntitled } from '@/lib/opencode/sessions';
import { ShellOutputProvider, useLingering } from './flow/live';
import { MorphText } from './flow/morph-text';
import { MarqueeTitle } from './marquee-title';
import { HistoryView } from './history/history-view';
import { MessageList } from './message-list';
import { ModelControls } from './model/model-controls';
import { ModelPicker } from './model/model-picker';
import { ModelCatalogProvider } from './model/model-names';
import { useModelShortcuts, useModelStore, useModelSync } from './model/use-models';
import { FormCard } from './form-card';
import { Notice } from './notice';
import { DropOverlay } from './drop-overlay';
import { useFileDrop } from './use-file-drop';
import { AttachMenu } from './prompt-box/attach-menu';
import { AttachmentStrip } from './prompt-box/attachment-strip';
import { PromptBox, type PromptBoxHandle } from './prompt-box/prompt-box';
import { useChatSession, useComposer, useEventHub, useHistory, useLatest } from './use-chat';
import { SubagentTabs } from './subagent-tabs';

type Props = {
  connection: Connection;
  tabId?: number;
  /** The server rejected our token (HTTP 401). */
  onUnauthorized: () => void;
};

const APP_NAME = 'Opencode';
const DAY_MS = 86_400_000;
const EXPIRY_WARNING_DAYS = 5;
/** One empty list, so a chat with no timeline yet keeps the same props between renders. */
const NO_TURNS: Turn[] = [];

function Banner({ children }: { children: string }) {
  return (
    <p className="bg-muted px-3 py-1.5 text-xs text-muted-foreground">
      <span className="mx-auto block w-full max-w-chat">{children}</span>
    </p>
  );
}

/** A version mismatch, and a pairing that expires soon. */
function ConnectionBanners({ connection }: { connection: Connection }) {
  const daysLeft = Math.ceil((connection.expiresAt - Date.now()) / DAY_MS);
  const mismatch = connection.serverVersion && connection.serverVersion !== PINNED_SERVER_VERSION;
  return (
    <>
      {mismatch && (
        <Banner>{`Server is ${connection.serverVersion}; this extension was built for ${PINNED_SERVER_VERSION}.`}</Banner>
      )}
      {daysLeft <= EXPIRY_WARNING_DAYS && (
        <Banner>{`Pairing expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}. Pair again soon.`}</Banner>
      )}
    </>
  );
}

/** Opens the settings page (entrypoints/settings) in a new browser tab. */
function openSettings() {
  void browser.tabs.create({ url: browser.runtime.getURL('/settings.html') });
}

function ChatHeader({
  title,
  activeID,
  onHistory,
  onNewChat,
}: {
  title: string;
  /** The open chat's id, so the title id is stable per chat and changes when a chat is named. */
  activeID: string | null;
  onHistory: () => void;
  onNewChat: () => void;
}) {
  // Morph from the "New chat" placeholder to the real title once the chat is named, and again
  // when switching chats (the id changes). Under one id the text just eases its width instead.
  const id = activeID && title !== 'New chat' ? `title:${activeID}` : 'untitled';

  return (
    <header className="mx-auto flex w-full max-w-chat shrink-0 items-center gap-2 px-4 py-1.5">
      <MarqueeTitle title={title} className="flex-1 text-sm text-text-primary">
        <MorphText id={id} text={title} textSlot="chat-title" />
      </MarqueeTitle>
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon-lg" aria-label="Settings" title="Settings" onClick={openSettings}>
          <Icon name="settings" />
        </Button>
        <Button variant="ghost" size="icon-lg" aria-label="History" title="History" onClick={onHistory}>
          <Icon name="history" />
        </Button>
        <Button variant="ghost" size="icon-lg" aria-label="New chat" title="New chat" onClick={onNewChat}>
          <Icon name="new-chat" />
        </Button>
      </div>
    </header>
  );
}

type Models = ReturnType<typeof useModelStore>;

type ChatPaneProps = {
  connection: Connection;
  session: ReturnType<typeof useChatSession>;
  models: Models;
  hub: EventHub | null;
  onUnauthorized: () => void;
  /** The chat is the view on screen (not History): files can be dropped on it. */
  active: boolean;
  onHistory: () => void;
  onNewChat: () => void;
};

/**
 * The open chat's title for display: opencode names an untitled chat from its first message.
 * Like opencode's web app, the page title is "<title> · Opencode", or the app name while untitled.
 */
function useChatTitle(activeID: string | null, title: string | null): string {
  const named = activeID && !isUntitled(title) ? title : null;
  useEffect(() => {
    document.title = named ? `${named} · ${APP_NAME}` : APP_NAME;
  }, [named]);
  return displayTitle(named);
}

/** A transient failure (dismissible), else why loading failed (the chat, then the models). */
function PaneNotice({ session, models }: { session: ReturnType<typeof useChatSession>; models: Models }) {
  const { state, notice, dismissNotice } = session;
  if (notice) return <Notice text={notice} onDismiss={dismissNotice} />;
  if (models.state.notice) return <Notice text={models.state.notice} onDismiss={() => models.store?.dismissNotice()} />;
  if (state.phase === 'failed' && state.error) return <Notice text={state.error} />;
  if (models.state.phase === 'failed' && models.state.error) {
    return <Notice text={`Couldn't load models (using the default): ${models.state.error}`} />;
  }
  return null;
}

/** The model and effort chips under the composer, once the store exists. */
function ComposerFooter({ models, onOpenPicker }: { models: Models; onOpenPicker: () => void }) {
  const store = models.store;
  if (!store) return null;
  return (
    <ModelControls
      controls={models.controls}
      onOpenPicker={onOpenPicker}
      // onAgent={(name) => store.setAgent(name)}
      onVariant={(value) => store.setVariant(value)}
    />
  );
}

/**
 * The question the running turn is asking (the oldest, when several wait), asked inside the
 * prompt box. Keyed by form, so the next one starts from its own first page and defaults.
 */
function paneQuestion({ chat, state }: ReturnType<typeof useChatSession>): ReactNode {
  const form = state.forms[0];
  if (!form) return null;
  return (
    <FormCard
      key={form.id}
      form={form}
      onAnswer={(id, answer) => chat?.answerForm(id, answer)}
      onCancel={(id) => chat?.cancelForm(id)}
    />
  );
}

/** The model picker's open state and its shortcuts (⌘' opens it, ⇧⌘D cycles the effort). */
function usePicker(models: Models, box: RefObject<PromptBoxHandle | null>) {
  const [picking, setPicking] = useState(false);
  const store = models.store;
  const open = useCallback(() => {
    if (store && !models.controls.loading) setPicking(true);
  }, [store, models.controls.loading]);
  useModelShortcuts(!picking, {
    openPicker: open,
    cycleVariant: () => store?.cycleVariant(),
    // Agent switching is hidden for now (build mode only).
    // moveAgent: (direction) => store?.moveAgent(direction),
  });
  const onOpenChange = useCallback(
    (next: boolean) => {
      setPicking(next);
      // Back to the message after choosing, like opencode's composer.
      if (!next) requestAnimationFrame(() => box.current?.focus());
    },
    [box],
  );
  return { picking, open, onOpenChange };
}

type ChatComposerProps = {
  box: RefObject<PromptBoxHandle | null>;
  composer: ReturnType<typeof useComposer>;
  models: Models;
  /** The chat is on screen: files dropped on the panel attach to the draft. */
  active: boolean;
  /** A question the agent asks, shown in the box in place of the editor. */
  question: ReactNode;
  onOpenPicker: () => void;
};

/**
 * The prompt box with its attach menu, attached images and model chips, and the drop zone that
 * covers the whole pane (the overlay is placed against the pane, its nearest positioned box).
 */
function ChatComposer({ box, composer, models, active, question, onOpenPicker }: ChatComposerProps) {
  // History, sliding over the chat, takes no drops.
  const panelActive = useTabPanelActive();
  const dragging = useFileDrop(composer.addFiles, active && panelActive);
  return (
    <>
      <DropOverlay visible={dragging} />
      <PromptBox
        ref={box}
        controls={<AttachMenu onFiles={composer.addFiles} />}
        footer={models.store && <ComposerFooter models={models} onOpenPicker={onOpenPicker} />}
        attachments={<AttachmentStrip images={composer.images} onRemove={composer.removeImage} />}
        takeover={question}
        placeholder={composer.placeholder}
        working={composer.working}
        held={composer.held}
        stopping={composer.stopping}
        disabled={composer.disabled}
        onChange={composer.onChange}
        onSubmit={composer.submit}
        onStop={composer.stop}
        onPasteFiles={composer.addFiles}
      />
    </>
  );
}

/** The conversation and the composer. */
function ChatPane({ connection, session, models, hub, onUnauthorized, active, onHistory, onNewChat }: ChatPaneProps) {
  const { chat, state, activeID } = session;
  const box = useRef<PromptBoxHandle>(null);
  const composer = useComposer({
    chat,
    state,
    box,
    models: { store: models.store, controls: models.controls, phase: models.state.phase },
  });
  const store = models.store;
  const picker = usePicker(models, box);
  const title = useChatTitle(activeID, state.title);
  const transcript = (
    <>
      <TranscriptList chat={chat} state={state} models={models} />
      <div className="mx-auto w-full max-w-chat">
        <PaneNotice session={session} models={models} />
        <ChatComposer box={box} composer={composer} models={models} active={active} question={paneQuestion(session)} onOpenPicker={picker.open} />
      </div>
      {store && (
        <ModelPicker open={picker.picking} onOpenChange={picker.onOpenChange} store={store} state={models.state}
          onManage={() => { picker.onOpenChange(false); openSettings(); }} />
      )}
    </>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <ChatHeader title={title} activeID={activeID} onHistory={onHistory} onNewChat={onNewChat} />
      <ConnectionBanners connection={connection} />
      <SessionBranch activeID={activeID} hub={hub} connection={connection} models={models} onUnauthorized={onUnauthorized}>
        {transcript}
      </SessionBranch>
    </div>
  );
}

const noSubscribe = () => () => undefined;

function useTranscript(chat: ChatSession | null, state: typeof INITIAL_CHAT_STATE) {
  const { timeline, local } = state;
  const pending = useMemo(() => pendingMessages({ timeline, local }, chat?.previewFiles), [timeline, local, chat]);
  const loadEarlier = useCallback(() => void chat?.loadEarlier(), [chat]);
  return { timeline, pending, loadEarlier };
}

function TranscriptList({ chat, state, models }: { chat: ChatSession | null; state: ChatState; models: Models }) {
  const { timeline, pending, loadEarlier } = useTranscript(chat, state);
  return (
    <ShellOutputProvider value={chat?.shellOutput ?? null}>
      <ModelCatalogProvider catalog={models.state.catalog ?? models.state.cached}>
        <MessageList turns={timeline?.turns ?? NO_TURNS} switches={timeline?.switches} pending={pending}
          previewFiles={chat?.previewFiles} hasEarlier={state.hasEarlier} loadingEarlier={state.loadingEarlier} onLoadEarlier={loadEarlier} />
      </ModelCatalogProvider>
    </ShellOutputProvider>
  );
}

function SessionBranch({ activeID, hub, connection, models, onUnauthorized, children }: {
  activeID: string | null; hub: EventHub | null; connection: Connection; models: Models; onUnauthorized: () => void;
  children: ReactNode;
}) {
  if (!activeID || !hub) return children;
  return (
    <SubagentTabs rootID={activeID}
      renderChild={(id) => <SubagentTranscript key={id} sessionID={id} connection={connection} hub={hub} models={models} onUnauthorized={onUnauthorized} />}>
      <div className="flex h-full min-h-0 flex-col">{children}</div>
    </SubagentTabs>
  );
}

function SubagentTranscript({ sessionID, connection, hub, models, onUnauthorized }: {
  sessionID: string; connection: Connection; hub: EventHub; models: Models; onUnauthorized: () => void;
}) {
  const [chat, setChat] = useState<ChatSession | null>(null);
  useEffect(() => {
    const child = new ChatSession({ connection, events: hub, sessionID, onUnauthorized });
    setChat(child);
    void child.load();
    return () => child.dispose();
  }, [connection, hub, sessionID, onUnauthorized]);
  const state = useSyncExternalStore(chat?.subscribe ?? noSubscribe, chat?.getState ?? (() => INITIAL_CHAT_STATE));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TranscriptList chat={chat} state={state} models={models} />
      {state.error && <Notice text={state.error} />}
    </div>
  );
}

type View = 'chat' | 'history';

/** How long the History panel's slide-out runs (see Tabs), so it stays rendered until gone. */
const SLIDE_OUT_MS = 300;

export function ChatScreen({ connection, tabId, onUnauthorized }: Props) {
  const [view, setView] = useState<View>('chat');
  const hub = useEventHub(connection, onUnauthorized);
  const models = useModelStore(connection, hub, onUnauthorized);
  const modelStore = models.store;
  const promote = useCallback(
    (sessionID: string, selection?: Selection) => {
      if (selection) modelStore?.promote(sessionID, selection);
    },
    [modelStore],
  );
  const session = useChatSession(connection, hub, onUnauthorized, promote, tabId);
  useModelSync(modelStore, session.activeID, session.state.durable);
  const history = useHistory(connection, hub, view === 'history', onUnauthorized);
  const { activeID, open, newChat } = session;
  // `open` and the open chat change together; History's callbacks read them through refs, so
  // they stay the same and its memoized rows skip re-rendering.
  const active = useLatest(activeID);
  const latestOpen = useLatest(open);

  // Stable callbacks: the chat re-renders this screen on every streamed update, and History
  // (memoized) should not re-render with it.
  const startNewChat = useCallback(() => {
    newChat();
    setView('chat');
  }, [newChat]);
  const showChat = useCallback(() => setView('chat'), []);
  const openChat = useCallback(
    (sessionID: string) => {
      latestOpen.current(sessionID);
      setView('chat');
    },
    [latestOpen],
  );
  const leaveDeleted = useCallback(
    (sessionID: string) => {
      // Leave the chat first, so its deletion is not reported as a surprise.
      if (sessionID === active.current) newChat();
    },
    [active, newChat],
  );

  // History is a child of the chat: it slides in from the right and back out to it. It is built
  // fresh on each open (its list's entrance wave plays every time) and kept only while it slides
  // out. The chat stays mounted underneath, so its draft and scroll position survive.
  const showHistory = useLingering(view === 'history', SLIDE_OUT_MS);

  return (
    <Tabs
      defaultValue="chat"
      value={view}
      onValueChange={(next) => setView(next as View)}
      className="h-screen gap-0 overflow-hidden bg-background text-foreground"
    >
      <TabsContentWrapper fillHeight className="min-h-0 flex-1">
        <TabsContent value="chat">
          <ChatPane
            connection={connection}
            session={session}
            models={models}
            hub={hub}
            onUnauthorized={onUnauthorized}
            active={view === 'chat'}
            onHistory={() => setView('history')}
            onNewChat={startNewChat}
          />
        </TabsContent>
        <TabsContent value="history">
          {showHistory && (
            <HistoryView
              store={history.store}
              state={history.state}
              activeID={activeID}
              onBack={showChat}
              onNewChat={startNewChat}
              onOpen={openChat}
              onDelete={leaveDeleted}
            />
          )}
        </TabsContent>
      </TabsContentWrapper>
    </Tabs>
  );
}
