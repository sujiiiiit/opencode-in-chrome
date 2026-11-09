import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { browser } from 'wxt/browser';
import type { PermissionRequest } from '@opencode/client';
import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipGroup, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsContentWrapper, useTabPanelActive } from '@/components/ui/tabs';
import { foregroundAgent } from '@/lib/opencode/background';
import { ChatSession, INITIAL_CHAT_STATE, pendingMessages, type ChatState } from '@/lib/opencode/chat';
import type { Turn } from '@/lib/opencode/timeline';
import { PINNED_SERVER_VERSION } from '@/lib/opencode/client';
import type { Connection } from '@/lib/opencode/connection';
import type { EventHub } from '@/lib/opencode/events';
import type { Selection } from '@/lib/opencode/models/selection';
import { displayTitle, isUntitled } from '@/lib/opencode/sessions';
import { BackgroundProvider } from './flow/background';
import { ShellOutputProvider, useLingering, useNow } from './flow/live';
import { formatDuration } from '@/lib/opencode/flow';
import { MorphText } from './flow/morph-text';
import { MarqueeTitle } from './marquee-title';
import { HistoryView } from './history/history-view';
import { MessageList } from './message-list';
import { ModelControls } from './model/model-controls';
import { ModelPicker } from './model/model-picker';
import { ModelCatalogProvider } from './model/model-names';
import { useModelShortcuts, useModelStore, useModelSync } from './model/use-models';
import { ApprovalChoices, FormCard } from './form-card';
import { Notice } from './notice';
import { DropOverlay } from './drop-overlay';
import { useFileDrop } from './use-file-drop';
import { AttachMenu } from './prompt-box/attach-menu';
import { PermissionMenu } from './prompt-box/permission-menu';
import { AttachmentStrip } from './prompt-box/attachment-strip';
import { PromptBox, type PromptBoxHandle } from './prompt-box/prompt-box';
import { useChatSession, useComposer, useEventHub, useHistory, useLatest } from './use-chat';
import { useMentions } from './use-mentions';
import { useGoal } from './use-goal';
import type { Goal } from '@/lib/opencode/goal';
import { ComposerTray } from './prompt-box/composer-tray';
import { GoalRow, showsGoal } from './prompt-box/goal-tray';
import { TodoRow, showsTodos } from './prompt-box/todo-tray';
import { sessionTodos, type Todo } from '@/lib/opencode/todos';
import type { MentionItem } from '@/lib/opencode/mentions';
import { SubagentTabs, useSubagentPath, type SubagentPath } from './subagent-tabs';

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

