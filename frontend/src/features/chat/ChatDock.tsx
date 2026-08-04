import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Loader2,
  Maximize2,
  MessageCircle,
  Minus,
  Send,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store/hooks';
import { avatarTone } from '@/lib/avatar';
import { createHubConnection, HubConnection } from '@/lib/hubs';
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
} from '@/lib/social';
import { fetchPresence, presenceLabel } from '@/lib/presence';
import type { ChatMessageDto, ConversationDto, PresenceDto, ProfileDto } from '@/types/api';
import ChatDockMessage from './ChatDockMessage';
import {
  LOAD_OLDER_THRESHOLD_PX,
  mergeChatMessages,
  useChatTimeline,
} from './useChatTimeline';
import Overlay from '@/components/ui/overlay';

const STORAGE_KEY = 'connectly.chatdock';
const MAX_WINDOWS = 2;

interface DockWindow {
  id: string;
  minimized: boolean;
}

function readWindows(): DockWindow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DockWindow[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => typeof entry?.id === 'string')
      .slice(0, MAX_WINDOWS)
      .map((entry) => ({ id: entry.id, minimized: Boolean(entry.minimized) }));
  } catch {
    return [];
  }
}

/**
 * Facebook-style chat dock: a launcher bar that always sits at the bottom right,
 * plus up to two conversation windows that can be expanded, minimised to their
 * title bar, or dismissed — without ever leaving the page you are reading.
 */
