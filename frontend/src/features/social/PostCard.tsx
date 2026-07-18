import { useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import {
  updatePost,
  deletePost,
  votePoll,
  sharePost,
  getErrorMessage,
  visibilityLabel,
} from '@/lib/social';
import { applyVote, adjustedBreakdowns, copyLink } from './postUtils';
import type { PostDto, ProfileDto, PollDto } from '@/types/api';
import ReactionBreakdown from './ReactionBreakdown';
import ShareDialog from './ShareDialog';
import PostDialog from './PostDialog';
import EditHistoryDialog from './EditHistoryDialog';
import { PostHeader } from './PostHeader';
import { PostContent } from './PostContent';
import { PostMedia } from './PostMedia';
import { PostPoll } from './PostPoll';
import { PostReactions } from './PostReactions';
import { PostActions } from './PostActions';
import { CommentThread } from './CommentThread';

export interface PostCardProps {
  post: PostDto;
  author: ProfileDto | null;
  /** The viewer's reaction — optimistic value from the page, falling back to the server value. */
  viewerReaction?: string | null;
  onReact: (post: PostDto, type: string | null) => void;
  bookmarked?: boolean;
  onToggleBookmark?: (post: PostDto, bookmarked: boolean) => void;
  /** Called after the viewer deletes this post (the page can drop it from its list). */
  onDeleted?: (post: PostDto) => void;
  onProfilesResolved?: (profiles: Record<string, ProfileDto | null>) => void;
  /** Use `inline` inside the post dialog so the comment count does not re-open it. */
  threadMode?: 'dialog' | 'inline';
  /** Start with the comment thread expanded. */
  defaultCommentsOpen?: boolean;
}

function PostCard({
  post,
  author,
  viewerReaction,
  onReact,
  bookmarked,
  onToggleBookmark,
  onDeleted,
  onProfilesResolved,
  threadMode = 'dialog',
  defaultCommentsOpen = false,
}: PostCardProps) {
  const meId = useAppSelector((state) => state.auth.userId);

  // Which panel is open
  const [commentsOpen, setCommentsOpen] = useState(defaultCommentsOpen);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [postHistoryOpen, setPostHistoryOpen] = useState(false);
  const [commentHistoryId, setCommentHistoryId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Editing the post
  const [postEditing, setPostEditing] = useState(false);
  const [postDraft, setPostDraft] = useState(post.textContent ?? '');
  const [savingPost, setSavingPost] = useState(false);
  const [postTextOverride, setPostTextOverride] = useState<string | null>(null);
  const [postEditedAtOverride, setPostEditedAtOverride] = useState<string | null>(null);

  // Poll
  const [pollOverride, setPollOverride] = useState<PollDto | null>(null);
  const [votingPoll, setVotingPoll] = useState(false);

  // The rest
  const [removed, setRemoved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [visibilityOverride, setVisibilityOverride] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [failedVideos, setFailedVideos] = useState<Record<string, boolean>>({});

  // What we show on screen
  const serverReaction = post.viewerReaction ?? null;
  const activeReaction = viewerReaction !== undefined ? viewerReaction : serverReaction;
  const reactionDelta = (activeReaction ? 1 : 0) - (serverReaction ? 1 : 0);
  const reactionCount = Math.max(0, (post.reactionCount ?? 0) + reactionDelta);
  const topReactions = adjustedBreakdowns(post, activeReaction, serverReaction).slice(0, 3);
  const postText = postTextOverride ?? post.textContent ?? '';
  const postEditedAt = postEditedAtOverride ?? post.editedAt ?? null;
  const poll = pollOverride ?? post.poll ?? null;
  const isMine = post.authorUserId === meId;
  const canChangeVisibility = isMine && !post.groupId && !post.pageId;
  const visibility = visibilityOverride ?? visibilityLabel(post.visibility);
  const isSaved = bookmarked ?? post.viewerBookmarked;

  async function changeVisibility(next: number) {
    const previous = visibilityOverride;
    setVisibilityOverride(visibilityLabel(next));
    setActionError(null);

    try {
      const updated = await updatePost(post.id, { visibility: next });
      setVisibilityOverride(visibilityLabel(updated.visibility));
    } catch (error) {
      setVisibilityOverride(previous);
      setActionError(getErrorMessage(error));
    }
  }

  async function savePostEdit() {
    const next = postDraft.trim();
    if (savingPost) return;

    // Nothing new to save: just close the editor.
    if (!next || next === postText.trim()) {
      setPostEditing(false);
      return;
    }

    setSavingPost(true);
    setActionError(null);
    try {
      const updated = await updatePost(post.id, { textContent: next });
      setPostTextOverride(updated.textContent ?? next);
      setPostEditedAtOverride(updated.editedAt ?? new Date().toISOString());
      setPostEditing(false);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSavingPost(false);
    }
  }

  async function confirmDeletePost() {
    setDeleting(true);
    setActionError(null);
    try {
      await deletePost(post.id);
      setConfirmDelete(false);
      setRemoved(true);
      onDeleted?.(post);
    } catch (error) {
      setActionError(getErrorMessage(error));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function shareToFeed() {
    try {
      await sharePost(post.id);
      setShareDialogOpen(false);
    } catch {
      // The counts are updated the next time the feed loads.
    }
  }

  async function handlePollVote(optionId: string) {
    if (!poll || votingPoll) return;

    // A poll with one choice replaces the old vote, a poll with several adds to it.
    const selected = poll.options.filter((option) => option.viewerVoted).map((option) => option.id);
    let next: string[];
    if (poll.allowMultiple) {
      next = selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId];
    } else {
      next = selected.includes(optionId) ? [] : [optionId];
    }

    const previous = pollOverride;
    setPollOverride(applyVote(poll, next));
    setVotingPoll(true);
    try {
      const updated = await votePoll(post.id, next);
      setPollOverride(updated);
    } catch {
      setPollOverride(previous);
    } finally {
      setVotingPoll(false);
    }
  }

  function onVideoError(mediaId: string) {
    setFailedVideos((current) => ({ ...current, [mediaId]: true }));
  }

  if (removed) return null;

  return (
    <article className="rounded border border-border bg-card">
      <div className="p-4 sm:p-5">
        <PostHeader
          post={post}
          author={author}
          postEditedAt={postEditedAt}
          isMine={isMine}
          canChangeVisibility={canChangeVisibility}
          visibility={visibility}
          onChangeVisibility={changeVisibility}
          onCopyLink={() => copyLink(post.id)}
          onShareToFeed={shareToFeed}
          onOpenShareDialog={() => setShareDialogOpen(true)}
          onEditPost={() => {
            setPostDraft(postText);
            setPostEditing(true);
          }}
          onDeletePost={() => setConfirmDelete(true)}
          onOpenPostHistory={() => setPostHistoryOpen(true)}
          confirmDelete={confirmDelete}
          onConfirmDelete={confirmDeletePost}
          onCancelDelete={() => setConfirmDelete(false)}
          deleting={deleting}
          actionError={actionError}
        />

        <PostContent
          post={post}
          postText={postText}
          postEditing={postEditing}
          postDraft={postDraft}
          savingPost={savingPost}
          onPostDraftChange={setPostDraft}
          onSavePostEdit={savePostEdit}
          onCancelPostEdit={() => {
            setPostDraft(postText);
            setPostEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setPostEditing(false);
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) savePostEdit();
          }}
        />

        <PostMedia
          post={post}
          threadMode={threadMode}
          onOpenThread={() => setThreadOpen(true)}
          failedVideos={failedVideos}
          onVideoError={onVideoError}
        />

        <PostPoll poll={poll} votingPoll={votingPoll} onVote={handlePollVote} />

        <PostReactions
          post={post}
          activeReaction={activeReaction}
          serverReaction={serverReaction}
          reactionCount={reactionCount}
          topReactions={topReactions}
          onReact={onReact}
          onOpenBreakdown={() => setBreakdownOpen(true)}
        />

        <PostActions
          post={post}
          commentCount={post.commentCount ?? 0}
          shareCount={post.shareCount ?? 0}
          isSaved={isSaved}
          onToggleBookmark={(target, saved) => onToggleBookmark?.(target, saved)}
          onOpenThread={() => setThreadOpen(true)}
          onOpenShareDialog={() => setShareDialogOpen(true)}
        />

        <CommentThread
          post={post}
          commentsOpen={commentsOpen}
          onToggleComments={() => setCommentsOpen((open) => !open)}
          threadMode={threadMode}
          meId={meId}
          postAuthorId={post.authorUserId}
          viewerReaction={activeReaction}
          onProfilesResolved={onProfilesResolved}
          onShowEditHistory={setCommentHistoryId}
        />
      </div>

      {breakdownOpen && <ReactionBreakdown post={post} onClose={() => setBreakdownOpen(false)} />}

      {shareDialogOpen && (
        <ShareDialog post={post} viewerId={meId} onClose={() => setShareDialogOpen(false)} />
      )}

      {threadOpen && <PostDialog postId={post.id} onClose={() => setThreadOpen(false)} />}

      {postHistoryOpen && (
        <EditHistoryDialog kind="post" contentId={post.id} onClose={() => setPostHistoryOpen(false)} />
      )}

      {commentHistoryId && (
        <EditHistoryDialog
          kind="comment"
          contentId={commentHistoryId}
          onClose={() => setCommentHistoryId(null)}
        />
      )}
    </article>
  );
}

export default PostCard;
