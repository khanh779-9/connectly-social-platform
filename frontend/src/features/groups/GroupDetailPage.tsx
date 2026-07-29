import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Lock, Send, Trash2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import PostCard from '@/features/social/PostCard';
import { useAppSelector } from '@/store/hooks';
import { avatarTone } from '@/lib/avatar';
import {
  approveGroupMember,
  createPost,
  declineGroupMember,
  ensureProfiles,
  fetchGroup,
  fetchGroupMembers,
  fetchGroupPosts,
  getErrorMessage,
  initials,
  joinGroup,
  leaveGroup,
  removeGroupMember,
  removeReaction,
  setReaction,
  timeAgo,
} from '@/lib/social';
import { viewerReactionFrom } from '@/lib/social';
import type { GroupDto, GroupMemberDto, PostDto, ProfileDto } from '@/types/api';

type Tab = 'posts' | 'members' | 'requests';

export default function GroupDetailPage() {
  const { groupId = '' } = useParams<{ groupId: string }>();
  const meId = useAppSelector((state) => state.auth.userId);

  const [group, setGroup] = useState<GroupDto | null>(null);
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [members, setMembers] = useState<GroupMemberDto[]>([]);
  const [pending, setPending] = useState<GroupMemberDto[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileDto | null>>({});
  const [tab, setTab] = useState<Tab>('posts');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [reactions, setReactions] = useState<Record<string, string | null>>({});

  const isMember = group?.viewerStatus === 'active';
  const isAdmin = ['owner', 'admin', 'moderator'].includes(group?.viewerRole ?? '');

  async function load() {
    if (!groupId) return;
    setStatus('loading');
    setError(null);
    try {
      const info = await fetchGroup(groupId);
      setGroup(info);
      const postPage = await fetchGroupPosts(groupId, undefined, 20);
      setPosts(postPage.items);
      const resolved = await ensureProfiles(postPage.items.map((post) => post.authorUserId));
      setProfiles((prev) => ({ ...prev, ...resolved }));
      if (info.viewerStatus === 'active' || info.visibility === 'Public') {
        const roster = await fetchGroupMembers(groupId, 'active');
        setMembers(roster);
        const memberProfiles = await ensureProfiles(roster.map((member) => member.userId));
        setProfiles((prev) => ({ ...prev, ...memberProfiles }));
        if (['owner', 'admin', 'moderator'].includes(info.viewerRole ?? '')) {
          const requests = await fetchGroupMembers(groupId, 'pending');
          setPending(requests);
          const requestProfiles = await ensureProfiles(requests.map((member) => member.userId));
          setProfiles((prev) => ({ ...prev, ...requestProfiles }));
        }
      }
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, [groupId]);

  async function toggleJoin() {
    if (!group || working) return;
    setWorking(true);
    try {
      if (group.viewerStatus === 'active') {
        await leaveGroup(group.id);
        setGroup({ ...group, viewerStatus: null, viewerRole: null, memberCount: Math.max(0, group.memberCount - 1) });
        setMembers((prev) => prev.filter((member) => member.userId !== meId));
      } else {
        const updated = await joinGroup(group.id);
        setGroup(updated);
        if (updated.viewerStatus === 'active') {
          const roster = await fetchGroupMembers(group.id, 'active');
          setMembers(roster);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  async function submitPost(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !group || posting) return;
    setPosting(true);
    try {
      const created = await createPost(content, [], 0, group.id);
      setPosts((prev) => [created, ...prev]);
      setDraft('');
      const resolved = await ensureProfiles([created.authorUserId]);
      setProfiles((prev) => ({ ...prev, ...resolved }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPosting(false);
    }
  }

  async function handleReact(post: PostDto, type: string | null) {
    const previous = viewerReactionFrom(reactions, post);
    if (previous === type) return;
    setReactions((prev) => {
      const next = { ...prev };
      if (type) next[post.id] = type;
      else next[post.id] = null;
      return next;
    });
    try {
      if (type) await setReaction(post.id, type);
      else await removeReaction(post.id);
    } catch {
      setReactions((prev) => {
        const next = { ...prev };
        if (previous) next[post.id] = previous;
        else next[post.id] = null;
        return next;
      });
    }
  }

  async function decide(member: GroupMemberDto, approve: boolean) {
    if (!group) return;
    setWorking(true);
    try {
      if (approve) {
        await approveGroupMember(group.id, member.userId);
        setPending((prev) => prev.filter((item) => item.userId !== member.userId));
        setMembers((prev) => [...prev, { ...member, status: 'active' }]);
        setGroup({ ...group, memberCount: group.memberCount + 1 });
      } else {
        await declineGroupMember(group.id, member.userId);
        setPending((prev) => prev.filter((item) => item.userId !== member.userId));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  async function removeMember(member: GroupMemberDto) {
    if (!group) return;
    setWorking(true);
    try {
      await removeGroupMember(group.id, member.userId);
      setMembers((prev) => prev.filter((item) => item.userId !== member.userId));
      setGroup({ ...group, memberCount: Math.max(0, group.memberCount - 1) });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (status === 'error' || !group) {
    return (
      <Card className="rounded border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Could not load this group</p>
        <p className="mt-1">{error}</p>
        <Button variant="ghost" className="mt-4" onClick={load}>
          Try again
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto space-y-4">
      <Link
        to="/groups"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All groups
      </Link>

      <Card className="overflow-hidden rounded border border-border bg-card">
        <div className="h-24 bg-secondary" />
        <div className="px-4 pb-4">
          <span
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-md border-2 border-card bg-accent text-base font-semibold text-white"
            style={avatarTone(group.id)}
          >
            {group.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-semibold leading-tight text-foreground">
                {group.name}
              </h1>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                <span className="tnum">{group.memberCount}</span> members ·{' '}
                {group.visibility === 'Private' ? 'Private group' : 'Public group'}
                {group.visibility === 'Private' && <Lock className="ml-1 inline h-3 w-3" />}
              </p>
            </div>
            {group.viewerStatus !== 'active' && (
              <Button variant="primary" size="sm" disabled={working} onClick={toggleJoin}>
                {group.viewerStatus === 'pending' ? 'Request sent' : 'Join group'}
              </Button>
            )}
            {group.viewerStatus === 'active' && (
              <Button variant="ghost" size="sm" disabled={working} onClick={toggleJoin}>
                Leave
              </Button>
            )}
          </div>
          {group.description && (
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
              {group.description}
            </p>
          )}
        </div>
      </Card>

      <nav className="flex gap-1 border-b border-border">
        <TabButton active={tab === 'posts'} label="Posts" count={posts.length} onClick={() => setTab('posts')} />
        <TabButton
          active={tab === 'members'}
          label="Members"
          count={members.length}
          onClick={() => setTab('members')}
        />
        {isAdmin && (
          <TabButton
            active={tab === 'requests'}
            label="Requests"
            count={pending.length}
            onClick={() => setTab('requests')}
          />
        )}
      </nav>

