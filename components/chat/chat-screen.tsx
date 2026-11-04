import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsContent, TabsContentWrapper } from '@/components/ui/tabs';
import { pendingMessages } from '@/lib/opencode/chat';
import type { Turn } from '@/lib/opencode/timeline';
import { PINNED_SERVER_VERSION } from '@/lib/opencode/client';
import type { Connection } from '@/lib/opencode/connection';
import type { Selection } from '@/lib/opencode/models/selection';
import { displayTitle, isUntitled } from '@/lib/opencode/sessions';
import { ShellOutputProvider, useLingering } from './flow/live';
import { MorphText } from './flow/morph-text';
import { HistoryView } from './history/history-view';
import { MessageList } from './message-list';
import { ModelControls } from './model/model-controls';
import { ModelPicker } from './model/model-picker';
import { ModelCatalogProvider } from './model/model-names';
import { useModelShortcuts, useModelStore, useModelSync } from './model/use-models';
import { FormCard } from './form-card';
import { Notice } from './notice';
import { WebSearchMenu } from './web-search-menu';
import { PromptBox, type PromptBoxHandle } from './prompt-box/prompt-box';
import { useChatSession, useComposer, useEventHub, useHistory, useLatest } from './use-chat';

type Props = {
  connection: Connection;
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
  connection,
  onError,
  onHistory,
  onNewChat,
}: {
  title: string;
  /** The open chat's id, so the title id is stable per chat and changes when a chat is named. */
  activeID: string | null;
  connection: Connection;
  onError: (message: string) => void;
  onHistory: () => void;
  onNewChat: () => void;
}) {
  // Morph from the "New chat" placeholder to the real title once the chat is named, and again
  // when switching chats (the id changes). Under one id the text just eases its width instead.
  const id = activeID && title !== 'New chat' ? `title:${activeID}` : 'untitled';

  return (
    <header className="mx-auto flex w-full max-w-chat shrink-0 items-center gap-2 px-4 py-1.5">
      <h1 className="min-w-0 flex-1 truncate text-sm text-text-primary" title={title}>
        <MorphText id={id} text={title} textSlot="chat-title" />
      </h1>
      <div className="flex items-center gap-0.5">
        <WebSearchMenu connection={connection} onError={onError} />
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

/** The conversation and the composer. */
function ChatPane({ connection, session, models, onHistory, onNewChat }: ChatPaneProps) {
  const { chat, state, activeID } = session;
  const box = useRef<PromptBoxHandle>(null);
  const composer = useComposer({
    chat,
    state,
    box,
    models: { store: models.store, controls: models.controls, phase: models.state.phase },
  });
  const [picking, setPicking] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const store = models.store;
  const openPicker = useCallback(() => {
    if (store && !models.controls.loading) setPicking(true);
  }, [store, models.controls.loading]);
  useModelShortcuts(!picking, {
    openPicker,
    cycleVariant: () => store?.cycleVariant(),
    // Agent switching is hidden for now (build mode only).
    // moveAgent: (direction) => store?.moveAgent(direction),
  });
  const closePicker = useCallback((open: boolean) => {
    setPicking(open);
    // Back to the message after choosing, like opencode's composer.
    if (!open) requestAnimationFrame(() => box.current?.focus());
  }, []);
  const title = useChatTitle(activeID, state.title);
  // Stable props, so typing in the composer (which re-renders this pane) skips the message list.
  const { timeline, local } = state;
  const pending = useMemo(() => pendingMessages({ timeline, local }), [timeline, local]);
  const loadEarlier = useCallback(() => void chat?.loadEarlier(), [chat]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader title={title} activeID={activeID} connection={connection} onError={setSearchError} onHistory={onHistory} onNewChat={onNewChat} />
      <ConnectionBanners connection={connection} />
      {/* Shell tools in the replies read their live output through the open chat. */}
      <ShellOutputProvider value={chat?.shellOutput ?? null}>
        {/* Answer footers name the model each reply ran on. */}
        <ModelCatalogProvider catalog={models.state.catalog ?? models.state.cached}>
          <MessageList
            turns={timeline?.turns ?? NO_TURNS}
            pending={pending}
            hasEarlier={state.hasEarlier}
            loadingEarlier={state.loadingEarlier}
            onLoadEarlier={loadEarlier}
          />
        </ModelCatalogProvider>
      </ShellOutputProvider>
      <div className="mx-auto w-full max-w-chat">
        {state.forms.map((form) => (
          <FormCard
            key={form.id}
            form={form}
            onAnswer={(id, answer) => chat?.answerForm(id, answer)}
            onCancel={(id) => chat?.cancelForm(id)}
          />
        ))}
        {searchError && <Notice text={`Web search: ${searchError}`} onDismiss={() => setSearchError(null)} />}
        <PaneNotice session={session} models={models} />
        <PromptBox
          ref={box}
          controls={
            store && (
              <ModelControls
                controls={models.controls}
                onOpenPicker={openPicker}
                // onAgent={(name) => store.setAgent(name)}
                onVariant={(value) => store.setVariant(value)}
              />
            )
          }
          placeholder={composer.placeholder}
          working={composer.working}
          held={composer.held}
          stopping={composer.stopping}
          disabled={composer.disabled}
          onChange={composer.onChange}
          onSubmit={composer.submit}
          onStop={composer.stop}
        />
      </div>
      {store && <ModelPicker open={picking} onOpenChange={closePicker} store={store} state={models.state} />}
    </div>
  );
}

type View = 'chat' | 'history';

/** How long the History panel's slide-out runs (see Tabs), so it stays rendered until gone. */
const SLIDE_OUT_MS = 300;

export function ChatScreen({ connection, onUnauthorized }: Props) {
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
  const session = useChatSession(connection, hub, onUnauthorized, promote);
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
