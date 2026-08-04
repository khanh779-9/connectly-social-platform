import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CornerUpLeft,
  EyeOff,
  Info,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store/hooks';
import { fetchPresence, presenceLabel } from '@/lib/presence';
import { avatarTone } from '@/lib/avatar';
import {
  createHubConnection,
  HubConnection,
} from '@/lib/hubs';
import { readAccessToken } from '@/store/session';
import {
  addChatMessageReaction,
  deleteChatMessage,
  editChatMessage,
  ensureProfiles,
  fetchConversations,
  fetchMessages,
  getErrorMessage,
  hideChatMessage,
  initials,
  markConversationRead,
  removeChatMessageReaction,
  sendChatMessage,
  timeAgo,
  uploadChatAttachment,
} from '@/lib/social';
import type { ChatMessageDto, ConversationDto, PresenceDto, ProfileDto } from '@/types/api';
import ConversationInfoPanel from './ConversationInfoPanel';
import ChatAttachments from './ChatAttachments';
import ChatAttachmentTray, {
  AttachmentButton,
  usePendingAttachments,
} from './ChatAttachmentTray';
import { formatChatMessageTime } from './messageTime';
import {
  LOAD_OLDER_THRESHOLD_PX,
  mergeChatMessages,
  useChatTimeline,
} from './useChatTimeline';

/** Quick reactions shown on the hover bar (emoji are content, not buttons). */
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];
const EDIT_WINDOW_MS = 15 * 60 * 1000;

type ConversationFilter = 'all' | 'people' | 'groups';

const CONVERSATION_FILTERS: ReadonlyArray<{
  value: ConversationFilter;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'people', label: 'People' },
  { value: 'groups', label: 'Groups' },
];

