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

      {status === 'ready' && tab === 'friends' && (
        <Card className="rounded border border-border bg-card">
          {friends.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No friends yet. Find people in Explore and send a request.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {friends.map((friend) => {
                const presenceStatus = presence[friend.userId];
                const isOnline = presenceStatus?.online === true;
                const label = presenceLabel(presenceStatus);
                return (
                <li key={friend.userId} className="flex items-center gap-3 px-5 py-3">
                  <span className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      {friend.avatarUrl ? (
                        <AvatarImage src={friend.avatarUrl} alt={friend.displayName} />
                      ) : null}
                      <AvatarFallback style={avatarTone(friend.userId)}>
                        {initials(friend.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline && (
                      <span
                        aria-label="Active now"
                        title="Active now"
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-[#2f9e44]"
                      />
                    )}
                  </span>
                  <Link to={`/profile/${friend.userId}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {friend.displayName}
                    </span>
                    {label ? (
                      <span
                        className={
                          isOnline
                            ? 'block text-[12px] font-medium text-[#2f9e44]'
                            : 'block text-[12px] text-muted-foreground'
                        }
                      >
                        {label}
                      </span>
                    ) : (
                      friend.bio && (
                        <span className="block truncate text-[12px] text-muted-foreground">
                          {friend.bio}
                        </span>
                      )
                    )}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Message ${friend.displayName}`}
                    onClick={() => message(friend)}
                  >
                    <MessageCircle className="h-[18px] w-[18px]" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${friend.displayName}`}
                    disabled={workingId === friend.userId}
                    onClick={() => unfriend(friend)}
                  >
                    <UserMinus className="h-[18px] w-[18px]" />
                  </Button>
                </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {status === 'ready' && tab === 'received' && (
        <Card className="rounded border border-border bg-card">
          {received.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No pending requests.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {received.map((request) => (
                <li key={request.requestId} className="flex items-center gap-3 px-5 py-3">
                  <Avatar className="h-10 w-10">
                    {request.profile.avatarUrl ? (
                      <AvatarImage
                        src={request.profile.avatarUrl}
                        alt={request.profile.displayName}
                      />
                    ) : null}
                    <AvatarFallback style={avatarTone(request.otherUserId)}>
                      {initials(request.profile.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <Link to={`/profile/${request.otherUserId}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {request.profile.displayName}
                    </span>
                    <span className="block text-[12px] text-muted-foreground">
                      Sent {timeAgo(request.createdAt)}
                    </span>
                  </Link>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={workingId === request.requestId}
                    onClick={() => accept(request)}
                  >
                    <Check className="h-4 w-4" />
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Decline request"
                    disabled={workingId === request.requestId}
                    onClick={() => decline(request)}
                  >
                    <X className="h-[18px] w-[18px]" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {status === 'ready' && tab === 'sent' && (
        <Card className="rounded border border-border bg-card">
          {sent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              You have not sent any requests.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {sent.map((request) => (
                <li key={request.requestId} className="flex items-center gap-3 px-5 py-3">
                  <Avatar className="h-10 w-10">
                    {request.profile.avatarUrl ? (
                      <AvatarImage
                        src={request.profile.avatarUrl}
                        alt={request.profile.displayName}
                      />
                    ) : null}
                    <AvatarFallback style={avatarTone(request.otherUserId)}>
                      {initials(request.profile.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <Link to={`/profile/${request.otherUserId}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {request.profile.displayName}
                    </span>
                    <span className="block text-[12px] text-muted-foreground">
                      Waiting since {timeAgo(request.createdAt)}
                    </span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={workingId === request.requestId}
                    onClick={() => cancel(request)}
                  >
                    Cancel request
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
