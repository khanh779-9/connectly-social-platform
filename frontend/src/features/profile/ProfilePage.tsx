import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BellOff,
  Briefcase,
  Cake,
  CalendarDays,
  Globe,
  Home,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  UserMinus,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import SafeImage from '@/components/ui/safe-image';
import SafeVideo from '@/components/ui/safe-video';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PostCard from '@/features/social/PostCard';
import HighlightsBar from '@/features/stories/HighlightsBar';
import StoryViewer from '@/features/stories/StoryViewer';
import { useAppSelector } from '@/store/hooks';
import { avatarTone } from '@/lib/avatar';
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  createDirectConversation,
  fetchFollowers,
  fetchFollowing,
  fetchFriends,
  fetchMyProfile,
  fetchProfileById,
  fetchPrivacySettings,
  fetchProfileReels,
  fetchReceivedFriendRequests,
  fetchRelationship,
  fetchSentFriendRequests,
  fetchUserPosts,
  followUser,
  getErrorMessage,
  initials,
  muteUser,
  primeProfile,
  removeBookmark,
  removeFriend,
  removeReaction,
  removeStoryFromHighlight,
  saveBookmark,
  sendFriendRequest,
  setProfileAvatar,
  setProfileCover,
  setReaction,
  unblockUser,
  unfollowUser,
  unmuteUser,
  updateMyProfile,
  uploadMedia,
} from '@/lib/social';
import { viewerReactionFrom } from '@/lib/social';
import type {
  HighlightDto,
  PostDto,
  PrivacySettingsDto,
  ProfileAudience,
  ProfileDto,
  RelationshipDto,
  ReelDto,
  StoryDto,
} from '@/types/api';