function ConversationFilterTabs({
  value,
  onChange,
}: {
  value: ConversationFilter;
  onChange: (value: ConversationFilter) => void;
}) {
  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % CONVERSATION_FILTERS.length;
    if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + CONVERSATION_FILTERS.length) % CONVERSATION_FILTERS.length;
    }
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = CONVERSATION_FILTERS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = CONVERSATION_FILTERS[nextIndex];
    onChange(next.value);
    const tablist = event.currentTarget.closest('[role="tablist"]');
    const tabs = tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Conversation type"
      className="grid grid-cols-3 gap-1 border-b border-border bg-card px-3 py-2"
    >
      {CONVERSATION_FILTERS.map((tab, index) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            id={`conversation-filter-${tab.value}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls="conversation-list"
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'min-h-9 rounded-md px-2 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-accent/12 text-accent'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The per-message actions trigger. Always visible (touch users cannot hover),
 * with a 36px hit area and an explicit expanded state for assistive tech.
 */
function MessageMenuButton({
  messageId,
  open,
  onToggle,
}: {
  messageId: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-msg-menu
      onClick={onToggle}
      aria-label="Message actions"
      aria-haspopup="true"
      aria-expanded={open}
      aria-controls={`msg-menu-${messageId}`}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  );
}

export default function MessagesPage() {
  const myId = useAppSelector((state) => state.auth.userId);
  const location = useLocation();
  const requestedConversationId = (location.state as { conversationId?: string } | null)
    ?.conversationId;

  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileDto | null>>({});
  const [presence, setPresence] = useState<Record<string, PresenceDto>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'backend-unavailable'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>('all');
  const [infoOpen, setInfoOpen] = useState(false);

  // active conversation state
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [messagesStatus, setMessagesStatus] = useState<'loading' | 'ready'>('loading');
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessageDto | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const attachments = usePendingAttachments();
  const connectionRef = useRef<HubConnection | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const myIdRef = useRef(myId);
  const knownConversationIdsRef = useRef<Set<string>>(new Set());
  const [hubConnected, setHubConnected] = useState(false);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const typingTimerRef = useRef<number | undefined>(undefined);
  const lastTypingSentRef = useRef(0);
  const {
    scrollRef: messageScrollRef,
    handleScroll: handleMessageScroll,
    scrollToBottom: scrollMessagesToBottom,
  } = useChatTimeline(messages, selectedId ?? 'empty');

  // The SignalR handlers are registered once, so they read the current values
  // of these two through refs.
  useEffect(() => {
    selectedIdRef.current = selectedId;
    myIdRef.current = myId;
  }, [selectedId, myId]);

  // Dismiss the per-message action panel on Escape or an outside click.
  useEffect(() => {
    if (!menuId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuId(null);
    }
    function onPointerDown(event: MouseEvent) {
      if ((event.target as HTMLElement).closest('[data-msg-menu]')) return;
      setMenuId(null);
    }
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [menuId]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  /** The other participant of a DM (or the first member for groups). */
  function otherMember(conv: ConversationDto): { userId: string; online: boolean } | null {
    const other = conv.members.find((m) => m.userId !== myId);
    if (!other) {
      return conv.members[0]
        ? { userId: conv.members[0].userId, online: conv.members[0].online }
        : null;
    }
    return { userId: other.userId, online: other.online };
  }

  async function load() {
    setStatus('loading');
    setError(null);
    try {
      const list = await fetchConversations();
      setConversations(list);
      knownConversationIdsRef.current = new Set(list.map((c) => c.id));
      const memberIds = list.flatMap((c) => c.members.map((m) => m.userId));
      const resolved = await ensureProfiles(memberIds);
      setProfiles((prev) => ({ ...prev, ...resolved }));
      setStatus('ready');
    } catch (err) {
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      if (statusCode === 500 || statusCode === 503) {
        setStatus('backend-unavailable');
        setError('Chat service needs Redis (Docker). Start Docker Desktop for real-time messaging.');
      } else {
        setError(getErrorMessage(err));
        setStatus('error');
      }
    }
  }

  // Load the conversations when the page opens.
  useEffect(() => {
    load();
  }, []);

  // Presence for the open conversation: "Active now" / "Active 3h ago".
  const selectedConversation = conversations.find((c) => c.id === selectedId);
  const selectedMemberIds = selectedConversation
    ? selectedConversation.members.map((m) => m.userId).join(',')
    : '';

  useEffect(() => {
    if (!selectedMemberIds) return;
    let cancelled = false;
    const loadPresence = () => {
      fetchPresence(selectedMemberIds.split(','))
        .then((next) => {
          if (cancelled) return;
          setPresence((prev) => ({ ...prev, ...next }));
        })
        .catch(() => undefined);
    };
    void loadPresence();
    const timer = window.setInterval(loadPresence, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedMemberIds]);

  // SignalR connection: listens for fan-out messages targeting this user group.
  useEffect(() => {
    const token = readAccessToken();
    if (!token) return;

    const baseUrl = import.meta.env.VITE_CHAT_HUB_URL as string;
    // SignalR appends the token itself; adding it here as well duplicates the query
    // parameter and the server rejects the handshake.
    // The factory is called again on every (re)negotiation, so a refreshed token is
    // picked up — a captured token would make the reconnect fail with 401 once the
    // access token has expired.
    const connection = createHubConnection(baseUrl, () => readAccessToken());
    connectionRef.current = connection;

    connection.on('message-received', (message: ChatMessageDto) => {
      const forSelected = message.conversationId === selectedIdRef.current;
      setMessages((prev) => {
        if (!forSelected || prev.some((m) => m.id === message.id)) return prev;
        return mergeChatMessages(prev, [message]);
      });

      const fromOthers = message.senderUserId !== myIdRef.current;
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === message.conversationId);
        if (index === -1) return prev;
        const target = prev[index];
        const bumped: ConversationDto = {
          ...target,
          lastMessageAt: message.sentAt,
          lastMessagePreview: message.body ?? 'Sent a message',
          lastMessageSenderUserId: message.senderUserId,
          unreadCount: forSelected || !fromOthers ? 0 : target.unreadCount + 1,
        };
        // mirror the server ordering: most recently updated first
        const rest = prev.filter((_, i) => i !== index);
        return [bumped, ...rest];
      });
      // Capture this before recording the id — otherwise the check below is always false.
      const isNewConversation = !knownConversationIdsRef.current.has(message.conversationId);
      knownConversationIdsRef.current.add(message.conversationId);

      if (forSelected) {
        markConversationRead(message.conversationId).catch(() => undefined);
      } else if (fromOthers && isNewConversation) {
        // a brand-new conversation appeared — refetch the list to include it
        fetchConversations()
          .then(setConversations)
          .catch(() => undefined);
      }
    });

    // presence from the hub keeps the online dot on avatars fresh
    connection.on('presence-updated', (payload: { userId: string; online: boolean }) => {
      setConversations((prev) =>
        prev.map((conv) => ({
          ...conv,
          members: conv.members.map((member) =>
            member.userId === payload.userId ? { ...member, online: payload.online } : member,
          ),
        })),
      );
    });

    // typing indicator for the conversation that is currently open
    connection.on('typing', (payload: { conversationId: string; userId: string }) => {
      if (payload.conversationId !== selectedIdRef.current) return;
      if (payload.userId === myIdRef.current) return;
      setTypingUserId(payload.userId);
      if (typingTimerRef.current !== undefined) window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = window.setTimeout(() => setTypingUserId(null), 2500);
    });

    // a message was edited (body + editedAt changed)
    connection.on('message-updated', (message: ChatMessageDto) => {
      if (message.conversationId !== selectedIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? // reactions carry a per-viewer flag, so keep the local copy
              { ...message, reactions: m.reactions ?? message.reactions }
            : m,
        ),
      );
    });

    // a message was unsent for everyone
    connection.on(
      'message-deleted',
      (payload: { conversationId: string; messageId: string; deletedAt: string }) => {
        if (payload.conversationId !== selectedIdRef.current) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.messageId
              ? {
                  ...m,
                  status: 'deleted',
                  body: null,
                  attachments: [],
                  reactions: [],
                }
              : m,
          ),
        );
      },
    );

    // someone (else) toggled an emoji reaction
    connection.on(
      'message-reaction',
      (payload: {
        conversationId: string;
        messageId: string;
        reactionType: string;
        userId: string;
        active: boolean;
      }) => {
        if (payload.conversationId !== selectedIdRef.current) return;
        // our own changes already come back from the REST response
        if (payload.userId === myIdRef.current) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== payload.messageId) return m;
            const reactions = [...(m.reactions ?? [])];
            const index = reactions.findIndex((r) => r.reactionType === payload.reactionType);
            if (index === -1) {
              if (payload.active) {
                reactions.push({
                  reactionType: payload.reactionType,
                  count: 1,
                  viewerReacted: false,
                });
              }
            } else if (payload.active) {
              reactions[index] = {
                ...reactions[index],
                count: reactions[index].count + 1,
              };
            } else {
              const next = reactions[index].count - 1;
              if (next <= 0) reactions.splice(index, 1);
              else reactions[index] = { ...reactions[index], count: next };
            }
            return { ...m, reactions };
          }),
        );
      },
    );

    connection.start().then(() => setHubConnected(true)).catch(() => {
      // offline chat still works over REST
    });

    return () => {
      if (typingTimerRef.current !== undefined) window.clearTimeout(typingTimerRef.current);
      connection.stop().catch(() => undefined);
      connectionRef.current = null;
      setHubConnected(false);
      setTypingUserId(null);
    };
  }, []);

  // Join the conversation group for the selected chat.
  useEffect(() => {
    const connection = connectionRef.current;
    if (!connection || !selectedId || !hubConnected) return;

    const convId = selectedId;
    setTypingUserId(null);
    connection.invoke('SubscribeConversation', convId).catch(() => undefined);
    return () => {
      connection.invoke('UnsubscribeConversation', convId).catch(() => undefined);
    };
  }, [selectedId, hubConnected]);

  // Load messages when selecting a conversation.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setMessages([]);
    setMessagesStatus('loading');
    setOlderCursor(null);
    setLoadingOlder(false);
    setReplyTarget(null);
    setEditingId(null);
    setEditDraft('');
    setMenuId(null);
    attachments.clear();
    fetchMessages(selectedId, undefined, 50)
      .then((page) => {
        if (!cancelled) {
          // merge, do not replace: a message that arrived over SignalR (or was sent)
          // while the page was loading must survive the response
          setMessages((prev) => mergeChatMessages(prev, page.items));
          setOlderCursor(page.nextCursor ?? null);
          setMessagesStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setMessagesStatus('ready');
      });
    markConversationRead(selectedId).catch(() => undefined);
    setConversations((prev) =>
      prev.map((conv) => (conv.id === selectedId ? { ...conv, unreadCount: 0 } : conv)),
    );
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // A "Message" action on another profile opens that conversation directly.
  useEffect(() => {
    if (!requestedConversationId || conversations.length === 0) return;
    if (conversations.some((conv) => conv.id === requestedConversationId)) {
      setSelectedId(requestedConversationId);
    }
  }, [requestedConversationId, conversations]);

  async function loadOlderMessages() {
    const conversationId = selectedId;
    const cursor = olderCursor;
    if (!conversationId || !cursor || loadingOlder) return;

    setLoadingOlder(true);
    try {
      const page = await fetchMessages(conversationId, cursor, 50);
      if (selectedIdRef.current !== conversationId) return;
      setMessages((prev) => mergeChatMessages(prev, page.items));
      setOlderCursor(page.nextCursor ?? null);
    } catch {
      // Keep the current cursor so scrolling up can try again.
    } finally {
      if (selectedIdRef.current === conversationId) setLoadingOlder(false);
    }
  }

  async function handleSend() {
    const body = draft.trim();
    const files = attachments.pending.map((item) => item.file);
    if ((!body && files.length === 0) || !selectedId || sending || uploading) return;
    setSending(true);
    try {
      // files travel first: [stora] needs a pre-signed upload per file
      const uploaded = files.length > 0
        ? await Promise.all(files.map((file) => uploadChatAttachment(selectedId, file)))
        : [];

      const message = await sendChatMessage(
        selectedId,
        body,
        replyTarget?.id ?? null,
        uploaded,
      );
      // sending implies typing stops being relevant
      lastTypingSentRef.current = 0;
      setMessages((prev) =>
        prev.some((m) => m.id === message.id)
          ? prev
          : mergeChatMessages(prev, [message]),
      );
      scrollMessagesToBottom(true);
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === selectedId
            ? {
                ...conv,
                lastMessageAt: message.sentAt,
                lastMessagePreview:
                  message.body ?? (message.attachments.length > 0 ? 'Sent an attachment' : 'Sent a message'),
                lastMessageSenderUserId: message.senderUserId,
              }
            : conv,
        ),
      );
      // only clear the draft when the user did not type something else meanwhile
      setDraft((current) => (current.trim() === body ? '' : current));
      setReplyTarget(null);
      attachments.clear();
    } catch (err) {
      setError(getErrorMessage(err));
      // the draft stays so the user can retry
    } finally {
      setSending(false);
      setUploading(false);
    }
  }

  /** Toggle one emoji reaction on a message (one user per emoji). */
  async function toggleReaction(message: ChatMessageDto, emoji: string) {
    if (message.status === 'deleted' || actionBusyId) return;
    const existing = (message.reactions ?? []).find((r) => r.reactionType === emoji);
    setActionBusyId(message.id);
    try {
      const dto = existing?.viewerReacted
        ? await removeChatMessageReaction(message.id, emoji)
        : await addChatMessageReaction(message.id, emoji);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== message.id) return m;
          const reactions = (m.reactions ?? []).filter((r) => r.reactionType !== emoji);
          if (dto.count > 0) reactions.push(dto);
          return { ...m, reactions };
        }),
      );
    } catch {
      // ignore — the reaction stays as-is
    } finally {
      setActionBusyId(null);
    }
  }

  function startEditing(message: ChatMessageDto) {
    setEditingId(message.id);
    setEditDraft(message.body ?? '');
    setMenuId(null);
  }

  async function submitEdit(message: ChatMessageDto) {
    const body = editDraft.trim();
    if (!body || actionBusyId) return;
    setActionBusyId(message.id);
    try {
      const updated = await editChatMessage(message.id, body);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? updated : m)));
      setEditingId(null);
      setEditDraft('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionBusyId(null);
    }
  }

  /** Recall for everybody: both sides keep a "recalled" placeholder. */
  async function recallForEveryone(message: ChatMessageDto) {
    if (actionBusyId) return;
    setActionBusyId(message.id);
    try {
      await deleteChatMessage(message.id);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, status: 'deleted', body: null, attachments: [], reactions: [] }
            : m,
        ),
      );
      setMenuId(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionBusyId(null);
    }
  }

  /** Delete for me only: the message leaves the viewer's timeline, the other
   *  side keeps it exactly as it was. */
  async function deleteForMe(message: ChatMessageDto) {
    if (actionBusyId) return;
    setActionBusyId(message.id);
    try {
      await hideChatMessage(message.id);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      setMenuId(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionBusyId(null);
    }
  }

  function conversationTitle(conv: ConversationDto): { name: string; online: boolean } {
    const other = otherMember(conv);
    let name = 'Conversation';
    if (conv.type === 'group') name = conv.title ?? 'Group chat';
    else if (other) name = profiles[other.userId]?.displayName ?? 'Loading…';

    return { name, online: conv.type === 'dm' ? (other?.online ?? false) : false };
  }

  /** The line under the chat title: presence of the other person. */
  function threadStatusText(conv: ConversationDto): string {
    if (conv.type === 'group') return 'Group conversation';

    const other = otherMember(conv);
    const presenceText = other ? presenceLabel(presence[other.userId]) : null;
    if (presenceText) return presenceText;

    return conversationTitle(conv).online ? 'Online' : 'Offline';
  }

  const term = filter.trim().toLowerCase();
  const filteredConversations = conversations.filter((conv) => {
    const matchesType =
      conversationFilter === 'all' ||
      (conversationFilter === 'people' ? conv.type === 'dm' : conv.type === 'group');
    if (!matchesType) return false;
    if (!term) return true;

    const title = conversationTitle(conv).name.toLowerCase();
    const preview = conv.lastMessagePreview?.toLowerCase() ?? '';
    return title.includes(term) || preview.includes(term);
  });

  let emptyListText = 'No conversations yet.';
  if (term) emptyListText = `No conversations match “${filter.trim()}”.`;
  else if (conversationFilter === 'groups') emptyListText = 'No group conversations yet.';
  else if (conversationFilter === 'people') emptyListText = 'No conversations with people yet.';

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (status === 'backend-unavailable') {
    return (
      <Card className="rounded border border-border bg-card p-8 text-center">
        <h1 className="text-[20px] font-semibold text-foreground">Chat service offline</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {error}
        </p>
        <Button variant="primary" className="mt-5" onClick={load}>
          Retry
        </Button>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card className="rounded border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Could not load conversations</p>
        <p className="mt-1">{error}</p>
        <Button variant="ghost" className="mt-4" onClick={load}>
          Try again
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[480px] flex-col gap-0 lg:flex-row">
      {/* Column 1 — conversations */}
      <section
        className={cn(
          'flex min-h-0 w-full flex-col overflow-hidden border bg-card lg:w-[280px] lg:shrink-0 xl:w-[240px]',
          selectedId ? 'hidden lg:flex' : 'flex',
        )}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h1 className="text-[17px] font-semibold text-foreground">Messages</h1>
          <span className="text-[12px] text-muted-foreground tnum">
            {conversations.length} {conversations.length === 1 ? 'chat' : 'chats'}
          </span>
        </header>

        <div className="relative border-b border-border p-3">
          <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="pl-9"
          />
        </div>

        <ConversationFilterTabs
          value={conversationFilter}
          onChange={setConversationFilter}
        />

        <div
          id="conversation-list"
          role="tabpanel"
          aria-labelledby={`conversation-filter-${conversationFilter}`}
          className="min-h-0 flex-1 overflow-y-auto scroll-quiet"
        >
          {filteredConversations.length > 0 ? (
            <ul>
              {filteredConversations.map((conv) => {
                const { name, online } = conversationTitle(conv);
                const other = otherMember(conv);
                const isActive = conv.id === selectedId;
                return (
                  <li key={conv.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(conv.id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isActive ? 'bg-secondary' : 'hover:bg-secondary',
                      )}
                    >
                      <span className="relative">
                        <Avatar className="h-9 w-9">
                          {conv.type === 'dm' && other && profiles[other.userId]?.avatarUrl ? (
                            <AvatarImage
                              src={profiles[other.userId]?.avatarUrl ?? undefined}
                              alt={name}
                            />
                          ) : null}
                          <AvatarFallback style={avatarTone(other?.userId)}>
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                        {online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-[#247b50]" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {name}
                        </span>
                        <span className="block truncate text-[12px] text-muted-foreground">
                          {conv.lastMessagePreview ?? 'No messages yet'}
                        </span>
                      </span>
                      {conv.unreadCount > 0 && (
                        <span
                          aria-label={`${conv.unreadCount} unread ${conv.unreadCount === 1 ? 'message' : 'messages'}`}
                          className="rounded-full bg-accent px-1.5 py-0.5 text-[12px] font-semibold leading-none text-accent-foreground tnum"
                        >
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">{emptyListText}</p>
            </div>
          )}
        </div>
      </section>

      {/* Column 2 — the selected thread */}
      <section
        className={cn(
          'min-h-0 flex-1 overflow-hidden border border-border bg-card',
          selectedId ? 'flex flex-col' : 'hidden lg:flex lg:flex-col',
        )}
      >
        {selected ? (
          <>
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Button
                variant="ghost"
                size="icon-sm"
                className="-ml-1 lg:hidden"
                aria-label="Back to conversations"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft className="h-[18px] w-[18px]" />
              </Button>
              <Avatar className="h-9 w-9">
                <AvatarFallback style={avatarTone(otherMember(selected)?.userId)}>
                  {initials(conversationTitle(selected).name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {conversationTitle(selected).name}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {typingUserId ? (
                    <span className="text-accent">
                      {profiles[typingUserId]?.displayName ?? 'Someone'} is typing…
                    </span>
                  ) : (
                    threadStatusText(selected)
                  )}
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                // The third column only exists from xl, so the trigger is hidden below it.
                className="hidden shrink-0 xl:inline-flex"
                aria-label={infoOpen ? 'Ẩn thông tin hội thoại' : 'Hiện thông tin hội thoại'}
                aria-expanded={infoOpen}
                aria-controls="conversation-info"
                onClick={() => setInfoOpen((open) => !open)}
              >
                <Info className="h-[18px] w-[18px]" />
              </Button>
            </header>

