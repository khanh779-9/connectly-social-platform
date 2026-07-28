import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Loader2, MessageCircle, UserMinus, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAppSelector } from '@/store/hooks';
import { avatarTone } from '@/lib/avatar';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  createDirectConversation,
  declineFriendRequest,
  fetchFriends,
  fetchReceivedFriendRequests,
  fetchSentFriendRequests,
  getErrorMessage,
  initials,
  removeFriend,
  timeAgo,
} from '@/lib/social';
import { fetchPresence, presenceLabel } from '@/lib/presence';
import type { FriendRequestDto, PresenceDto, ProfileDto } from '@/types/api';

/** Presence is ephemeral, so the list re-checks it while the page stays open. */
const PRESENCE_INTERVAL_MS = 30_000;

type Tab = 'friends' | 'received' | 'sent';

export default function FriendsPage() {
  const myId = useAppSelector((state) => state.auth.userId);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('friends');

  const [friends, setFriends] = useState<ProfileDto[]>([]);
  const [received, setReceived] = useState<FriendRequestDto[]>([]);
  const [sent, setSent] = useState<FriendRequestDto[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, PresenceDto>>({});

  async function load() {
    setStatus('loading');
    setError(null);
    try {
      const [friendList, incoming, outgoing] = await Promise.all([
        myId ? fetchFriends(myId) : Promise.resolve([] as ProfileDto[]),
        fetchReceivedFriendRequests(),
        fetchSentFriendRequests(),
      ]);
      setFriends(friendList);
      setReceived(incoming);
      setSent(outgoing);
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, [myId]);

  useEffect(() => {
    const ids = friends.map((friend) => friend.userId);
    if (ids.length === 0) {
      setPresence({});
      return;
    }

    let cancelled = false;
    const tick = async () => {
      const snapshot = await fetchPresence(ids);
      if (!cancelled) setPresence(snapshot);
    };
    tick();
    const timer = window.setInterval(tick, PRESENCE_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [friends]);

  async function accept(request: FriendRequestDto) {
    setWorkingId(request.requestId);
    try {
      await acceptFriendRequest(request.requestId);
      setReceived((prev) => prev.filter((item) => item.requestId !== request.requestId));
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorkingId(null);
    }
  }

  async function decline(request: FriendRequestDto) {
    setWorkingId(request.requestId);
    try {
      await declineFriendRequest(request.requestId);
      setReceived((prev) => prev.filter((item) => item.requestId !== request.requestId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorkingId(null);
    }
  }

  async function cancel(request: FriendRequestDto) {
    setWorkingId(request.requestId);
    try {
      await cancelFriendRequest(request.requestId);
      setSent((prev) => prev.filter((item) => item.requestId !== request.requestId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorkingId(null);
    }
  }

  async function unfriend(friend: ProfileDto) {
    setWorkingId(friend.userId);
    try {
      await removeFriend(friend.userId);
      setFriends((prev) => prev.filter((item) => item.userId !== friend.userId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorkingId(null);
    }
  }

  async function message(friend: ProfileDto) {
    try {
      const conversation = await createDirectConversation(friend.userId);
      navigate('/messages', { state: { conversationId: conversation.id } });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const tabs = [
    { key: 'friends' as Tab, label: 'Friends', count: friends.length },
    { key: 'received' as Tab, label: 'Requests received', count: received.length },
    { key: 'sent' as Tab, label: 'Requests sent', count: sent.length },
  ];

  return (
    <div className="mx-auto space-y-5">
      <header>
        <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
          Friends
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {received.length > 0
            ? `${received.length} ${received.length === 1 ? 'request is' : 'requests are'} waiting for you.`
            : 'Your friends and the requests you have sent or received.'}
        </p>
      </header>

      <nav className="flex gap-1 border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={
              tab === item.key
                ? 'border-b-2 border-accent px-3 py-2 text-sm font-medium text-foreground'
                : 'border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground'
            }
          >
            {item.label}
            <span className="ml-1.5 text-[12px] text-muted-foreground tnum">{item.count}</span>
          </button>
        ))}
      </nav>

      {error && <p className="text-[12px] text-destructive">{error}</p>}

      {status === 'loading' && (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {status === 'error' && (
        <Card className="rounded border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Could not load your friends</p>
          <p className="mt-1">{error}</p>
          <Button variant="ghost" className="mt-4" onClick={load}>
            Try again
          </Button>
        </Card>
      )}

