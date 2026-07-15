import { Link } from 'react-router-dom';
import {
  Check,
  Globe2,
  History,
  Link2,
  Lock,
  MoreHorizontal,
  Pencil,
  Send,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { avatarTone } from '@/lib/avatar';
import { initials, timeAgo } from '@/lib/social';
import type { PostDto, ProfileDto } from '@/types/api';

const VISIBILITY_ITEMS = [
  { value: 0, label: 'Public', icon: Globe2 },
  { value: 1, label: 'Friends', icon: Users },
  { value: 2, label: 'Only me', icon: Lock },
];

interface PostHeaderProps {
  post: PostDto;
  author: ProfileDto | null;
  postEditedAt: string | null;
  isMine: boolean;
  canChangeVisibility: boolean;
  visibility: string;
  onChangeVisibility?: (visibility: number) => void;
  // Handlers
  onCopyLink: () => void;
  onShareToFeed: () => void;
  onOpenShareDialog: () => void;
  onEditPost: () => void;
  onDeletePost: () => void;
  onOpenPostHistory: () => void;
  // Dialog state
  confirmDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  deleting: boolean;
  actionError: string | null;
}

export function PostHeader({
  post,
  author,
  postEditedAt,
  isMine,
  canChangeVisibility,
  visibility,
  onChangeVisibility,
  onCopyLink,
  onShareToFeed,
  onOpenShareDialog,
  onEditPost,
  onDeletePost,
  onOpenPostHistory,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
  deleting,
  actionError,
}: PostHeaderProps) {
  const authorName = author?.displayName ?? 'Unknown user';

  return (
    <>
      <header className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          {author?.avatarUrl ? <AvatarImage src={author.avatarUrl} alt={authorName} /> : null}
          <AvatarFallback style={avatarTone(post.authorUserId)}>
            {initials(author?.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{authorName}</p>
          <p className="text-[12px] text-muted-foreground">
            {timeAgo(post.createdAt)} ·{' '}
            {canChangeVisibility ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Audience: ${visibility}. Change who can see this post`}
                  >
                    {visibility}
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[12rem]">
                  <DropdownMenuLabel>Who can see this</DropdownMenuLabel>
                  {VISIBILITY_ITEMS.map(({ value, label, icon: Icon }) => (
                    <DropdownMenuItem key={value} onSelect={() => onChangeVisibility?.(value)}>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{label}</span>
                      {visibility === label && <Check className="h-4 w-4 text-accent-action" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              visibility
            )}
            {postEditedAt && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={onOpenPostHistory}
                  className="rounded font-medium transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="See what changed"
                >
                  Edited
                </button>
              </>
            )}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mr-1.5"
              aria-label="Post options"
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onCopyLink}>
              <Link2 className="h-4 w-4 text-muted-foreground" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onShareToFeed}>
              <Share2 className="h-4 w-4 text-muted-foreground" />
              Share to feed
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenShareDialog}>
              <Send className="h-4 w-4 text-muted-foreground" />
              Send in message
            </DropdownMenuItem>
            {postEditedAt && (
              <DropdownMenuItem onSelect={onOpenPostHistory}>
                <History className="h-4 w-4 text-muted-foreground" />
                View edit history
              </DropdownMenuItem>
            )}
            {isMine && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onEditPost}>
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  Edit post
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive-soft focus:text-destructive"
                  onSelect={onDeletePost}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete post
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {actionError && (
        <p className="mt-2 rounded border border-border bg-secondary px-2.5 py-1.5 text-[12px] text-destructive">
          {actionError}
        </p>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this post?"
          description="The post, its media and its comments will be removed. This cannot be undone."
          confirmLabel="Delete"
          busy={deleting}
          destructive
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      )}
    </>
  );
}