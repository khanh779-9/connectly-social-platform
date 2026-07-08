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

  return (
    <nav
      className={cn(
        'flex h-full flex-col overflow-y-auto border-r border-border bg-card px-3 py-4 scroll-quiet',
        className,
      )}
    >
      {/* Primary action */}
      <button
        type="button"
        onClick={handleCreatePost}
        className="mb-5 flex h-9 w-full items-center justify-center gap-2 rounded bg-primary text-[13.5px] font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        <PenSquare className="h-4 w-4" />
        New post
      </button>

      <p className="px-3 pb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        Menu
      </p>
      <ul className="flex flex-col gap-0.5">
        {menuItems.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} onClick={onNavigate} className={itemClass(isActive(to))}>
              <Icon
                className={cn(
                  'h-[18px] w-[18px]',
                  isActive(to) ? 'text-accent' : 'text-muted-foreground',
                )}
              />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      <p className="px-3 pb-1.5 pt-6 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        Your space
      </p>
      <ul className="flex flex-col gap-0.5">
        {spaceItems.map(({ to, label, icon: Icon, badge }) => (
          <li key={to}>
            <NavLink to={to} onClick={onNavigate} className={itemClass(isActive(to))}>
              <Icon
                className={cn(
                  'h-[18px] w-[18px]',
                  isActive(to) ? 'text-accent' : 'text-muted-foreground',
                )}
              />
              <span className="flex-1">{label}</span>
              {badge === 'notifications' && unread > 0 && (
                <span
                  className="rounded-full bg-accent px-1.5 py-0.5 text-[12px] font-semibold leading-none text-accent-foreground tnum"
                  title={`${unread} unread notifications`}
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="mt-auto px-3 pt-8">
        <p className="text-[12px] font-medium text-foreground">Connectly</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Social platform · {new Date().getFullYear()}
        </p>
      </div>
    </nav>
  );
}
