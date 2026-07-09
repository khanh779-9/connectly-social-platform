import { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/authSlice';
import {
  ensureProfiles,
  fetchConversations,
  fetchNotifications,
  markNotificationRead,
  refreshUnreadNotificationCount,
  subscribeUnreadNotifications,
} from '@/lib/social';
import { readTheme, setTheme as setThemeMode, subscribeTheme, type ThemeMode } from '@/lib/theme';
import type { ConversationDto, NotificationApiDto, ProfileDto } from '@/types/api';

const THEME_OPTIONS = [
  { mode: 'light' as const, label: 'Light', iconName: 'Sun' },
  { mode: 'dark' as const, label: 'Dark', iconName: 'Moon' },
  { mode: 'system' as const, label: 'Auto', iconName: 'Monitor' },
] as const;

/**
 * The data the top navbar shows: the theme, the notifications and the chats.
 */
export function useNavbarData(
  onNavigate: (path: string, state?: Record<string, unknown>) => void
) {
  const dispatch = useAppDispatch();
  const { displayName, userId } = useAppSelector((state) => state.auth);

  const [unreadCount, setUnreadCount] = useState(0);
  const [theme, setThemeMode] = useState<ThemeMode>(readTheme);
  const [themePanelOpen, setThemePanelOpen] = useState(false);

  const [notifications, setNotifications] = useState<NotificationApiDto[]>([]);
  const [actors, setActors] = useState<Record<string, ProfileDto | null>>({});
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [chatProfiles, setChatProfiles] = useState<Record<string, ProfileDto | null>>({});
  const [loadingChats, setLoadingChats] = useState(false);

  useEffect(() => subscribeTheme(setThemeMode), []);
  useEffect(() => subscribeUnreadNotifications(setUnreadCount), []);

  useEffect(() => {
    refreshUnreadNotificationCount().catch(() => undefined);
  }, []);

  const currentTheme = THEME_OPTIONS.find((option) => option.mode === theme) ?? THEME_OPTIONS[2];

  const chatUnread = conversations.reduce(
    (sum, conv) => sum + Math.max(0, conv.unreadCount),
    0,
  );

  async function loadNotifications() {
    setLoadingNotifications(true);
    try {
      const list = await fetchNotifications('all', 6);
      setNotifications(list);

      const actorIds = list
        .map((item) => item.actorUserId)
        .filter((id): id is string => Boolean(id));
      if (actorIds.length > 0) setActors(await ensureProfiles(actorIds));
    } catch {
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  }

  async function loadChats() {
    setLoadingChats(true);
    try {
      const list = await fetchConversations();
      setConversations(list);

      const memberIds = list
        .flatMap((conv) => conv.members.map((member) => member.userId))
        .filter((id) => id !== userId);
      if (memberIds.length > 0) setChatProfiles(await ensureProfiles(memberIds));
    } catch {
      setConversations([]);
    } finally {
      setLoadingChats(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    loadChats();
  }, [userId]);

  /** The other person in a chat (the first member for a group). */
  function chatPartner(conv: ConversationDto): string | undefined {
    const other = conv.members.find((member) => member.userId !== userId);
    return other?.userId ?? conv.members[0]?.userId;
  }

  function chatTitle(conv: ConversationDto): string {
    if (conv.type === 'group') return conv.title ?? 'Group chat';

    const partner = chatPartner(conv);
    return (partner ? chatProfiles[partner]?.displayName : null) ?? 'Conversation';
  }

  function openNotification(notification: NotificationApiDto) {
    if (notification.status.toLowerCase() === 'unread') {
      void markNotificationRead(notification.id)
        .then(() => {
          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id
                ? {
                    ...item,
                    status: 'read',
                    readAt: item.readAt ?? new Date().toISOString(),
                  }
                : item,
            ),
          );
          return refreshUnreadNotificationCount();
        })
        .catch(() => undefined);
    }

    if (notification.type === 'new_signin') onNavigate('/settings', { section: 'security' });
    else if (notification.type === 'welcome') onNavigate('/profile');
    else if (notification.targetPostId) onNavigate(`/post/${notification.targetPostId}`);
    else onNavigate('/notifications');
  }

  function handleLogout() {
    dispatch(logout());
    onNavigate('/login');
  }

  function setTheme(mode: ThemeMode) {
    setThemeMode(mode);
    setThemePanelOpen(false);
  }

  return {
    // Auth
    displayName,
    userId,

    // Theme
    theme,
    currentTheme,
    setTheme,
    themePanelOpen,
    setThemePanelOpen,

    // Notifications
    unreadCount,
    notifications,
    actors,
    loadingNotifications,
    loadNotifications,
    openNotification,

    // Conversations
    conversations,
    chatProfiles,
    loadingChats,
    chatUnread,
    loadChats,
    chatPartner,
    chatTitle,

    // Actions
    handleLogout,
  };
}
