import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AtSign,
  Bell,
  CheckCheck,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  UsersRound,
  Vote,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NotificationApiDto, ProfileDto } from '@/types/api';

interface NotificationIconSpec {
  icon: LucideIcon;
  label: string;
}

const ICON_BY_TYPE: Record<string, NotificationIconSpec> = {
  friend_request: { icon: UserPlus, label: 'Friend request' },
  friend_accepted: { icon: UserCheck, label: 'Friend request accepted' },
  followed: { icon: UserPlus, label: 'New follower' },
  comment: { icon: MessageCircle, label: 'Comment' },
  reaction: { icon: Heart, label: 'Reaction' },
  shared: { icon: Share2, label: 'Post shared' },
  group_request: { icon: UserPlus, label: 'Group join request' },
  group_member: { icon: UsersRound, label: 'New group member' },
  poll_vote: { icon: Vote, label: 'Poll vote' },
  story_view: { icon: Eye, label: 'Story view' },
  mention: { icon: AtSign, label: 'Mention' },
  welcome: { icon: Sparkles, label: 'Welcome' },
  new_signin: { icon: ShieldCheck, label: 'New sign-in' },
};

function iconSpecFor(type: string): NotificationIconSpec {
  const normalized = type.trim().toLowerCase();
  if (ICON_BY_TYPE[normalized]) return ICON_BY_TYPE[normalized];

  // Older or custom events still get the closest recognisable symbol.
  if (normalized.includes('group')) return ICON_BY_TYPE.group_member;
  if (normalized.includes('friend')) return ICON_BY_TYPE.friend_request;
  if (normalized.includes('follow')) return ICON_BY_TYPE.followed;
  if (normalized.includes('comment') || normalized.includes('reply')) {
    return ICON_BY_TYPE.comment;
  }
  if (normalized.includes('react') || normalized.includes('like')) {
    return ICON_BY_TYPE.reaction;
  }
  if (normalized.includes('share')) return ICON_BY_TYPE.shared;
  if (normalized.includes('mention') || normalized.includes('tag')) {
    return ICON_BY_TYPE.mention;
  }
  if (normalized.includes('signin') || normalized.includes('security')) {
    return ICON_BY_TYPE.new_signin;
  }
  if (normalized.includes('welcome')) return ICON_BY_TYPE.welcome;

  return { icon: Bell, label: 'Notification' };
}

/** The event's own visual marker; the sentence beside it carries the meaning. */
export function NotificationTypeIcon({
  type,
  size = 'md',
}: {
  type: string;
  size?: 'sm' | 'md';
}) {
  const { icon: Icon, label } = iconSpecFor(type);

  return (
    <span
      aria-hidden="true"
      title={label}
      data-notification-type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
      )}
    >
      <Icon
        className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'}
        strokeWidth={2.2}
      />
    </span>
  );
}

function cleanPreview(preview: string | null | undefined, maxLength = 160): string {
  const value = preview?.replace(/\s+/g, ' ').trim() ?? '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}…`;
}

function groupNameFromPreview(preview: string | null | undefined): string {
  const value = cleanPreview(preview, 100);
  return value.replace(/^wants to join\s+/i, '').replace(/^joined\s+/i, '') || 'your group';
}

function legacySignInDetails(preview: string | null | undefined): {
  deviceLabel?: string;
  location?: string;
} {
  const value = preview?.trim() ?? '';
  const match = value.match(/^New sign-in from\s+(.+?)(?:\s+·\s+(.+))?$/i);
  if (!match) return {};
  return {
    deviceLabel: match[1]?.trim() || undefined,
    location: match[2]?.trim() || undefined,
  };
}

function actorNode(
  actor: ProfileDto | null | undefined,
  linkActor: boolean,
): ReactNode | null {
  const name = actor?.displayName?.trim();
  if (!actor || !name) return null;

  if (linkActor) {
    return (
      <Link
        to={`/profile/${actor.userId}`}
        className="font-semibold text-foreground hover:underline"
      >
        {name}
      </Link>
    );
  }

  return <span className="font-semibold text-foreground">{name}</span>;
}

function reactionPhrase(reaction: string): ReactNode {
  switch (reaction.trim().toLowerCase()) {
    case 'like':
      return <>liked your post.</>;
    case 'love':
      return <>loved your post.</>;
    case 'care':
      return <>sent you care on your post.</>;
    case 'haha':
      return <>laughed at your post.</>;
    case 'wow':
      return <>was amazed by your post.</>;
    case 'sad':
      return <>was sad about your post.</>;
    case 'angry':
      return <>was angry about your post.</>;
    default:
      return <>reacted to your post.</>;
  }
}

