import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { avatarTone } from '@/lib/avatar';
import { ensureProfiles, fetchStoryFeed, getErrorMessage, initials } from '@/lib/social';
import type { ProfileDto, StoryAuthorDto } from '@/types/api';

export interface StoryRailProps {
  /** the viewer's own user id — used for the "Your story" tile */
  viewerId: string | null;
  onOpenAuthor: (author: StoryAuthorDto) => void;
  onCreate: () => void;
  /** bump to reload the rail (e.g. after publishing a story) */
  refreshKey?: number;
  /** stories the viewer already opened in this session */
  viewedStoryIds?: string[];
}

/**
 * The story strip at the top of the feed: one tile per author.
 * The accent ring shows unseen stories, the arc shows viewing progress.
 */
export default function StoryRail({
  viewerId,
  onOpenAuthor,
  onCreate,
  refreshKey,
  viewedStoryIds = [],
}: StoryRailProps) {
  const [authors, setAuthors] = useState<StoryAuthorDto[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileDto | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const feed = await fetchStoryFeed();
      setAuthors(feed);
      const ids = feed.map((author) => author.userId);
      if (viewerId) ids.push(viewerId);
      const resolved = await ensureProfiles(ids);
      setProfiles((prev) => ({ ...prev, ...resolved }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [viewerId, refreshKey]);

  const mine = authors.find((author) => author.userId === viewerId) ?? null;
  const viewerProfile = viewerId ? profiles[viewerId] : null;

  // Gradient ring style for unseen stories (matches DESIGN.md accent)
  const gradientRingStyle = {
    background: 'conic-gradient(from 0deg, var(--accent-action), var(--accent-action-hover), var(--accent-online), var(--accent-action))',
  } as React.CSSProperties;

  const gradientRingInnerStyle = {
    background: 'var(--card)',
  } as React.CSSProperties;

  return (
    <Card className="rounded border border-border bg-card p-3">
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
        {/* Your story */}
        <div className="flex w-[86px] shrink-0 flex-col items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => (mine ? onOpenAuthor(mine) : onCreate())}
              className="block"
              aria-label={mine ? 'View your story' : 'Create a story'}
            >
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full">
                {/* Gradient ring for "your story" when you have stories to add */}
                {!mine && (
                  <span
                    className="absolute inset-[-2px] rounded-full p-[2px]"
                    style={gradientRingStyle}
                  >
                    <span className="relative h-full w-full rounded-full" style={gradientRingInnerStyle} />
                  </span>
                )}
                <Avatar className="h-[58px] w-[58px]">
                  {mine?.stories[0]?.url ? (
                    <AvatarImage src={mine.stories[0].url} alt="Your story" />
                  ) : viewerProfile?.avatarUrl ? (
                    <AvatarImage src={viewerProfile.avatarUrl} alt="Your profile" />
                  ) : null}
                  <AvatarFallback style={avatarTone(viewerId ?? undefined)}>
                    {initials(viewerProfile?.displayName)}
                  </AvatarFallback>
                </Avatar>
              </span>
            </button>
            <button
              type="button"
              aria-label="Add story"
              onClick={onCreate}
              className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-card bg-accent text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <span className="w-full truncate text-center text-[12px] text-muted-foreground">
            {mine ? 'Your story' : 'Add story'}
          </span>
        </div>

        {/* friends */}
        {authors
          .filter((author) => author.userId !== viewerId)
          .map((author) => {
            const profile = profiles[author.userId];
            const cover = author.stories[0];
            const unseenStories = author.stories.filter(
              (story) => !story.viewerViewed && !viewedStoryIds.includes(story.id),
            );
            const unseen = unseenStories.length > 0;
            const progress = author.stories.length > 0
              ? (author.stories.length - unseenStories.length) / author.stories.length
              : 0;

            return (
              <button
                key={author.userId}
                type="button"
                onClick={() => onOpenAuthor(author)}
                className="relative flex w-[86px] shrink-0 flex-col items-center gap-1.5"
              >
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full">
                  {/* Gradient ring for unseen stories */}
                  {unseen && (
                    <span
                      className="absolute inset-[-2px] rounded-full p-[2px]"
                      style={gradientRingStyle}
                    >
                      <span className="relative h-full w-full rounded-full" style={gradientRingInnerStyle} />
                    </span>
                  )}
                  {/* Progress indicator - thin arc showing viewed progress */}
                  {author.stories.length > 1 && (
                    <svg
                      className="absolute inset-0"
                      viewBox="0 0 64 64"
                      aria-hidden="true"
                    >
                      <circle
                        className="text-border"
                        cx="32"
                        cy="32"
                        r="28"
                        strokeWidth="2"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${Math.max(0.1, progress * 176)} 176`}
                        strokeLinecap="round"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                      />
                    </svg>
                  )}
                  <Avatar className="h-[58px] w-[58px]">
                    {cover ? (
                      <AvatarImage src={cover.url} alt={profile?.displayName ?? 'Story'} />
                    ) : profile?.avatarUrl ? (
                      <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                    ) : null}
                    <AvatarFallback style={avatarTone(author.userId)}>
                      {initials(profile?.displayName)}
                    </AvatarFallback>
                  </Avatar>
                </span>
                <span className="w-full truncate text-center text-[12px] text-muted-foreground">
                  {profile?.displayName ?? 'Story'}
                </span>
                {/* Unread count badge */}
                {unseen && (
                  <span
                    className="absolute -top-0.5 -right-0.5 flex min-w-[16px] h-4 items-center justify-center rounded-full bg-accent px-1 text-[12px] font-semibold leading-none text-accent-foreground"
                    aria-label={`${unseenStories.length} unviewed stories`}
                  >
                    {unseenStories.length > 9 ? '9+' : unseenStories.length}
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading stories…
        </div>
      )}

      {!loading && error && (
        <p className="px-1 py-3 text-[12px] text-destructive">{error}</p>
      )}

      {!loading && !error && authors.length === 0 && (
        <p className="px-1 py-3 text-[13px] text-muted-foreground">
          No stories right now. Add one to share a moment with your friends.
        </p>
      )}
    </Card>
  );
}