export default function ChatDock() {
  const myId = useAppSelector((state) => state.auth.userId);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileDto | null>>({});
  const [windows, setWindows] = useState<DockWindow[]>(readWindows);
  const [threads, setThreads] = useState<Record<string, ChatMessageDto[]>>({});
  const [messageCursors, setMessageCursors] = useState<Record<string, string | null>>({});
  const [loadingOlder, setLoadingOlder] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // One flag per window: a single shared flag blocked sending in every other
  // window while one of them was in flight.
  const [sendingIds, setSendingIds] = useState<Record<string, boolean>>({});
  const [replyTargets, setReplyTargets] = useState<Record<string, ChatMessageDto | null>>({});
  const [menuIds, setMenuIds] = useState<Record<string, string | null>>({});
  const [edits, setEdits] = useState<Record<string, { id: string; draft: string } | null>>({});
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [presence, setPresence] = useState<Record<string, PresenceDto>>({});
  const [trayOpen, setTrayOpen] = useState(false);
  const [hubReady, setHubReady] = useState(false);

  const hubRef = useRef<HubConnection | null>(null);
  const windowsRef = useRef<DockWindow[]>(windows);
  const requestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    windowsRef.current = windows;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(windows));
  }, [windows]);

  // Conversation list + display names.
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchConversations()
      .then(async (list) => {
        if (cancelled) return;
        setConversations(list);
        const memberIds = list.flatMap((conv) => conv.members.map((m) => m.userId));
        const resolved = await ensureProfiles(memberIds);
        if (!cancelled) setProfiles((prev) => ({ ...prev, ...resolved }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [myId]);

  // Presence: "Active now" / "Active 3h ago" for the person in the window.
  const presenceKey = Array.from(
    new Set(conversations.flatMap((conv) => conv.members.map((member) => member.userId))),
  ).join(',');

  useEffect(() => {
    if (!presenceKey) return;
    let cancelled = false;
    const load = () => {
      fetchPresence(presenceKey.split(','))
        .then((next) => {
          if (cancelled) return;
          setPresence((prev) => ({ ...prev, ...next }));
        })
        .catch(() => undefined);
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [presenceKey]);

  // One hub connection for the whole dock; windows read from `threads`.
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
    hubRef.current = connection;

    connection.on('message-received', (message: ChatMessageDto) => {
      const open = windowsRef.current.some((w) => w.id === message.conversationId);
      setThreads((prev) => {
        const thread = prev[message.conversationId];
        if (!thread || thread.some((m) => m.id === message.id)) return prev;
        return {
          ...prev,
          [message.conversationId]: mergeChatMessages(thread, [message]),
        };
      });
      setConversations((prev) => {
        const index = prev.findIndex((conv) => conv.id === message.conversationId);
        if (index === -1) return prev;
        const target = prev[index];
        const fromOthers = message.senderUserId !== myId;
        const bumped: ConversationDto = {
          ...target,
          lastMessageAt: message.sentAt,
          lastMessagePreview: message.body ?? 'Sent a message',
          lastMessageSenderUserId: message.senderUserId,
          unreadCount: open || !fromOthers ? 0 : target.unreadCount + 1,
        };
        return [bumped, ...prev.filter((_, i) => i !== index)];
      });
      if (open) markConversationRead(message.conversationId).catch(() => undefined);
    });

    connection.on('presence-updated', (payload: { userId: string; online: boolean }) => {
      setPresence((prev) => ({
        ...prev,
        [payload.userId]: {
          online: payload.online,
          lastSeenAt: payload.online ? null : prev[payload.userId]?.lastSeenAt ?? null,
        },
      }));
      setConversations((prev) =>
        prev.map((conv) => ({
          ...conv,
          members: conv.members.map((member) =>
            member.userId === payload.userId ? { ...member, online: payload.online } : member,
          ),
        })),
      );
    });

    connection.on('message-updated', (message: ChatMessageDto) => {
      setThreads((prev) => {
        const thread = prev[message.conversationId];
        if (!thread) return prev;
        return {
          ...prev,
          [message.conversationId]: thread.map((m) =>
            m.id === message.id ? { ...message, reactions: message.reactions ?? m.reactions } : m,
          ),
        };
      });
    });

    connection.on(
      'message-deleted',
      (payload: { conversationId: string; messageId: string }) => {
        setThreads((prev) => {
          const thread = prev[payload.conversationId];
          if (!thread) return prev;
          return {
            ...prev,
            [payload.conversationId]: thread.map((m) =>
              m.id === payload.messageId
                ? { ...m, status: 'deleted', body: null, attachments: [], reactions: [] }
                : m,
            ),
          };
        });
      },
    );

    connection
      .start()
      .then(() => setHubReady(true))
      .catch(() => undefined);

    return () => {
      connection.stop().catch(() => undefined);
      hubRef.current = null;
      setHubReady(false);
    };
  }, [myId]);

  // Load the first page of messages for any window that has no thread yet.
  useEffect(() => {
    windows.forEach((win) => {
      if (requestedRef.current.has(win.id)) return;
      requestedRef.current.add(win.id);
      fetchMessages(win.id, undefined, 30)
        .then((page) => {
          setMessageCursors((prev) => ({
            ...prev,
            [win.id]: page.nextCursor ?? null,
          }));
          setThreads((prev) => ({
            ...prev,
            // a realtime message may already have reached the thread: merge the page
            // instead of dropping it, otherwise the window shows a single message
            [win.id]: mergeChatMessages(prev[win.id] ?? [], page.items),
          }));
        })
        .catch(() => setThreads((prev) => ({ ...prev, [win.id]: [] })));
      markConversationRead(win.id).catch(() => undefined);
      setConversations((prev) =>
        prev.map((conv) => (conv.id === win.id ? { ...conv, unreadCount: 0 } : conv)),
      );
    });
  }, [windows]);

  function otherMember(conv: ConversationDto): { userId: string; online: boolean } | null {
    const other = conv.members.find((m) => m.userId !== myId);
    if (other) return { userId: other.userId, online: other.online };
    const first = conv.members[0];
    return first ? { userId: first.userId, online: first.online } : null;
  }

  function titleOf(conv: ConversationDto): { name: string; online: boolean; avatar?: string | null } {
    const other = otherMember(conv);
    if (conv.type === 'group') {
      return { name: conv.title ?? 'Group chat', online: false, avatar: null };
    }
    const profile = other ? profiles[other.userId] : null;
    return {
      name: profile?.displayName ?? 'Conversation',
      online: other?.online ?? false,
      avatar: profile?.avatarUrl ?? null,
    };
  }

  function openWindow(id: string) {
    setTrayOpen(false);
    setWindows((prev) => {
      const existing = prev.find((win) => win.id === id);
      if (existing) {
        return prev.map((win) => (win.id === id ? { ...win, minimized: false } : win));
      }
      return [{ id, minimized: false }, ...prev].slice(0, MAX_WINDOWS);
    });
  }

  function minimizeWindow(id: string) {
    setWindows((prev) =>
      prev.map((win) => (win.id === id ? { ...win, minimized: !win.minimized } : win)),
    );
  }

  function closeWindow(id: string) {
    setWindows((prev) => prev.filter((win) => win.id !== id));
  }

  async function loadOlderMessages(id: string) {
    const cursor = messageCursors[id];
    if (!cursor || loadingOlder[id]) return;

    setLoadingOlder((prev) => ({ ...prev, [id]: true }));
    try {
      const page = await fetchMessages(id, cursor, 30);
      setThreads((prev) => ({
        ...prev,
        [id]: mergeChatMessages(prev[id] ?? [], page.items),
      }));
      setMessageCursors((prev) => ({ ...prev, [id]: page.nextCursor ?? null }));
    } catch {
      // Keep the current cursor so scrolling up can try again.
    } finally {
      setLoadingOlder((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleSend(id: string) {
    const body = (drafts[id] ?? '').trim();
    if (!body || sendingIds[id]) return;
    setSendingIds((prev) => ({ ...prev, [id]: true }));
    setErrors((prev) => ({ ...prev, [id]: null }));
    try {
      const message = await sendChatMessage(id, body, replyTargets[id]?.id ?? null);
      setThreads((prev) => {
        const thread = prev[id] ?? [];
        if (thread.some((m) => m.id === message.id)) return prev;
        return { ...prev, [id]: mergeChatMessages(thread, [message]) };
      });
      // only clear the draft when the user did not type something else meanwhile
      setDrafts((prev) => (prev[id]?.trim() === body ? { ...prev, [id]: '' } : prev));
      setReplyTargets((prev) => ({ ...prev, [id]: null }));
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === id
            ? {
                ...conv,
                lastMessageAt: message.sentAt,
                lastMessagePreview: message.body ?? 'Sent a message',
                lastMessageSenderUserId: message.senderUserId,
              }
            : conv,
        ),
      );
    } catch (err) {
      // The draft stays so the message can be retried, and the reason is shown.
      setErrors((prev) => ({ ...prev, [id]: getErrorMessage(err) }));
    } finally {
      setSendingIds((prev) => ({ ...prev, [id]: false }));
    }
  }

  // ---------- per-message actions ----------

  function closeMenu(conversationId: string) {
    setMenuIds((prev) => ({ ...prev, [conversationId]: null }));
  }

  async function toggleReaction(conversationId: string, message: ChatMessageDto, emoji: string) {
    if (actionBusyId) return;
    setActionBusyId(message.id);
    try {
      const existing = (message.reactions ?? []).find((r) => r.reactionType === emoji);
      const dto = existing?.viewerReacted
        ? await removeChatMessageReaction(message.id, emoji)
        : await addChatMessageReaction(message.id, emoji);
      setThreads((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map((m) => {
          if (m.id !== message.id) return m;
          const reactions = (m.reactions ?? []).filter((r) => r.reactionType !== emoji);
          if (dto.count > 0) reactions.push(dto);
          return { ...m, reactions };
        }),
      }));
      closeMenu(conversationId);
    } catch (err) {
      setErrors((prev) => ({ ...prev, [conversationId]: getErrorMessage(err) }));
    } finally {
      setActionBusyId(null);
    }
  }

  function startReply(conversationId: string, message: ChatMessageDto) {
    setReplyTargets((prev) => ({ ...prev, [conversationId]: message }));
    closeMenu(conversationId);
  }

  function startEdit(conversationId: string, message: ChatMessageDto) {
    setEdits((prev) => ({ ...prev, [conversationId]: { id: message.id, draft: message.body ?? '' } }));
    closeMenu(conversationId);
  }

  async function submitEdit(conversationId: string, message: ChatMessageDto) {
    const edit = edits[conversationId];
    const body = (edit?.draft ?? '').trim();
    if (!body || actionBusyId) return;
    setActionBusyId(message.id);
    try {
      const updated = await editChatMessage(message.id, body);
      setThreads((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map((m) => (m.id === message.id ? updated : m)),
      }));
      setEdits((prev) => ({ ...prev, [conversationId]: null }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [conversationId]: getErrorMessage(err) }));
    } finally {
      setActionBusyId(null);
    }
  }

  /** Recall for everybody: both sides keep a "recalled" placeholder. */
  async function recallMessage(conversationId: string, message: ChatMessageDto) {
    if (actionBusyId) return;
    setActionBusyId(message.id);
    try {
      await deleteChatMessage(message.id);
      setThreads((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map((m) =>
          m.id === message.id
            ? { ...m, status: 'deleted', body: null, attachments: [], reactions: [] }
            : m,
        ),
      }));
      closeMenu(conversationId);
    } catch (err) {
      setErrors((prev) => ({ ...prev, [conversationId]: getErrorMessage(err) }));
    } finally {
      setActionBusyId(null);
    }
  }

  /** Delete for me only: the message leaves my timeline, theirs keeps it. */
  async function deleteForMe(conversationId: string, message: ChatMessageDto) {
    if (actionBusyId) return;
    setActionBusyId(message.id);
    try {
      await hideChatMessage(message.id);
      setThreads((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).filter((m) => m.id !== message.id),
      }));
      closeMenu(conversationId);
    } catch (err) {
      setErrors((prev) => ({ ...prev, [conversationId]: getErrorMessage(err) }));
    } finally {
      setActionBusyId(null);
    }
  }

  const totalUnread = conversations.reduce(
    (sum, conv) => sum + Math.max(0, conv.unreadCount),
    0,
  );

  if (!myId) return null;
  if (pathname.startsWith('/messages')) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-3 z-40 flex items-end gap-3">
      {windows.map((win, windowIndex) => {
        const conv = conversations.find((c) => c.id === win.id);
        if (!conv) return null;
        const { name, online, avatar } = titleOf(conv);
        const other = otherMember(conv);
        return (
          <ChatWindow
            key={win.id}
            // Phones only have room for one window; the second waits for sm+.
            className={windowIndex > 0 ? 'hidden sm:flex' : undefined}
            name={name}
            online={online}
            avatarUrl={avatar}
            seed={other?.userId ?? conv.id}
            conversationId={win.id}
            messages={threads[win.id] ?? []}
            myId={myId}
            minimized={win.minimized}
            draft={drafts[win.id] ?? ''}
            sending={Boolean(sendingIds[win.id])}
            hubReady={hubReady}
            hasOlder={Boolean(messageCursors[win.id])}
            loadingOlder={Boolean(loadingOlder[win.id])}
            presence={other ? presence[other.userId] ?? null : null}
            replyTarget={replyTargets[win.id] ?? null}
            menuId={menuIds[win.id] ?? null}
            editing={edits[win.id] ?? null}
            actionBusyId={actionBusyId}
            error={errors[win.id] ?? null}
            onDraft={(text) => setDrafts((prev) => ({ ...prev, [win.id]: text }))}
            onSend={() => handleSend(win.id)}
            onLoadOlder={() => loadOlderMessages(win.id)}
            onMinimize={() => minimizeWindow(win.id)}
            onClose={() => closeWindow(win.id)}
            onToggleMenu={(messageId) =>
              setMenuIds((prev) => ({
                ...prev,
                [win.id]: prev[win.id] === messageId ? null : messageId,
              }))
            }
            onCloseMenu={() => setMenuIds((prev) => ({ ...prev, [win.id]: null }))}
            onReact={(message, emoji) => void toggleReaction(win.id, message, emoji)}
            onReply={(message) => startReply(win.id, message)}
            onStartEdit={(message) => startEdit(win.id, message)}
            onEditDraftChange={(text) =>
              setEdits((prev) => ({
                ...prev,
                [win.id]: prev[win.id] ? { ...prev[win.id]!, draft: text } : prev[win.id] ?? null,
              }))
            }
            onSubmitEdit={(message) => void submitEdit(win.id, message)}
            onCancelEdit={() => setEdits((prev) => ({ ...prev, [win.id]: null }))}
            onRecall={(message) => void recallMessage(win.id, message)}
            onDeleteForMe={(message) => void deleteForMe(win.id, message)}
            onClearReply={() => setReplyTargets((prev) => ({ ...prev, [win.id]: null }))}
            onDismissError={() => setErrors((prev) => ({ ...prev, [win.id]: null }))}
            onExpand={() =>
              navigate('/messages', { state: { conversationId: win.id } })
            }
          />
        );
      })}

      <div className="pointer-events-auto relative">
        {trayOpen && (
          <>
            <Overlay className="fixed inset-0 z-0" onClick={() => setTrayOpen(false)} />
            <div className="absolute bottom-[calc(100%+8px)] right-0 z-10 max-h-[min(420px,70vh)] w-80 overflow-y-auto rounded border border-border bg-popover p-1.5 shadow-dropdown scroll-quiet">
              <div className="flex items-center justify-between px-2.5 py-2">
                <p className="text-[13px] font-semibold text-foreground">Chats</p>
                <button
                  type="button"
                  onClick={() => navigate('/messages')}
                  className="text-[12px] font-medium text-accent hover:underline"
                >
                  See all
                </button>
              </div>
              {conversations.length === 0 ? (
                <p className="px-2.5 py-6 text-center text-[13px] text-muted-foreground">
                  No conversations yet.
                </p>
              ) : (
                conversations.map((conv) => {
                  const info = titleOf(conv);
                  const other = otherMember(conv);
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => openWindow(conv.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left transition-colors hover:bg-secondary',
                        conv.unreadCount > 0 && 'bg-accent-soft/60',
                      )}
                    >
                      <span className="relative">
                        <Avatar className="h-9 w-9">
                          {info.avatar ? (
                            <AvatarImage src={info.avatar} alt={info.name} />
                          ) : null}
                          <AvatarFallback style={avatarTone(other?.userId ?? conv.id)}>
                            {initials(info.name)}
                          </AvatarFallback>
                        </Avatar>
                        {info.online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-popover" style={{ backgroundColor: 'var(--accent-online)' }} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {info.name}
                        </span>
                        <span className="block truncate text-[12px] text-muted-foreground">
                          {conv.lastMessagePreview ??
                            (conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : 'No messages yet')}
                        </span>
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[12px] font-semibold leading-none text-accent-foreground tnum">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => setTrayOpen((open) => !open)}
          aria-expanded={trayOpen}
          aria-label="Chats"
          title="Chats"
          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
        >
          <MessageCircle className="h-6 w-6" />
          {totalUnread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-destructive px-1 text-[12px] font-semibold leading-none text-white tnum">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

interface ChatWindowProps {
  className?: string;
  name: string;
  online: boolean;
  avatarUrl?: string | null;
  seed: string;
  conversationId: string;
  messages: ChatMessageDto[];
  myId?: string;
  minimized: boolean;
  draft: string;
  sending: boolean;
  hubReady: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  presence?: PresenceDto | null;
  replyTarget?: ChatMessageDto | null;
  menuId?: string | null;
  editing?: { id: string; draft: string } | null;
  actionBusyId?: string | null;
  error?: string | null;
  onDraft: (text: string) => void;
  onSend: () => void | Promise<void>;
  onLoadOlder: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onToggleMenu: (messageId: string) => void;
  onCloseMenu: () => void;
  onReact: (message: ChatMessageDto, emoji: string) => void;
  onReply: (message: ChatMessageDto) => void;
  onStartEdit: (message: ChatMessageDto) => void;
  onEditDraftChange: (text: string) => void;
  onSubmitEdit: (message: ChatMessageDto) => void;
  onCancelEdit: () => void;
  onRecall: (message: ChatMessageDto) => void;
  onDeleteForMe: (message: ChatMessageDto) => void;
  onClearReply: () => void;
  onDismissError: () => void;
  onExpand: () => void;
}