function HistoryButton({ activity, onClick }: { activity: 'running' | 'unseen' | null; onClick: () => void }) {
  const description = activity === 'running' ? 'Chats running' : activity === 'unseen' ? 'Unseen chat results' : undefined;
  return (
    <TooltipTrigger label="History"><Button variant="ghost" size="icon-lg" className="relative" aria-label="History" aria-description={description} onClick={onClick}>
      {activity === 'running' ? <Icon name="loader-circle" strokeWidth={1.5} className="size-4 origin-center animate-spin [transform-box:view-box]" /> : <Icon name="history" />}
      {activity === 'unseen' && <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" aria-hidden="true" />}
    </Button></TooltipTrigger>
  );
}

function ChatHeader({
  title,
  activeID,
  onHistory,
  onNewChat,
  historyActivity,
}: {
  title: string;
  /** The open chat's id, so the title id is stable per chat and changes when a chat is named. */
  activeID: string | null;
  onHistory: () => void;
  onNewChat: () => void;
  historyActivity: 'running' | 'unseen' | null;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    setCopied(false);
    clearTimeout(copyTimer.current);
    return () => clearTimeout(copyTimer.current);
  }, [activeID]);

  const copySessionID = () => {
    if (!activeID) return;
    void navigator.clipboard?.writeText(activeID).then(() => {
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    }, () => {});
  };
  // Morph from the "New chat" placeholder to the real title once the chat is named, and again
  // when switching chats (the id changes). Under one id the text just eases its width instead.
  const id = activeID && title !== 'New chat' ? `title:${activeID}` : 'untitled';

  return (
    <header className="mx-auto flex w-full max-w-chat shrink-0 items-center gap-2 pl-4 pr-2 py-1.5">
      <MarqueeTitle title={title} showTitle={!activeID} className="flex-1 text-sm text-text-primary">
        {activeID ? (
          <Tooltip label={copied ? 'Session ID copied' : 'Copy session ID'} side="bottom" closeOnClick={false}><button type="button" className="block w-full cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]" aria-label={copied ? 'Session ID copied' : 'Copy session ID'} onClick={copySessionID}>
            <MorphText id={id} text={title} textSlot="chat-title" />
          </button></Tooltip>
        ) : <MorphText id={id} text={title} textSlot="chat-title" />}
      </MarqueeTitle>
      {copied && <span role="status" className="sr-only">Session ID copied</span>}
      <div className="flex items-center gap-0.5">
        <TooltipTrigger label="Settings"><Button variant="ghost" size="icon-lg" aria-label="Settings" onClick={openSettings}>
          <Icon name="settings" />
        </Button></TooltipTrigger>
        <HistoryButton activity={historyActivity} onClick={onHistory} />
        <TooltipTrigger label="New chat"><Button variant="ghost" size="icon-lg" aria-label="New chat" onClick={onNewChat}>
          <Icon name="new-chat" />
        </Button></TooltipTrigger>
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
  historyActivity: 'running' | 'unseen' | null;
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
function ComposerFooter({ models }: { models: Models }) {
  const store = models.store;
  return (
    <ModelControls
      controls={models.controls}
      pending={!store || models.state.phase === 'idle' || models.state.phase === 'loading'}
    />
  );
}

/**
 * The question the running turn is asking (the oldest, when several wait), asked inside the
 * prompt box. Keyed by form, so the next one starts from its own first page and defaults.
 */
function PermissionCard({ permission, chat, rootID }: { permission: PermissionRequest; chat: ChatSession | null; rootID?: string }) {
  return (
    <section aria-label="OpenCode permission" className="flex flex-col gap-2 px-1 pt-3.5 pb-3">
      <h2 className="px-3 type-body font-semibold text-text-primary">Allow {permission.action}?</h2>
      {permission.sessionID !== rootID && <p className="px-3 text-xs text-text-secondary">Subagent request</p>}
      {permission.message && <p className="px-3 type-body text-text-secondary">{permission.message}</p>}
      {permission.resources.map((resource) => <p key={resource} className="break-all px-3 text-sm text-text-secondary">{resource}</p>)}
      {!!permission.save?.length && <p className="break-all px-3 text-xs text-text-tertiary">Allow always saves for: {permission.save.join(', ')}</p>}
      <ApprovalChoices options={[
        { value: 'once', label: 'Allow once' },
        ...(permission.save?.length ? [{ value: 'always', label: 'Allow always' }] : []),
        { value: 'reject', label: 'Deny' },
      ]} onChoose={(value) => chat?.answerPermission(permission, value as 'once' | 'always' | 'reject')} />
    </section>
  );
}

/** Only the requests one child chat is waiting on (its approvals and questions, browser ones too). */
function requestsFor(state: ChatState, sessionID: string): ChatState {
  return {
    ...state,
    permissions: state.permissions.filter((p) => p.sessionID === sessionID),
    forms: state.forms.filter((f) => f.sessionID === sessionID),
  };
}

function paneQuestion({ chat, state }: Pick<ReturnType<typeof useChatSession>, 'chat' | 'state'>): ReactNode {
  const permission = state.permissions?.[0];
  if (permission) return <PermissionCard permission={permission} chat={chat} rootID={state.timeline?.sessionID} />;
  const form = state.forms[0];
  if (!form) return null;
  return (
    <div>
    {form.sessionID !== state.timeline?.sessionID && <p className="px-4 pt-3 text-xs text-text-secondary">Subagent request</p>}
    <FormCard
      key={form.id}
      form={form}
      onAnswer={(id, answer) => chat?.answerForm(id, answer)}
      onCancel={(id) => chat?.cancelForm(id)}
    />
    </div>
  );
}

/** The model picker's open state and its shortcuts (⌘' opens it, ⇧⌘D cycles the effort). */
function usePicker(models: Models) {
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
  const onOpenChange = useCallback((next: boolean) => setPicking(next), []);
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
  /** A subagent's chat is open: the box shows its requests or status, and the chips fold away. */
  subagent: boolean;
  mentions: ReturnType<typeof useMentions>;
  /** The session's `/goal`, shown as a tab behind the box while it has one. */
  goal: ReturnType<typeof useGoal>;
  /** The agent's todo list, shown as a row under the goal. */
  todos: Todo[];
};

/**
 * The prompt box with its attach menu, attached images and model chips, and the drop zone that
 * covers the whole pane (the overlay is placed against the pane, its nearest positioned box).
 */
function ChatComposer({ box, composer, models, active, question, subagent, mentions, goal, todos }: ChatComposerProps) {
  // History, sliding over the chat, takes no drops; nor does a subagent's chat (no editor shows).
  const panelActive = useTabPanelActive();
  const dragging = useFileDrop(composer.addFiles, active && panelActive && !subagent);
  const source = mentions.source;
  const loadMentions = useCallback(() => source?.load(), [source]);
  const addSkill = useCallback((skill: MentionItem) => box.current?.insertMention(skill), [box]);
  return (
    <>
      <DropOverlay visible={dragging} />
      <PromptBox
        ref={box}
        mentions={source}
        tray={
          // Rows to come go here, each with its own `shown`; the tray is open while any row is.
          <ComposerTray open={(showsGoal(goal.goal) || showsTodos(todos)) && !subagent}>
            <GoalRow goal={goal.goal} notice={goal.notice} onAction={goal.run} />
            <TodoRow todos={todos} />
          </ComposerTray>
        }
        controls={
          <>
            <AttachMenu
              onFiles={composer.addFiles}
              onOpen={loadMentions}
              skills={mentions.catalog.skills}
              loading={!!source?.loading}
              onSkill={addSkill}
            />
            <PermissionMenu />
          </>
        }
        footer={<ComposerFooter models={models} />}
        footerHidden={subagent}
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

/**
 * The open subagent (if any) and what the prompt box shows for it. The box stays put while the
 * header and transcript above it slide between chats: on a subagent's chat it shows that chat's
 * approvals and questions (browser ones too), else its status.
 */
function useSubagentView(session: ReturnType<typeof useChatSession>, connection: Connection, hub: EventHub | null, onUnauthorized: () => void) {
  const { chat, state, activeID } = session;
  const nav = useSubagentPath(activeID && hub ? activeID : null);
  const child = useChildSession(nav.child, connection, hub, onUnauthorized);
  // Only a subagent the main chat itself is waiting on can be moved: the server moves the
  // parent's foreground work, and a nested subagent's parent is not loaded here.
  const movable = !!nav.child && nav.path.length === 1 && foregroundAgent(state.timeline?.turns.at(-1)?.reply, nav.child);
  const question = nav.child
    ? paneQuestion({ chat, state: requestsFor(state, nav.child) }) ??
      <SubagentStatus state={child.state} chat={child.chat} onBackground={movable ? () => moveAside(chat) : undefined} />
    : paneQuestion(session);
  return { nav, child, question };
}

/** Moves the chat's foreground subagents and shell commands to the background. */
const moveAside = (chat: ChatSession | null) => chat?.moveToBackground() ?? Promise.resolve();

/** The conversation and the composer. */
function ChatPane({ connection, session, models, hub, onUnauthorized, active, onHistory, onNewChat, historyActivity }: ChatPaneProps) {
  const { chat, state, activeID } = session;
  const box = useRef<PromptBoxHandle>(null);
  const mentions = useMentions(connection, hub, onUnauthorized);
  const goal = useGoal(connection, hub, activeID, onUnauthorized);
  const turns = state.timeline?.turns;
  const todos = useMemo(() => (turns ? sessionTodos(turns) : []), [turns]);
  const composer = useComposer({
    chat,
    state,
    box,
    models: { store: models.store, controls: models.controls, phase: models.state.phase },
    commands: mentions.catalog.commands,
  });
  const store = models.store;
  const picker = usePicker(models);
  const title = useChatTitle(activeID, state.title);
  const { nav, child, question } = useSubagentView(session, connection, hub, onUnauthorized);

  return (
    <DropdownMenu open={picker.picking} onOpenChange={picker.onOpenChange}>
    <div className="relative flex h-full min-h-0 flex-col">
      <SessionBranch activeID={activeID} hub={hub} nav={nav} child={child} models={models} state={state}>
        <ChatHeader title={title} activeID={activeID} onHistory={onHistory} onNewChat={onNewChat} historyActivity={historyActivity} />
        <ConnectionBanners connection={connection} />
        <TranscriptList chat={chat} state={state} models={models} goal={goal.goal} />
        <div className="mx-auto w-full max-w-chat"><PaneNotice session={session} models={models} /></div>
      </SessionBranch>
      <div className="mx-auto w-full max-w-chat shrink-0">
        <ChatComposer box={box} composer={composer} models={models} active={active} question={question} subagent={!!nav.child} mentions={mentions} goal={goal} todos={todos} />
      </div>
      {store && (
        <ModelPicker store={store} state={models.state} onClose={() => picker.onOpenChange(false)} />
      )}
    </div>
    </DropdownMenu>
  );
}

const noSubscribe = () => () => undefined;

function useTranscript(chat: ChatSession | null, state: typeof INITIAL_CHAT_STATE) {
  const { timeline, local } = state;
  const pending = useMemo(() => pendingMessages({ timeline, local }, chat?.previewFiles), [timeline, local, chat]);
  const loadEarlier = useCallback(() => void chat?.loadEarlier(), [chat]);
  const finished = timeline?.finished;
  const background = useMemo(() => ({ finished }), [finished]);
  return { timeline, pending, loadEarlier, background };
}

function TranscriptList({ chat, state, models, goal }: { chat: ChatSession | null; state: ChatState; models: Models; goal?: Goal | null }) {
  const { timeline, pending, loadEarlier, background } = useTranscript(chat, state);
  return (
    <ShellOutputProvider value={chat?.shellOutput ?? null}>
      <BackgroundProvider value={background}>
        <ModelCatalogProvider catalog={models.state.catalog ?? models.state.cached}>
          <MessageList turns={timeline?.turns ?? NO_TURNS} switches={timeline?.switches} pending={pending} goal={goal}
            previewFiles={chat?.previewFiles} hasEarlier={state.hasEarlier} loadingEarlier={state.loadingEarlier} onLoadEarlier={loadEarlier} />
        </ModelCatalogProvider>
      </BackgroundProvider>
    </ShellOutputProvider>
  );
}

type ChildSession = { chat: ChatSession | null; state: ChatState };

/** The open subagent's own chat session (its transcript and status), or none on the root chat. */
function useChildSession(sessionID: string | null, connection: Connection, hub: EventHub | null, onUnauthorized: () => void): ChildSession {
  const [chat, setChat] = useState<ChatSession | null>(null);
  useEffect(() => {
    if (!sessionID || !hub) return;
    const child = new ChatSession({ connection, events: hub, sessionID, onUnauthorized });
    setChat(child);
    void child.load();
    return () => {
      child.dispose();
      setChat(null);
    };
  }, [connection, hub, sessionID, onUnauthorized]);
  const state = useSyncExternalStore(chat?.subscribe ?? noSubscribe, chat?.getState ?? (() => INITIAL_CHAT_STATE));
  return { chat, state };
}

function SessionBranch({ activeID, hub, nav, child, models, state, children }: {
  activeID: string | null; hub: EventHub | null; nav: SubagentPath; child: ChildSession; models: Models;
  state: ChatState;
  children: ReactNode;
}) {
  if (!activeID || !hub) return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
  return (
    <SubagentTabs rootID={activeID} nav={nav} pendingSessionIDs={[...state.permissions.map((p) => p.sessionID), ...state.forms.map((f) => f.sessionID)]}
      renderChild={() => <SubagentTranscript child={child} models={models} />}>
      <div className="flex h-full min-h-0 flex-col">{children}</div>
    </SubagentTabs>
  );
}

function SubagentTranscript({ child: { chat, state }, models }: { child: ChildSession; models: Models }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TranscriptList chat={chat} state={state} models={models} />
      <div className="mx-auto w-full max-w-chat">
        {state.error && <Notice text={state.error} />}
        {state.notice && <Notice text={state.notice} onDismiss={() => chat?.dismissNotice()} />}
      </div>
    </div>
  );
}

function subagentOutcome(state: ChatState): string {
  return state.sessionInfo?.outcome ?? state.timeline?.turns.at(-1)?.reply.status ?? 'idle';
}

const SUBAGENT_LABELS: Record<string, string> = { running: 'Running', interrupted: 'Interrupted', failed: 'Failed', succeeded: 'Completed' };

/** How long the run has gone on (live) or took, once its start is known. */
function subagentElapsed(timeline: NonNullable<ChatState['timeline']>, info: ChatState['sessionInfo'], now: number): string | undefined {
  const started = info?.started ?? timeline.turns[0]?.created;
  const ended = timeline.working ? now : timeline.idleAt ?? info?.ended;
  return started === undefined || ended == null ? undefined : formatDuration(ended - started);
}

/** The run's state word and its elapsed time; null until the session says how it stands. */
function subagentStatusParts(state: ChatState, now: number): { key: string; label: string; elapsed?: string } | null {
  if (!state.timeline) return null;
  const key = state.timeline.working ? 'running' : subagentOutcome(state);
  const label = SUBAGENT_LABELS[key];
  return label ? { key, label, elapsed: subagentElapsed(state.timeline, state.sessionInfo, now) } : null;
}

/** The status line's shape ("Running · 2m 4s · Explore") while the subagent's session loads. */
function SubagentStatusSkeleton() {
  return (
    <span role="status" aria-label="Loading subagent status" className="flex min-w-0 flex-1 items-center gap-1.5">
      <Skeleton className="h-3 w-16 rounded-md" />
      <Skeleton className="h-3 w-10 rounded-md" />
      <Skeleton className="h-3 w-14 rounded-md" />
    </span>
  );
}

/** A dot between two status parts; the row's gap spaces it evenly on both sides. */
const Dot = () => <span aria-hidden="true" className="shrink-0 text-text-tertiary">·</span>;

/**
 * Moves the subagent the main chat is waiting on to the background, so the main agent carries on
 * while it runs. Disabled once pressed, until the call returns and the button goes.
 */
function MoveToBackground({ onMove }: { onMove: () => Promise<void> }) {
  const [moving, setMoving] = useState(false);
  const onClick = () => {
    setMoving(true);
    void onMove().finally(() => setMoving(false));
  };
  return (
    <Button type="button" variant="ghost" size="sm" disabled={moving} onClick={onClick} className="shrink-0 animate-reveal gap-1.5 text-text-secondary">
      <Icon name="background" />
      Move to background
    </Button>
  );
}

function SubagentStatus({ state, chat, onBackground }: {
  state: ChatState;
  chat: ChatSession | null;
  /** Set while the main chat waits on this subagent in the foreground. */
  onBackground?: () => Promise<void>;
}) {
  const working = state.timeline?.working === true;
  const now = useNow(working);
  const parts = subagentStatusParts(state, now);
  const agent = state.durable?.agent;
  return (
    <section aria-label="Subagent status" className="flex min-h-13 w-full items-center gap-3 py-2 pr-2 pl-4 type-work text-text-secondary">
      {parts ? (
        <span className="flex min-w-0 flex-1 animate-reveal items-center gap-1.5 overflow-hidden whitespace-nowrap tabular-nums">
          <MorphText id={parts.key} text={parts.label} steady className="shrink-0" />
          {parts.elapsed && <><Dot /><span className="shrink-0">{parts.elapsed}</span></>}
          {agent && <><Dot /><span className="min-w-0 truncate capitalize">{agent}</span></>}
        </span>
      ) : <SubagentStatusSkeleton />}
      {working && onBackground && <MoveToBackground onMove={onBackground} />}
      {working && <Button type="button" size="icon" aria-label="Stop subagent" title="Stop subagent"
        disabled={state.interrupting} onClick={() => void chat?.stop(false)}>
        <Icon name="stop" className="[&_path]:fill-current" />
      </Button>}
    </section>
  );
}

type View = 'chat' | 'history';

/** How long the History panel's slide-out runs (see Tabs), so it stays rendered until gone. */
const SLIDE_OUT_MS = 300;

function useHistoryActivity(history: ReturnType<typeof useHistory>, view: View, activeID: string | null, working: boolean) {
  useEffect(() => {
    const update = () => history.store?.setViewed(view === 'chat' && document.visibilityState !== 'hidden' ? activeID : null);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [history.store, view, activeID]);
  const other = history.state.knownIDs.filter((id) => id !== activeID).map((id) => history.state.activity[id]);
  return working || other.includes('running') || (!!activeID && history.state.activity[activeID] === 'running') ? 'running' : other.includes('unseen') ? 'unseen' : null;
}

function useLeaveDeleted(activeID: string | null, newChat: () => void) {
  const active = useLatest(activeID);
  return useCallback((sessionID: string) => {
    if (sessionID === active.current) newChat();
  }, [active, newChat]);
}

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
  const history = useHistory(connection, hub, onUnauthorized);
  const { activeID, open, newChat } = session;
  const historyActivity = useHistoryActivity(history, view, activeID, session.state.timeline?.working === true);
  // `open` and the open chat change together; History's callbacks read them through refs, so
  // they stay the same and its memoized rows skip re-rendering.
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
  const leaveDeleted = useLeaveDeleted(activeID, newChat);

  // History is a child of the chat: it slides in from the right and back out to it. It is built
  // fresh on each open (its list's entrance wave plays every time) and kept only while it slides
  // out. The chat stays mounted underneath, so its draft and scroll position survive.
  const showHistory = useLingering(view === 'history', SLIDE_OUT_MS);

  return (
    <TooltipGroup><Tabs
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
            historyActivity={historyActivity}
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
    </Tabs></TooltipGroup>
  );
}
