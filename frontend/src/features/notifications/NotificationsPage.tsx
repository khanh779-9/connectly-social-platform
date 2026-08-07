import { useEffect, useState } from 'react';
import { CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  NotificationContent,
  NotificationTypeIcon,
} from '@/features/notifications/notificationPresentation';
import {
  ensureProfiles,
  fetchNotifications,
  getErrorMessage,
  markAllNotificationsRead,
  markNotificationRead,
  refreshUnreadNotificationCount,
  setUnreadNotificationCount,
  timeAgo,
} from '@/lib/social';
import type { NotificationApiDto, ProfileDto } from '@/types/api';

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationApiDto[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileDto | null>>({});
  const [markingAll, setMarkingAll] = useState(false);

  async function load() {
    setStatus('loading');
    setError(null);
    try {
      const list = await fetchNotifications('all', 50);
      setItems(list);
      const actorIds = list.filter((n) => n.actorUserId).map((n) => n.actorUserId as string);
      const resolved = await ensureProfiles(actorIds);
      setProfiles((prev) => ({ ...prev, ...resolved }));
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleMarkAll() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          status: 'read',
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
      setUnreadNotificationCount(0);
    } catch {
      // silent — the list keeps its unread marks
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleMarkOne(id: string) {
    try {
      await markNotificationRead(id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'read', readAt: new Date().toISOString() }
            : item,
        ),
      );
      await refreshUnreadNotificationCount();
    } catch {
      // silent
    }
  }

  const unread = items.filter((item) => item.status.toLowerCase() === 'unread');

  return (
    <div className="mx-auto space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            Notifications
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {unread.length > 0
              ? `${unread.length} waiting to be read.`
              : 'You are all caught up.'}
          </p>
        </div>
        {unread.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={markingAll}
            onClick={handleMarkAll}
          >
            {markingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Mark all read
          </Button>
        )}
      </header>

