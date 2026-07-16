import { useState } from 'react';
import { Bookmark, MessageCircle, Send, Share2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { PostDto } from '@/types/api';
import { sharePost } from '@/lib/social';
import { copyLink } from './postUtils';

interface PostActionsProps {
  post: PostDto;
  commentCount: number;
  shareCount: number;
  isSaved: boolean;
  onToggleBookmark: (post: PostDto, saved: boolean) => void;
  onOpenThread: () => void;
  onOpenShareDialog: () => void;
}

export function PostActions({
  post,
  commentCount,
  shareCount,
  isSaved,
  onToggleBookmark,
  onOpenThread,
  onOpenShareDialog,
}: PostActionsProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  async function handleShareToFeed() {
    try {
      await sharePost(post.id);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      // feedback stays unchanged; the counts update on next load
    }
  }

  async function handleCopyLink() {
    try {
      await copyLink(post.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
      <button
        type="button"
        onClick={onOpenThread}
        aria-expanded={false}
        className="flex h-8 items-center gap-1.5 rounded px-2 text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <MessageCircle className="h-[18px] w-[18px]" />
        Comment
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded px-2 text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Share2 className="h-[18px] w-[18px]" />
            Share
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={handleShareToFeed}>
            <Share2 className="h-4 w-4 text-muted-foreground" />
            {shared ? 'Shared to feed ✓' : 'Share to feed'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenShareDialog}>
            <Send className="h-4 w-4 text-muted-foreground" />
            Send in message
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleCopyLink}>
            <span className="h-4 w-4" /> {/* Link2 icon */}
            {copied ? 'Link copied' : 'Copy link'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={() => onToggleBookmark(post, isSaved)}
        aria-pressed={isSaved}
        className={cn(
          'ml-auto flex h-8 items-center gap-1.5 rounded px-2 text-[13px] transition-colors',
          isSaved
            ? 'text-accent-action'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )}
      >
        <Bookmark className={cn('h-[18px] w-[18px]', isSaved && 'fill-accent-action')} />
        {isSaved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}