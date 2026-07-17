import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MentionInput from './MentionInput';
import RichText from './RichText';
import { cn } from '@/lib/utils';
import { avatarTone } from '@/lib/avatar';
import { initials, timeAgo } from '@/lib/social';
import { reactionDef } from './reactions';
import type { CommentDto, ProfileDto } from '@/types/api';

interface CommentRowProps {
  comment: CommentDto;
  profile: ProfileDto | null;
  stat: { count: number; viewer: string | null };
  editing: boolean;
  editDraft: string;
  isReply?: boolean;
  onToggleReaction: (comment: CommentDto) => void;
  onReply: (comment: CommentDto) => void;
  onEdit: (comment: CommentDto) => void;
  onSaveEdit: (comment: CommentDto) => void;
  onCancelEdit: () => void;
  onDelete: (comment: CommentDto) => void;
  onShowEditHistory: (commentId: string) => void;
  meId: string | null;
  canDeleteAny: boolean;
  onEditDraftChange: (value: string) => void;
}

export function CommentRow({
  comment,
  profile,
  stat,
  editing,
  editDraft,
  isReply = false,
  onToggleReaction,
  onReply,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onShowEditHistory,
  meId,
  canDeleteAny,
  onEditDraftChange,
}: CommentRowProps) {
  const canEdit = comment.authorUserId === meId;
  const canDelete = canEdit || canDeleteAny;

  return (
    <div className={cn('flex items-start gap-2.5', isReply && 'ml-11')}>
      <Avatar className="h-8 w-8">
        {profile?.avatarUrl ? (
          <AvatarImage src={profile.avatarUrl} alt={profile.displayName ?? 'User'} />
        ) : null}
        <AvatarFallback style={avatarTone(comment.authorUserId)}>
          {initials(profile?.displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="inline-block max-w-full rounded bg-secondary px-3 py-2">
          <p className="text-[12px] font-semibold text-foreground">
            {profile?.displayName ?? 'User'}
          </p>
          {editing ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={editDraft}
                onChange={(event) => onEditDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSaveEdit(comment);
                  if (event.key === 'Escape') onCancelEdit();
                }}
                className="h-7 w-64 max-w-full rounded border border-input bg-card px-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" onClick={() => onSaveEdit(comment)} disabled={!editDraft.trim()}>
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                Cancel
              </Button>
            </div>
          ) : (
            <RichText
              text={comment.content}
              mentions={comment.mentions}
              className="text-sm text-foreground"
            />
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-3 px-3 text-[12px] text-muted-foreground">
          <span>{timeAgo(comment.createdAt)}</span>
          {comment.wasEdited && (
            <button
              type="button"
              onClick={() => onShowEditHistory(comment.id)}
              className="font-medium transition-colors hover:text-foreground hover:underline"
              title="See what changed"
            >
              Edited
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleReaction(comment)}
            className={cn(
              'font-medium transition-colors',
              stat.viewer ? 'text-accent-action' : 'hover:text-foreground',
            )}
          >
            {stat.viewer ? `${reactionDef(stat.viewer).emoji} Liked` : 'Like'}
          </button>
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="font-medium transition-colors hover:text-foreground"
          >
            Reply
          </button>
          {stat.count > 0 && <span className="tnum">{stat.count}</span>}

          {canEdit || canDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Comment options"
                  className="rounded p-0.5 transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {canEdit && (
                  <DropdownMenuItem onSelect={() => onEdit(comment)}>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                    Edit comment
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive-soft focus:text-destructive"
                    onSelect={() => onDelete(comment)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </div>
  );
}