function naturalCopy(
  notification: NotificationApiDto,
  actor: ProfileDto | null | undefined,
  linkActor: boolean,
): ReactNode {
  const name = actorNode(actor, linkActor);
  const preview = cleanPreview(notification.preview);

  switch (notification.type.trim().toLowerCase()) {
    case 'friend_request':
      return name ? (
        <>{name} sent you a friend request.</>
      ) : (
        <>You have a new friend request.</>
      );
    case 'friend_accepted':
      return name ? (
        <>{name} accepted your friend request.</>
      ) : (
        <>Your friend request was accepted.</>
      );
    case 'followed':
      return name ? (
        <>{name} started following you.</>
      ) : (
        <>Someone started following you.</>
      );
    case 'comment':
      return name ? (
        <>
          {name} commented: <span className="text-foreground">“{preview}”</span>
        </>
      ) : preview ? (
        <>
          Someone commented: <span className="text-foreground">“{preview}”</span>
        </>
      ) : (
        <>Someone commented on your post.</>
      );
    case 'reaction':
      return name ? (
        <>{name} {reactionPhrase(notification.preview ?? '')}</>
      ) : (
        <>Your post received a new reaction.</>
      );
    case 'shared':
      return name ? (
        <>{name} shared your post.</>
      ) : (
        <>Your post was shared.</>
      );
    case 'group_request': {
      const group = groupNameFromPreview(notification.preview);
      return name ? (
        <>{name} wants to join {group}.</>
      ) : (
        <>Someone wants to join {group}.</>
      );
    }
    case 'group_member': {
      const group = groupNameFromPreview(notification.preview);
      return name ? (
        <>{name} joined {group}.</>
      ) : (
        <>Someone joined {group}.</>
      );
    }
    case 'poll_vote':
      return name ? (
        <>{name} voted in your poll.</>
      ) : (
        <>Someone voted in your poll.</>
      );
    case 'story_view':
      return name ? (
        <>{name} watched your story.</>
      ) : (
        <>Someone watched your story.</>
      );
    case 'mention':
      return name ? (
        <>
          {name} mentioned you: <span className="text-foreground">“{preview}”</span>
        </>
      ) : preview ? (
        <>
          You were mentioned: <span className="text-foreground">“{preview}”</span>
        </>
      ) : (
        <>You were mentioned.</>
      );
    case 'welcome':
      return (
        <>
          Welcome to Connectly. Add a photo and a short bio so people can find you.
        </>
      );
    case 'new_signin': {
      const legacy = legacySignInDetails(notification.preview);
      const device = notification.deviceLabel?.trim() || legacy.deviceLabel;
      return device ? (
        <>
          New sign-in from <span className="font-semibold text-foreground">{device}</span>.
        </>
      ) : (
        <>A new sign-in was detected.</>
      );
    }
    default:
      return preview ? <>{preview}</> : <>You have a new notification.</>;
  }
}

/** IP and location are useful details, not a second headline. */
function SignInDetails({ notification }: { notification: NotificationApiDto }) {
  if (notification.type.trim().toLowerCase() !== 'new_signin') return null;

  const legacy = legacySignInDetails(notification.preview);
  const ip = notification.ipAddress?.trim() || null;
  const location = notification.location?.trim() || legacy.location || null;
  if (!ip && !location) return null;

  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
      {ip && (
        <span>
          IP <strong className="font-semibold text-foreground">{ip}</strong>
        </span>
      )}
      {ip && location && <span aria-hidden="true">·</span>}
      {location && (
        <span>
          Location{' '}
          <strong className="font-semibold text-foreground">{location}</strong>
        </span>
      )}
    </span>
  );
}

export function NotificationContent({
  notification,
  actor,
  linkActor = false,
  compact = false,
}: {
  notification: NotificationApiDto;
  actor?: ProfileDto | null;
  linkActor?: boolean;
  compact?: boolean;
}) {
  return (
    <span className="block min-w-0">
      <span
        className={cn(
          'block text-foreground',
          compact ? 'text-[13px] leading-5' : 'text-sm leading-5',
        )}
      >
        {naturalCopy(notification, actor, linkActor)}
      </span>
      <SignInDetails notification={notification} />
    </span>
  );
}
