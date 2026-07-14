import type { CommentDto, PollDto, PostDto } from '@/types/api';
import { reactionDef } from './reactions';

/** Copies a post link to clipboard. */
export async function copyLink(postId: string) {
  const url = `${window.location.origin}/post/${postId}`;
  await navigator.clipboard.writeText(url);
}

/**
 * Applies a vote set locally so the bars react before the server answers.
 */
export function applyVote(poll: PollDto, nextOptionIds: string[]): PollDto {
  const next = new Set(nextOptionIds);
  const previouslyVoted = new Set(
    poll.options.filter((option) => option.viewerVoted).map((option) => option.id),
  );
  const options = poll.options.map((option) => {
    const voted = next.has(option.id);
    const wasVoted = previouslyVoted.has(option.id);
    const delta = voted === wasVoted ? 0 : voted ? 1 : -1;
    return { ...option, viewerVoted: voted, voteCount: Math.max(0, option.voteCount + delta) };
  });
  const totalVotes = options.reduce((sum, option) => sum + option.voteCount, 0);
  return { ...poll, options, totalVotes };
}

/**
 * Folds the viewer's optimistic reaction into the server-side per-type counts so
 * the summary emojis stay truthful between the click and the next data fetch.
 */
export function adjustedBreakdowns(
  post: PostDto,
  activeReaction: string | null,
  serverReaction: string | null,
): { type: string; count: number }[] {
  const base = (post.reactionBreakdowns ?? []).map((item) => ({ ...item }));
  if (serverReaction && serverReaction !== activeReaction) {
    const index = base.findIndex((item) => item.type === serverReaction);
    if (index >= 0) {
      base[index].count -= 1;
      if (base[index].count <= 0) base.splice(index, 1);
    }
  }
  if (activeReaction && activeReaction !== serverReaction) {
    const index = base.findIndex((item) => item.type === activeReaction);
    if (index >= 0) base[index].count += 1;
    else base.push({ type: activeReaction, count: 1 });
  }
  return base.sort((a, b) => b.count - a.count);
}

/**
 * Computes optimistic comment reaction stat from overrides or server data.
 */
export function getCommentStat(
  comment: CommentDto,
  overrides: Record<string, { count: number; viewer: string | null }>
): { count: number; viewer: string | null } {
  const override = overrides[comment.id];
  return {
    count: override?.count ?? comment.reactionCount,
    viewer: override ? override.viewer : (comment.viewerReaction ?? null),
  };
}

/**
 * Reaction text color classes for the like button.
 */
export const REACTION_TEXT: Record<string, string> = {
  like: 'text-accent-action',
  love: 'text-[#e0245e]',
  care: 'text-[#f7b125]',
  haha: 'text-[#f7b125]',
  wow: 'text-[#f7b125]',
  sad: 'text-[#f7b125]',
  angry: 'text-[#e9710f]',
};