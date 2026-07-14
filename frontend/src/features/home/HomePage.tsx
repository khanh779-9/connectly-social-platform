import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { VirtualizedFeed } from '@/components/ui/VirtualizedFeed';
import Composer, { type PollDraft } from '@/features/social/Composer';
import PostCard from '@/features/social/PostCard';
import CreateStoryDialog from '@/features/stories/CreateStoryDialog';
import StoryArchiveMenu from '@/features/stories/StoryArchiveMenu';
import StoryRail from '@/features/stories/StoryRail';
import StoryViewer from '@/features/stories/StoryViewer';
import { useAppSelector } from '@/store/hooks';
import {
  createPost,
  deleteStory,
  fetchHomeFeed,
  fetchMyProfile,
  fetchPrivacySettings,
  ensureProfiles,
  getErrorMessage,
  removeBookmark,
  removeReaction,
  saveBookmark,
  setReaction,
} from '@/lib/social';
import { viewerReactionFrom } from '@/lib/social';
import type { FeedItemDto, PostDto, ProfileDto, StoryAuthorDto } from '@/types/api';

export default function HomePage() {
  const userId = useAppSelector((state) => state.auth.userId);
  const [items, setItems] = useState<FeedItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [feedStatus, setFeedStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [feedError, setFeedError] = useState<string | null>(null);
  const [authors, setAuthors] = useState<Record<string, ProfileDto | null>>({});
  const [reactions, setReactions] = useState<Record<string, string | null>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // composer state
  const [me, setMe] = useState<ProfileDto | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [defaultVisibility, setDefaultVisibility] = useState(0);

  // stories
  const [storyAuthor, setStoryAuthor] = useState<StoryAuthorDto | null>(null);
  const [storyCreating, setStoryCreating] = useState(false);
  const [archivingStoryId, setArchivingStoryId] = useState<string | null>(null);
  const [storyRefresh, setStoryRefresh] = useState(0);
  const [viewedStoryIds, setViewedStoryIds] = useState<string[]>([]);

  async function loadFeed(reset: boolean, cursor?: string) {
    setFeedStatus('loading');
    setFeedError(null);
    try {
      const page = await fetchHomeFeed(cursor, 15);
      setItems((prev) =>
        reset
          ? page.items
          : [
              ...prev,
              ...page.items.filter(
                (fresh) => !prev.some((existing) => existing.post.id === fresh.post.id),
              ),
            ],
      );
      setNextCursor(page.nextCursor ?? null);
      setReactions((prev) => {
        const next = { ...prev };
        page.items.forEach((item) => {
          if (item.post.viewerReaction) next[item.post.id] = item.post.viewerReaction;
        });
        return next;
      });
      setSavedIds((prev) => {
        const next = new Set(prev);
        page.items.forEach((item) => {
          if (item.post.viewerBookmarked) next.add(item.post.id);
        });
        return next;
      });
      const resolved = await ensureProfiles(
        page.items.map((item) => item.post.authorUserId),
      );
      setAuthors((prev) => ({ ...prev, ...resolved }));
      setFeedStatus('ready');
    } catch (error) {
      setFeedError(getErrorMessage(error));
      setFeedStatus('error');
    }
  }

  // Load the first page when the page opens.
  useEffect(() => {
    loadFeed(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then((profile) => {
        if (!cancelled) setMe(profile);
      })
      .catch(() => {
        // profile stays null
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The composer preselection follows "Settings → Posting → default audience".
  useEffect(() => {
    let cancelled = false;
    fetchPrivacySettings()
      .then((settings) => {
        if (cancelled) return;
        const value = settings.defaultPostVisibility;
        setDefaultVisibility(value === 'friends' ? 1 : value === 'only_me' ? 2 : 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePost(
    content: string,
    mediaAssetIds: string[],
    visibility: number,
    poll?: PollDraft | null,
  ) {
    setPosting(true);
    setPostError(null);
    try {
      const post = await createPost(content, mediaAssetIds, visibility, null, poll ?? null);
      setItems((prev) => [{ post, source: 'self' }, ...prev]);
      const resolved = await ensureProfiles([post.authorUserId]);
      setAuthors((prev) => ({ ...prev, ...resolved }));
    } catch (error) {
      setPostError(getErrorMessage(error));
      // Rethrow so the composer keeps the draft instead of clearing it.
      throw error;
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteStory(storyId: string) {
    try {
      await deleteStory(storyId);
      setStoryAuthor((prev) =>
        prev
          ? {
              ...prev,
              stories: prev.stories.filter((story) => story.id !== storyId),
              hasUnviewed: prev.stories.some(
                (story) => story.id !== storyId && !story.viewerViewed,
              ),
            }
          : prev,
      );
      setStoryAuthor((prev) => (prev && prev.stories.length === 0 ? null : prev));
      setStoryRefresh((prev) => prev + 1);
    } catch (error) {
      setPostError(getErrorMessage(error));
    }
  }

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

