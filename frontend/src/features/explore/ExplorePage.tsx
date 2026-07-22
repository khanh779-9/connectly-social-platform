import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search as SearchIcon, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import SafeImage from '@/components/ui/safe-image';
import { useAppSelector } from '@/store/hooks';
import { avatarTone } from '@/lib/avatar';
import {
  ensureProfiles,
  fetchFriends,
  fetchHomeFeed,
  getErrorMessage,
  initials,
  searchAll,
  sendFriendRequest,
  timeAgo,
} from '@/lib/social';
import type { PostDto, ProfileDto } from '@/types/api';

export default function ExplorePage() {
  const myId = useAppSelector((state) => state.auth.userId);
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [authors, setAuthors] = useState<Record<string, ProfileDto | null>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ users: ProfileDto[]; posts: PostDto[] } | null>(null);
  const [suggested, setSuggested] = useState<ProfileDto[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  async function load() {
    setStatus('loading');
    setError(null);
    try {
      // The discovery grid is built from a few pages of the public feed.
      const collected: PostDto[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 3; page += 1) {
        const result = await fetchHomeFeed(cursor, 15);
        collected.push(...result.items.map((item) => item.post));
        cursor = result.nextCursor ?? undefined;
        if (!cursor) break;
      }
      const deduped = collected.filter(
        (post, index) => collected.findIndex((p) => p.id === post.id) === index,
      );
      setPosts(deduped);
      const resolved = await ensureProfiles(deduped.map((post) => post.authorUserId));
      setAuthors((prev) => ({ ...prev, ...resolved }));
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  // People you may know: friends-of-friends, minus me and existing friends.
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    (async () => {
      try {
        const myFriends = await fetchFriends(myId);
        const friendIds = myFriends.map((f) => f.userId);
        const nearby = await Promise.all(
          friendIds.slice(0, 4).map((friendId) => fetchFriends(friendId).catch(() => [] as ProfileDto[])),
        );
        const flattened = nearby.flat();
        const known = new Set([myId, ...friendIds]);
        const candidates: ProfileDto[] = [];
        const seen = new Set<string>();
        for (const candidate of flattened) {
          if (known.has(candidate.userId) || seen.has(candidate.userId)) continue;
          seen.add(candidate.userId);
          candidates.push(candidate);
          if (candidates.length >= 6) break;
        }
        if (!cancelled) setSuggested(candidates);
      } catch {
        if (!cancelled) setSuggested([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myId]);

  // Server-side search, debounced.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchAll(term, 8)
        .then((data) => {
          if (!cancelled) setResults({ users: data.users ?? [], posts: data.posts ?? [] });
        })
        .catch(() => {
          if (!cancelled) setResults(null);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  async function handleAdd(person: ProfileDto) {
    try {
      await sendFriendRequest(person.userId);
      setRequested((prev) => new Set(prev).add(person.userId));
    } catch {
      // the server error is surfaced by the notifications service
    }
  }

  const mediaPosts = posts.filter((post) => post.media.length > 0);
  const isSearching = query.trim().length >= 2;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
          Explore
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Search people and posts, or browse what is circulating.
        </p>
      </header>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people and posts"
          aria-label="Search people and posts"
          className="h-10 w-full rounded border border-input bg-card pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search results */}
      {isSearching && results && (
        <Card className="rounded border border-border bg-card">
          <header className="border-b border-border px-5 py-3">
            <h2 className="text-[15px] font-semibold text-foreground">
              {results.users.length + results.posts.length} result
              {results.users.length + results.posts.length === 1 ? '' : 's'} for “{query.trim()}”
            </h2>
          </header>

          {results.users.length > 0 && (
            <ul className="divide-y divide-border border-b border-border">
              {results.users.map((person) => (
                <li key={person.userId} className="flex items-center gap-3 px-5 py-3">
                  <Avatar className="h-9 w-9">
                    {person.avatarUrl ? (
                      <AvatarImage src={person.avatarUrl} alt={person.displayName} />
                    ) : null}
                    <AvatarFallback style={avatarTone(person.userId)}>
                      {initials(person.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <Link to={`/profile/${person.userId}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {person.displayName}
                    </span>
                    {person.bio && (
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {person.bio}
                      </span>
                    )}
                  </Link>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={requested.has(person.userId)}
                    onClick={() => handleAdd(person)}
                  >
                    {requested.has(person.userId) ? (
                      'Requested'
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Add
                      </>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {results.posts.length > 0 && (
            <ul className="divide-y divide-border">
              {results.posts.map((post) => (
                <li key={post.id} className="px-5 py-3">
                  <Link to={`/post/${post.id}`} className="block">
                    <p className="line-clamp-2 text-sm text-foreground">
                      {post.textContent?.trim() || 'Post with media'}
                    </p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {post.reactionCount} reactions · {post.commentCount} comments ·{' '}
                      {timeAgo(post.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {results.users.length === 0 && results.posts.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nothing matches “{query.trim()}”.
            </p>
          )}
        </Card>
      )}

      {/* Suggested people */}
      {!isSearching && suggested.length > 0 && (
        <section>
          <h2 className="pb-2 text-[15px] font-semibold text-foreground">People you may know</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {suggested.map((person) => (
              <li key={person.userId} className="rounded border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {person.avatarUrl ? (
                      <AvatarImage src={person.avatarUrl} alt={person.displayName} />
                    ) : null}
                    <AvatarFallback style={avatarTone(person.userId)}>
                      {initials(person.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <Link to={`/profile/${person.userId}`}>
                      <p className="truncate text-sm font-medium text-foreground">
                        {person.displayName}
                      </p>
                    </Link>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {person.bio ?? person.locationText ?? 'New on Connectly'}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    disabled={requested.has(person.userId)}
                    onClick={() => handleAdd(person)}
                  >
                    {requested.has(person.userId) ? (
                      'Requested'
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Photo grid */}
      {!isSearching && (
        <section>
          <h2 className="pb-2 text-[15px] font-semibold text-foreground">Recent photos</h2>

          {status === 'loading' && (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {status === 'error' && (
            <Card className="rounded border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Could not load explore content</p>
              <p className="mt-1">{error}</p>
            </Card>
          )}

          {status === 'ready' && mediaPosts.length > 0 && (
            <div className="columns-2 gap-3 sm:columns-3 [&>*]:mb-3">
              {mediaPosts.map((post) => {
                const author = authors[post.authorUserId];
                return (
                  <figure key={post.id} className="overflow-hidden rounded border border-border bg-card">
                    <Link to={`/post/${post.id}`}>
                      <SafeImage
                        src={post.media[0].url}
                        alt={post.textContent ?? 'Post image'}
                        loading="lazy"
                        className="w-full object-cover"
                        fallbackClassName="min-h-40"
                      />
                    </Link>
                    <figcaption className="px-3 py-2">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {author?.displayName ?? 'Unknown'}
                      </p>
                      {post.textContent && (
                        <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                          {post.textContent}
                        </p>
                      )}
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {timeAgo(post.createdAt)}
                      </p>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}

          {/* Kept outside the columns container, otherwise it becomes one narrow column. */}
          {status === 'ready' && mediaPosts.length === 0 && (
            <Card className="rounded border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No photo posts yet. Share an image on your profile to fill this grid.
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
