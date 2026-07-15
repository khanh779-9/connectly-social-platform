import { Button } from '@/components/ui/button';
import RichText from './RichText';
import type { PostDto } from '@/types/api';

interface PostContentProps {
  post: PostDto;
  postText: string;
  postEditing: boolean;
  postDraft: string;
  savingPost: boolean;
  onPostDraftChange: (value: string) => void;
  onSavePostEdit: () => void;
  onCancelPostEdit: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function PostContent({
  post,
  postText,
  postEditing,
  postDraft,
  savingPost,
  onPostDraftChange,
  onSavePostEdit,
  onCancelPostEdit,
  onKeyDown,
}: PostContentProps) {
  return (
    <>
      {postEditing ? (
        <div className="mt-3">
          <textarea
            autoFocus
            value={postDraft}
            onChange={(event) => onPostDraftChange(event.target.value)}
            onKeyDown={onKeyDown}
            rows={4}
            aria-label="Edit post text"
            className="w-full resize-y rounded border border-input bg-card px-3 py-2 text-[15px] leading-relaxed text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" onClick={onSavePostEdit} disabled={!postDraft.trim() || savingPost}>
              {savingPost ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancelPostEdit}>
              Cancel
            </Button>
            <span className="text-[12px] text-muted-foreground">⌘/Ctrl + Enter</span>
          </div>
        </div>
      ) : (
        postText && (
          <RichText
            text={postText}
            mentions={post.mentions}
            className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground"
          />
        )
      )}
    </>
  );
}