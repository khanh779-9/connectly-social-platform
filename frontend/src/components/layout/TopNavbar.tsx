import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bookmark,
  LogOut,
  Check,
  ChevronDown,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  Settings,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ConnectlyMark from '@/components/layout/ConnectlyMark';
import GlobalSearch from '@/components/layout/GlobalSearch';
import {
  NotificationContent,
  NotificationTypeIcon,
} from '@/features/notifications/notificationPresentation';
import { avatarTone } from '@/lib/avatar';
import { cn } from '@/lib/utils';
import { initials, timeAgo } from '@/lib/social';
import { useNavbarData } from './useNavbarData';
import type { ConversationDto, NotificationApiDto, ProfileDto } from '@/types/api';

function getThemeIcon(name: 'Sun' | 'Moon' | 'Monitor') {
  switch (name) {
    case 'Sun':
      return Sun;
    case 'Moon':
      return Moon;
    case 'Monitor':
      return Monitor;
  }
}

export default function TopNavbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate();
  const {
    displayName,
    userId,
    theme,
    currentTheme,
    themePanelOpen,
    setThemePanelOpen,
    setTheme,
    unreadCount,
    notifications,
    actors,
    loadingNotifications,
    loadNotifications,
    openNotification,
    conversations,
    chatProfiles,
    loadingChats,
    chatUnread,
    loadChats,
    chatPartner,
    chatTitle,
    handleLogout,
  } = useNavbarData(navigate);

  const CurrentThemeIcon = getThemeIcon(currentTheme.iconName);

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-border bg-card">
      <div className="flex h-full items-center">
        {/* Brand — shares the docked rail's width on desktop */}
        <div className="flex h-full shrink-0 items-center gap-1 px-3 lg:w-[264px] lg:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full lg:hidden"
            aria-label="Open navigation"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <ConnectlyMark />
            <span className="hidden text-[15px] font-semibold tracking-tight text-foreground sm:inline">
              Connectly
            </span>
          </Link>
        </div>

        {/* Search + actions — aligned with the content column */}
        <div className="flex h-full min-w-0 flex-1 items-center gap-3 px-3 lg:px-6">
          <GlobalSearch />

          <div className="ml-auto flex items-center gap-1">
            {/* Messages open as a peek menu; picking a chat jumps into Messages */}
            <DropdownMenu onOpenChange={(open) => open && loadChats()}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative rounded-full"
                  aria-label={
                    chatUnread > 0 ? `Messages, ${chatUnread} unread` : 'Messages'
                  }
                >
                  <MessageSquare className="h-[18px] w-[18px]" />
                  {chatUnread > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[12px] font-semibold leading-none text-accent-foreground tnum">
                      {chatUnread > 99 ? '99+' : chatUnread}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[min(340px,calc(100vw-1.5rem))] p-0">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-foreground">Messages</p>
                  <span className="text-[12px] text-muted-foreground tnum">
                    {conversations.length} {conversations.length === 1 ? 'chat' : 'chats'}
                  </span>
                </div>
                <DropdownMenuSeparator className="mx-0 my-0" />

                <div className="max-h-[380px] overflow-y-auto p-1.5 scroll-quiet">
                  {loadingChats && conversations.length === 0 ? (
                    <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                      Loading…
                    </p>
                  ) : conversations.length === 0 ? (
                    <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                      No conversations yet.
                    </p>
                  ) : (
                    conversations.slice(0, 6).map((conv) => {
                      const partner = chatPartner(conv);
                      const profile = partner ? chatProfiles[partner] : null;
                      const online =
                        conv.type === 'dm' &&
                        Boolean(conv.members.find((m) => m.userId === partner)?.online);
                      return (
                        <DropdownMenuItem
                          key={conv.id}
                          className={cn(
                            'items-start gap-2.5 px-2.5 py-2',
                            conv.unreadCount > 0 && 'bg-accent-soft/50',
                          )}
                          onSelect={() =>
                            navigate('/messages', { state: { conversationId: conv.id } })
                          }
                        >
                          <span className="relative shrink-0">
                            <Avatar className="h-8 w-8">
                              {profile?.avatarUrl ? (
                                <AvatarImage
                                  src={profile.avatarUrl}
                                  alt={profile.displayName}
                                />
                              ) : null}
                              <AvatarFallback
                                className="text-[12px]"
                                style={avatarTone(partner ?? conv.id)}
                              >
                                {initials(chatTitle(conv))}
                              </AvatarFallback>
                            </Avatar>
                            {online && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-popover" style={{ backgroundColor: 'var(--accent-online)' }} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-foreground">
                              {chatTitle(conv)}
                            </span>
                            <span className="block truncate text-[12px] text-muted-foreground">
                              {conv.lastMessagePreview ?? 'No messages yet'}
                            </span>
                          </span>
                          {conv.unreadCount > 0 && (
                            <span className="mt-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[12px] font-semibold leading-none text-accent-foreground tnum">
                              {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                            </span>
                          )}
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </div>

                <DropdownMenuSeparator className="mx-0 my-0" />
                <DropdownMenuItem
                  className="justify-center rounded-none py-2.5 text-[13px] font-medium text-accent focus:bg-secondary focus:text-accent"
                  onSelect={() => navigate('/messages')}
                >
                  Open Messages
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

