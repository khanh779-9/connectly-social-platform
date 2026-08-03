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

