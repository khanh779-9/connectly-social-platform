import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Bell,
  Bookmark,
  Building2,
  CalendarDays,
  Compass,
  History,
  Home,
  MessagesSquare,
  PenSquare,
  SquarePlay,
  Users,
  UsersRound,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  refreshUnreadNotificationCount,
  subscribeUnreadNotifications,
} from '@/lib/social';

const menuItems = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/reels', label: 'Reels', icon: SquarePlay },
  { to: '/profile', label: 'My profile', icon: UserIcon },
];

const spaceItems = [
  { to: '/messages', label: 'Messages', icon: MessagesSquare },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: 'notifications' },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/groups', label: 'Groups', icon: UsersRound },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/pages', label: 'Pages', icon: Building2 },
  { to: '/bookmarks', label: 'Saved posts', icon: Bookmark },
  { to: '/memories', label: 'Memories', icon: History },
];

interface AppSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export default function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => subscribeUnreadNotifications(setUnread), []);

  useEffect(() => {
    refreshUnreadNotificationCount().catch(() => undefined);
  }, []);

  const itemClass = (isActive: boolean) =>
    cn(
      'flex items-center gap-2.5 rounded px-3 py-2 text-[13.5px] transition-colors',
      isActive
        ? 'bg-accent-soft font-medium text-accent'
        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
    );

  function isActive(to: string): boolean {
    if (to === '/') return location.pathname === '/';
    if (to === '/profile') return location.pathname.startsWith('/profile');
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  }

  function handleCreatePost() {
    navigate('/');
    onNavigate?.();
    // let the feed mount, then focus the composer input
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('connectly:focus-composer'));
    }, 220);
  }