type Tab = 'posts' | 'reels' | 'photos' | 'about' | 'friends' | 'followers' | 'following';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "1995-04-12" -> "12 April 1995" (the API always sends yyyy-MM-dd). */
function formatBirthday(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Membership month, e.g. "November 2026". */
function formatJoined(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Plain wording for an audience value set in Settings → Privacy. */
function audienceLabel(audience: ProfileAudience): string {
  if (audience === 'only_me') return 'Only you';
  if (audience === 'friends') return 'Friends';
  if (audience === 'friends_of_friends') return 'Friends of friends';
  return 'Everyone';
}

/** "Who can see this" marker, shown only to the owner: the server drops hidden
 *  fields for every other viewer, so there is nothing to mark on their side. */
function AudienceChip({ audience }: { audience?: ProfileAudience }) {
  if (!audience || audience === 'everyone') return null;
  return (
    <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-secondary px-1.5 py-0.5 align-middle text-[12px] leading-none text-muted-foreground">
      {audienceLabel(audience)}
    </span>
  );
}

/** One labelled row of the About tab. */
function AboutRow({
  icon: Icon,
  label,
  audience,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  audience?: ProfileAudience;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[12px] text-muted-foreground">{label}</p>
        <div className="break-words text-sm text-foreground">
          {children}
          <AudienceChip audience={audience} />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const myId = useAppSelector((state) => state.auth.userId);
  const navigate = useNavigate();

  const profileUserId = routeUserId ?? myId;
  const isMe = Boolean(myId) && profileUserId === myId;

  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [relationship, setRelationship] = useState<RelationshipDto | null>(null);
  const [tab, setTab] = useState<Tab>('posts');

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const [posts, setPosts] = useState<PostDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [postsStatus, setPostsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [postsError, setPostsError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string | null>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const [people, setPeople] = useState<ProfileDto[]>([]);
  const [peopleStatus, setPeopleStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [peopleError, setPeopleError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftUsername, setDraftUsername] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [draftWebsite, setDraftWebsite] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftBirthday, setDraftBirthday] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftHometown, setDraftHometown] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);

  // highlights
  const [highlightStories, setHighlightStories] = useState<{
    highlight: HighlightDto;
    stories: StoryDto[];
  } | null>(null);

  // ---------- profile ----------
  async function load() {
    if (!profileUserId) return;
    setStatus('loading');
    setError(null);
    try {
      const me = isMe ? await fetchMyProfile() : await fetchProfileById(profileUserId);
      setProfile(me);
      setDraftName(me.displayName ?? '');
      setDraftUsername(me.username ?? '');
      setDraftBio(me.bio ?? '');
      setDraftWebsite(me.website ?? '');
      setDraftLocation(me.locationText ?? '');
      setDraftEmail(me.contactEmail ?? '');
      setDraftBirthday(me.dateOfBirth ?? '');
      setDraftPhone(me.phoneNumber ?? '');
      setDraftCity(me.city ?? '');
      setDraftHometown(me.hometown ?? '');
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, [profileUserId, myId]);

  // ---------- relationship ----------
  const [requestId, setRequestId] = useState<string | null>(null);

  async function loadRelationship() {
    if (!profileUserId || isMe) return;
    try {
      setRelationship(await fetchRelationship(profileUserId));
    } catch {
      setRelationship(null);
    }
    try {
      const [incoming, outgoing] = await Promise.all([
        fetchReceivedFriendRequests(),
        fetchSentFriendRequests(),
      ]);
      const match =
        incoming.find((request) => request.otherUserId === profileUserId) ??
        outgoing.find((request) => request.otherUserId === profileUserId);
      setRequestId(match?.requestId ?? null);
    } catch {
      setRequestId(null);
    }
  }

  useEffect(() => {
    loadRelationship();
  }, [profileUserId, myId]);

  // ---------- posts ----------
  async function loadPosts(cursor?: string) {
    if (!profileUserId) return;
    setPostsStatus('loading');
    setPostsError(null);
    try {
      const page = await fetchUserPosts(profileUserId, cursor, 15);
      setPosts((prev) =>
        cursor
          ? [...prev, ...page.items.filter((p) => !prev.some((x) => x.id === p.id))]
          : page.items,
      );
      setReactions((prev) => {
        const next = { ...prev };
        page.items.forEach((post) => {
          if (post.viewerReaction) next[post.id] = post.viewerReaction;
        });
        return next;
      });
      setSavedIds((prev) => {
        const next = new Set(prev);
        page.items.forEach((post) => {
          if (post.viewerBookmarked) next.add(post.id);
        });
        return next;
      });
      setNextCursor(page.nextCursor ?? null);
      setPostsStatus('ready');
    } catch (err) {
      setPostsError(getErrorMessage(err));
      setPostsStatus('error');
    }
  }

  useEffect(() => {
    if (!profileUserId) return;
    setPosts([]);
    setNextCursor(undefined);
    loadPosts();
  }, [profileUserId]);

  // ---------- reels ----------
  const [reels, setReels] = useState<ReelDto[]>([]);
  const [reelsStatus, setReelsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reelsError, setReelsError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== 'reels' || !profileUserId) return;
    let cancelled = false;
    setReelsStatus('loading');
    setReelsError(null);
    fetchProfileReels(profileUserId)
      .then((page) => {
        if (cancelled) return;
        setReels(page.items);
        setReelsStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setReelsError(getErrorMessage(err));
        setReelsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [tab, profileUserId]);

  // ---------- privacy of each field (owner only) ----------
  const [privacy, setPrivacy] = useState<PrivacySettingsDto | null>(null);

  useEffect(() => {
    if (!isMe) {
      setPrivacy(null);
      return;
    }
    let cancelled = false;
    fetchPrivacySettings()
      .then((settings) => {
        if (!cancelled) setPrivacy(settings);
      })
      .catch(() => {
        if (!cancelled) setPrivacy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isMe]);

  // ---------- people tabs ----------
  useEffect(() => {
    // Only the three people tabs fetch the people list.
    if (tab !== 'friends' && tab !== 'followers' && tab !== 'following') return;
    if (!profileUserId) return;
    let cancelled = false;
    setPeopleStatus('loading');
    setPeopleError(null);

    let loader: Promise<ProfileDto[]>;
    if (tab === 'friends') loader = fetchFriends(profileUserId);
    else if (tab === 'followers') loader = fetchFollowers(profileUserId);
    else loader = fetchFollowing(profileUserId);

    loader
      .then((list) => {
        if (!cancelled) {
          setPeople(list);
          setPeopleStatus('ready');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPeople([]);
          // A 403 here is the owner's list-privacy setting, not a broken page;
          // the server's sentence explains which list is closed to this viewer.
          setPeopleError(getErrorMessage(err));
          setPeopleStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab, profileUserId]);

  // ---------- actions ----------
  async function handleReact(post: PostDto, type: string | null) {
    const previous = viewerReactionFrom(reactions, post);
    if (previous === type) return;

    // Change the reaction right away, the server answer comes later.
    setReactions((prev) => {
      const next = { ...prev };
      next[post.id] = type;
      return next;
    });

    try {
      if (type) await setReaction(post.id, type);
      else await removeReaction(post.id);
    } catch {
      // The server refused the change, so we put the old reaction back.
      setReactions((prev) => {
        const next = { ...prev };
        next[post.id] = previous;
        return next;
      });
    }
  }

  async function handleToggleBookmark(post: PostDto, saved: boolean) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) next.delete(post.id);
      else next.add(post.id);
      return next;
    });
    try {
      if (saved) await removeBookmark(post.id);
      else await saveBookmark(post.id);
    } catch {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (saved) next.add(post.id);
        else next.delete(post.id);
        return next;
      });
    }
  }

  async function runAction(action: () => Promise<unknown>) {
    setBusyAction(true);
    setActionError(null);
    try {
      await action();
      await loadRelationship();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setBusyAction(false);
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    setActionError(null);
    try {
      const updated = await updateMyProfile({
        displayName: draftName.trim(),
        username: draftUsername.trim(),
        bio: draftBio.trim(),
        website: draftWebsite.trim(),
        locationText: draftLocation.trim(),
        contactEmail: draftEmail.trim(),
        dateOfBirth: draftBirthday.trim(),
        phoneNumber: draftPhone.trim(),
        city: draftCity.trim(),
        hometown: draftHometown.trim(),
      });
      setProfile(updated);
      primeProfile(updated);
      setEditing(false);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarChange(file: File) {
    setUploading('avatar');
    setActionError(null);
    try {
      const mediaId = await uploadMedia(file, 'avatar');
      const updated = await setProfileAvatar(mediaId);
      setProfile(updated);
      primeProfile(updated);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUploading(null);
    }
  }

  async function handleCoverChange(file: File) {
    setUploading('cover');
    setActionError(null);
    try {
      const mediaId = await uploadMedia(file, 'cover');
      const updated = await setProfileCover(mediaId);
      setProfile(updated);
      primeProfile(updated);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUploading(null);
    }
  }

  async function handleMessage() {
    if (!profileUserId) return;
    try {
      const conversation = await createDirectConversation(profileUserId);
      navigate('/messages', { state: { conversationId: conversation.id } });
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (status === 'error' || !profile) {
    return (
      <Card className="rounded border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Could not load this profile</p>
        <p className="mt-1">{error}</p>
      </Card>
    );
  }

  // One album per source, so a photo is never shown without saying where it
  // came from. Everything here is real profile data: no extra endpoints.
  const photoGroups: {
    key: string;
    title: string;
    items: { id: string; url: string; alt: string }[];
    emptyText?: string;
  }[] = [
    {
      key: 'posts',
      title: 'Photos from posts',
      items: posts.flatMap((post) =>
        post.media
          .filter((media) => media.contentType.startsWith('image/'))
          .map((media) => ({ id: media.id, url: media.url, alt: 'Photo from a post' })),
      ),
      emptyText: isMe ? 'You have not posted any photos yet.' : 'No photos in posts yet.',
    },
    {
      key: 'avatar',
      title: 'Profile pictures',
      items: profile.avatarUrl
        ? [{ id: 'avatar', url: profile.avatarUrl, alt: 'Profile picture' }]
        : [],
    },
    {
      key: 'cover',
      title: 'Cover photos',
      items: profile.coverUrl ? [{ id: 'cover', url: profile.coverUrl, alt: 'Cover photo' }] : [],
    },
  ];
  const photoCount = photoGroups.reduce((total, group) => total + group.items.length, 0);

  const tabs: { key: Tab; label: string; count: number | null }[] = [
    { key: 'posts', label: 'Posts', count: posts.length || null },
    { key: 'reels', label: 'Reels', count: reels.length || null },
    { key: 'photos', label: 'Photos', count: photoCount || null },
    { key: 'about', label: 'About', count: null },
    { key: 'friends', label: 'Friends', count: relationship?.friendCount ?? null },
    { key: 'followers', label: 'Followers', count: relationship?.followerCount ?? null },
    { key: 'following', label: 'Following', count: relationship?.followingCount ?? null },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Identity */}
      <Card className="overflow-hidden rounded border border-border bg-card">
        <div className="h-36 bg-secondary sm:h-44">
          {profile.coverUrl && (
            <SafeImage
              src={profile.coverUrl}
              alt=""
              className="h-full w-full object-cover"
              fallbackLabel="Cover unavailable"
              decoding="async"
            />
          )}
        </div>

        <div className="px-5 pb-5">
          <div className="flex items-end justify-between gap-3">
            <div className="relative -mt-10">
              <Avatar className="h-20 w-20 border-4 border-card">
                {profile.avatarUrl ? (
                  <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                ) : null}
                <AvatarFallback
                  className="text-xl font-semibold"
                  style={avatarTone(profile.userId)}
                >
                  {initials(profile.displayName)}
                </AvatarFallback>
              </Avatar>
              {isMe && (
                <>
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleAvatarChange(file);
                      event.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInput.current?.click()}
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary"
                    aria-label="Change profile photo"
                  >
                    {uploading === 'avatar' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Pencil className="h-3.5 w-3.5" />
                    )}
                  </button>
                </>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              {isMe ? (
                <>
                  <input
                    ref={coverInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleCoverChange(file);
                      event.target.value = '';
                    }}
                  />
                  <Button variant="ghost" onClick={() => coverInput.current?.click()}>
                    {uploading === 'cover' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Change cover
                  </Button>
                  <Button variant="primary" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" />
                    Edit profile
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant={relationship?.isFollowing ? 'ghost' : 'primary'}
                    disabled={busyAction || relationship?.isBlocked}
                    onClick={() =>
                      runAction(() =>
                        relationship?.isFollowing
                          ? unfollowUser(profile.userId)
                          : followUser(profile.userId),
                      )
                    }
                  >
                    {relationship?.isFollowing ? 'Following' : 'Follow'}
                  </Button>

                  {relationship?.isFriend ? (
                    <Button variant="ghost" disabled={busyAction} onClick={() => setTab('friends')}>
                      Friends
                    </Button>
                  ) : relationship?.hasIncomingRequest ? (
                    <Button
                      variant="primary"
                      disabled={busyAction || !requestId}
                      onClick={() =>
                        runAction(() =>
                          requestId ? acceptFriendRequest(requestId) : Promise.resolve(),
                        )
                      }
                    >
                      Accept request
                    </Button>
                  ) : relationship?.hasOutgoingRequest ? (
                    <Button
                      variant="ghost"
                      disabled={busyAction || !requestId}
                      onClick={() =>
                        runAction(() =>
                          requestId ? cancelFriendRequest(requestId) : Promise.resolve(),
                        )
                      }
                    >
                      Request sent
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      disabled={busyAction}
                      onClick={() => runAction(() => sendFriendRequest(profile.userId))}
                    >
                      <UserPlus className="h-4 w-4" />
                      Add friend
                    </Button>
                  )}

                  <Button variant="ghost" disabled={busyAction} onClick={handleMessage}>
                    <MessageCircle className="h-4 w-4" />
                    Message
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="More actions">
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {relationship?.isFriend && (
                        <DropdownMenuItem
                          onSelect={() => runAction(() => removeFriend(profile.userId))}
                        >
                          <UserMinus className="h-4 w-4 text-muted-foreground" />
                          Remove friend
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={() =>
                          runAction(() =>
                            relationship?.isMuted
                              ? unmuteUser(profile.userId)
                              : muteUser(profile.userId),
                          )
                        }
                      >
                        <BellOff className="h-4 w-4 text-muted-foreground" />
                        {relationship?.isMuted ? 'Unmute' : 'Mute'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive-soft focus:text-destructive"
                        onSelect={() =>
                          runAction(() =>
                            relationship?.isBlocked
                              ? unblockUser(profile.userId)
                              : blockUser(profile.userId),
                          )
                        }
                      >
                        <UserX className="h-4 w-4" />
                        {relationship?.isBlocked ? 'Unblock' : 'Block'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
              {profile.displayName}
            </h1>
            {profile.username && (
              <p className="text-[13px] text-muted-foreground">@{profile.username}</p>
            )}
            {profile.bio && (
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {profile.bio}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[12px] text-muted-foreground">
              {profile.locationText && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {profile.locationText}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-accent hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {profile.website}
                </a>
              )}
              {profile.city && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  Lives in {profile.city}
                </span>
              )}
              {profile.hometown && (
                <span className="flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" />
                  From {profile.hometown}
                </span>
              )}
              {profile.contactEmail && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {profile.contactEmail}
                </span>
              )}
              {profile.phoneNumber && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {profile.phoneNumber}
                </span>
              )}
              {profile.dateOfBirth && (
                <span className="flex items-center gap-1">
                  <Cake className="h-3.5 w-3.5" />
                  {formatBirthday(profile.dateOfBirth)}
                </span>
              )}
              {profile.joinedAt && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Joined {formatJoined(profile.joinedAt)}
                </span>
              )}
            </div>
          </div>

          {actionError && (
            <p className="mt-3 text-[12px] text-destructive">{actionError}</p>
          )}
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 border-t border-border px-3">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={
                tab === item.key
                  ? 'border-b-2 border-accent px-3 py-2.5 text-sm font-medium text-foreground'
                  : 'border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
              }
            >
              {item.label}
              {item.count !== null && (
                <span className="ml-1.5 text-[12px] text-muted-foreground tnum">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </Card>

      {/* Highlights */}
      {profileUserId && (
        <HighlightsBar
          ownerUserId={profileUserId}
          isMe={isMe}
          onOpenHighlight={(highlight, stories) => setHighlightStories({ highlight, stories })}
        />
      )}

      {/* Edit profile */}
      {editing && (
        <Card className="rounded border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-foreground">Edit profile</h2>
            <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block text-[13px] font-medium text-foreground">Name</span>
              <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[13px] font-medium text-foreground">Username</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  @
                </span>
                <Input
                  value={draftUsername}
                  onChange={(e) => setDraftUsername(e.target.value)}
                  placeholder="yourhandle"
                  maxLength={30}
                  className="pl-7"
                />
              </div>
              <span className="mt-1 block text-[12px] text-muted-foreground">
                Letters, digits and underscore. Used to tag you with @mentions.
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[13px] font-medium text-foreground">
                Location
              </span>
              <Input
                value={draftLocation}
                onChange={(e) => setDraftLocation(e.target.value)}
                placeholder="Where you are"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1.5 block text-[13px] font-medium text-foreground">Bio</span>
              <textarea
                value={draftBio}
                onChange={(e) => setDraftBio(e.target.value)}
                rows={3}
                placeholder="A line about you"
                className="w-full resize-y rounded border border-input bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1.5 block text-[13px] font-medium text-foreground">Website</span>
              <Input
                value={draftWebsite}
                onChange={(e) => setDraftWebsite(e.target.value)}
                placeholder="https://"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[13px] font-medium text-foreground">
                Contact email
              </span>
              <Input
                type="email"
                value={draftEmail}
                onChange={(e) => setDraftEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[13px] font-medium text-foreground">
                Phone number
              </span>
              <Input
                value={draftPhone}
                onChange={(e) => setDraftPhone(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[13px] font-medium text-foreground">
                Date of birth
              </span>
              <Input
                type="date"
                value={draftBirthday}
                onChange={(e) => setDraftBirthday(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[13px] font-medium text-foreground">City</span>
              <Input
                value={draftCity}
                onChange={(e) => setDraftCity(e.target.value)}
                placeholder="Where you live"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[13px] font-medium text-foreground">
                Hometown
              </span>
              <Input
                value={draftHometown}
                onChange={(e) => setDraftHometown(e.target.value)}
                placeholder="Where you are from"
              />
            </label>
          </div>

