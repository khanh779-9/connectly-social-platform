import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import MentionInput from './MentionInput';
import { CommentRow } from './CommentRow';
import { avatarTone } from '@/lib/avatar';
import {
  cachedProfile,
  deleteComment,
  ensureProfiles,
  fetchComments,
  initials,
  postComment,
  removeCommentReaction,
  setCommentReaction,
  updateComment,
} from '@/lib/social';
import type { CommentDto, ProfileDto, PostDto } from '@/types/api';
import { getCommentStat } from './postUtils';

interface CommentThreadProps {
  post: PostDto;
  commentsOpen: boolean;
  onToggleComments: () => void;
  threadMode: 'dialog' | 'inline';
  meId: string | null;
  postAuthorId: string;
  viewerReaction: string | null;
  onProfilesResolved?: (profiles: Record<string, ProfileDto | null>) => void;
  onShowEditHistory: (commentId: string) => void;
}

export function CommentThread({
  post,
  commentsOpen,
  meId,
  postAuthorId,
  onProfilesResolved,
  onShowEditHistory,
}: CommentThreadProps) {
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [commentOverrides, setCommentOverrides] = useState<
    Record<string, { count: number; viewer: string | null }>
  >({});

  async function loadComments() {
    setCommentsLoading(true);
    try {
      const items = await fetchComments(post.id);
      setComments(items);
      const resolved = await ensureProfiles(items.map((comment) => comment.authorUserId));
      onProfilesResolved?.(resolved);
    } catch {
      // the frame keeps its place; the list simply stays empty
    } finally {
      setCommentsLoaded(true);
      setCommentsLoading(false);
    }
  }

  useEffect(() => {
    if (commentsOpen && !commentsLoaded && !commentsLoading) {
      loadComments();
    }
  }, [commentsOpen, commentsLoaded, commentsLoading, post.id]);

  async function toggleCommentReaction(comment: CommentDto) {
    const current = getCommentStat(comment, commentOverrides);
    const nextViewer = current.viewer ? null : 'like';
    setCommentOverrides((prev) => ({
      ...prev,
      [comment.id]: { count: Math.max(0, current.count + (nextViewer ? 1 : -1)), viewer: nextViewer },
    }));
    try {
      if (nextViewer) await setCommentReaction(comment.id, nextViewer);
      else await removeCommentReaction(comment.id);
    } catch {
      setCommentOverrides((prev) => ({ ...prev, [comment.id]: current }));
    }
  }

  async function saveCommentEdit(comment: CommentDto) {
    const content = editDraft.trim();
    if (!content || content === comment.content) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await updateComment(comment.id, content);
      setComments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingId(null);
    } catch {
      // keep the editor open so the user can retry
    }
  }

  async function handleDeleteComment(comment: CommentDto) {
    const previous = comments;
    setComments((prev) => prev.filter((item) => item.id !== comment.id && item.parentCommentId !== comment.id));
    try {
      await deleteComment(comment.id);
    } catch {
      setComments(previous);
    }
  }

  async function handleSendComment() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const created = await postComment(post.id, content);
      setComments((prev) => [...prev, created]);
      setDraft('');
      const resolved = await ensureProfiles([created.authorUserId]);
      onProfilesResolved?.(resolved);
    } catch {
      // the draft stays so the user can retry
    } finally {
      setSending(false);
    }
  }

  async function handleSendReply() {
    const content = replyDraft.trim();
    const parent = comments.find((comment) => comment.id === replyTo);
    if (!content || !parent || sending) return;
    setSending(true);
    try {
      const created = await postComment(post.id, content, parent.id);
      setComments((prev) => [...prev, created]);
      setReplyDraft('');
      setReplyTo(null);
      const resolved = await ensureProfiles([created.authorUserId]);
      onProfilesResolved?.(resolved);
    } catch {
      // keep the reply draft on failure
    } finally {
      setSending(false);
    }
  }

  const topLevelComments = comments.filter((comment) => !comment.parentCommentId);

  if (!commentsOpen) return null;

  return (
    <div className="mt-4 space-y-1 border-t border-border pt-3">
      {commentsLoading && <p className="text-[13px] text-muted-foreground">Loading comments…</p>}

      {topLevelComments.map((comment) => (
        <CommentThreadItem
          key={comment.id}
          comment={comment}
          replies={comments.filter((child) => child.parentCommentId === comment.id)}
          meId={meId}
          postAuthorId={postAuthorId}
          onToggleReaction={toggleCommentReaction}
          onReply={(parent) => {
            setReplyTo(parent.id);
            setReplyDraft('');
          }}
          replying={replyTo === comment.id}
          replyDraft={replyDraft}
          onReplyDraftChange={setReplyDraft}
          onSendReply={handleSendReply}
          replySending={sending}
          onCancelReply={() => setReplyTo(null)}
          canDeleteAny={postAuthorId === meId}
          onEdit={(target) => {
            setEditingId(target.id);
            setEditDraft(target.content);
          }}
          editingId={editingId}
          editDraft={editDraft}
          onEditDraftChange={setEditDraft}
          onSaveEdit={saveCommentEdit}
          onCancelEdit={() => setEditingId(null)}
          onDelete={handleDeleteComment}
          onShowEditHistory={onShowEditHistory}
          commentOverrides={commentOverrides}
          setCommentOverrides={setCommentOverrides}
        />
      ))}

      {commentsLoaded && !commentsLoading && comments.length === 0 && (
        <p className="text-[13px] text-muted-foreground">No comments yet.</p>
      )}

