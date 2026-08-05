import { Check, CornerUpLeft, EyeOff, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/social';
import { formatChatMessageTime } from './messageTime';
import type { ChatMessageDto } from '@/types/api';

/** How long after sending a message its sender may still edit it. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Emoji offered in the quick-reaction row. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

export interface ChatDockMessageProps {
  message: ChatMessageDto;
  mine: boolean;
  menuOpen: boolean;
  editing: boolean;
  editDraft: string;
  busy: boolean;
  onToggleMenu: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onStartEdit: () => void;
  onEditDraftChange: (text: string) => void;
  onSubmitEdit: () => void;
  onCancelEdit: () => void;
  onRecall: () => void;
  onDeleteForMe: () => void;
}

/**
 * One message in the floating chat window: bubble, reaction chips and the
 * per-message action menu. The menu opens inline under the bubble so it never
 * has to escape the 320px window.
 */
export default function ChatDockMessage({
  message,
  mine,
  menuOpen,
  editing,
  editDraft,
  busy,
  onToggleMenu,
  onReact,
  onReply,
  onStartEdit,
  onEditDraftChange,
  onSubmitEdit,
  onCancelEdit,
  onRecall,
  onDeleteForMe,
}: ChatDockMessageProps) {
  const isRecalled = message.status === 'deleted';
  const reactions = message.reactions ?? [];
  const ageMs = Date.now() - new Date(message.sentAt).getTime();
  const canEdit = mine && !isRecalled && ageMs < EDIT_WINDOW_MS;

  const text = isRecalled
    ? 'Tin nhắn đã thu hồi'
    : message.body ??
      (message.attachments.length > 0 ? '📎 Tệp đính kèm' : '');

  const menuButton = (
    <button
      type="button"
      onClick={onToggleMenu}
      aria-label="Message actions"
      aria-haspopup="true"
      aria-expanded={menuOpen}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <MoreHorizontal className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div className="group flex flex-col gap-1">
      <div className={cn('flex items-end gap-1', mine ? 'justify-end' : 'justify-start')}>
        {!mine && !isRecalled && menuButton}

        <div
          className={cn(
            'max-w-[78%] rounded px-3 py-1.5 text-[13px] leading-snug',
            mine ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground',
            isRecalled && 'bg-transparent px-2 py-1 text-muted-foreground italic opacity-70',
          )}
        >
          {editing ? (
            <div className="flex w-48 flex-col gap-1.5">
              <input
                autoFocus
                value={editDraft}
                onChange={(event) => onEditDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    onSubmitEdit();
                  } else if (event.key === 'Escape') {
                    onCancelEdit();
                  }
                }}
                aria-label="Edit message"
                className="h-7 rounded border border-input bg-card px-2 text-[13px] text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={onCancelEdit}
                  aria-label="Cancel edit"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-black/5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onSubmitEdit}
                  disabled={!editDraft.trim() || busy}
                  aria-label="Save edit"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="block whitespace-pre-wrap break-words">{text}</span>
              {message.editedAt && !isRecalled ? (
                <span className="mt-0.5 block text-[11px] opacity-75">Đã sửa</span>
              ) : null}
            </>
          )}
          <time
            dateTime={message.sentAt}
            title={timeAgo(message.sentAt)}
            className={cn(
              'mt-1 block text-right text-[12px] font-medium tabular-nums',
              mine ? 'text-accent-foreground/70' : 'text-muted-foreground',
            )}
          >
            {formatChatMessageTime(message.sentAt)}
          </time>
        </div>

        {mine && !isRecalled && menuButton}
      </div>

      {menuOpen && !isRecalled && (
        <div
          role="group"
          aria-label="Message actions"
          className="flex flex-col gap-1 rounded border border-border bg-card p-1.5 shadow-dropdown"
        >
          <div className="flex items-center gap-1" role="group" aria-label="React with an emoji">
            {QUICK_REACTIONS.map((emoji) => {
              const active = reactions.some((r) => r.reactionType === emoji && r.viewerReacted);
              return (
                <button
                  key={emoji}
                  type="button"
                  aria-pressed={active}
                  aria-label={`React ${emoji}`}
                  onClick={() => onReact(emoji)}
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full text-[14px] leading-none transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active && 'bg-accent/10',
                  )}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1 border-t border-border pt-1">
            <button
              type="button"
              onClick={onReply}
              className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CornerUpLeft className="h-3.5 w-3.5" />
              Trả lời
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={onStartEdit}
                className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil className="h-3.5 w-3.5" />
                Sửa
              </button>
            )}
            <button
              type="button"
              onClick={onDeleteForMe}
              disabled={busy}
              className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <EyeOff className="h-3.5 w-3.5" />
              Xoá
            </button>
            {mine && (
              <button
                type="button"
                onClick={onRecall}
                disabled={busy}
                className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Thu hồi
              </button>
            )}
          </div>
        </div>
      )}

      {reactions.length > 0 && (
        <div className={cn('flex flex-wrap gap-1', mine ? 'justify-end' : 'justify-start')}>
          {reactions.map((reaction) => (
            <button
              key={reaction.reactionType}
              type="button"
              onClick={() => onReact(reaction.reactionType)}
              aria-pressed={reaction.viewerReacted}
              aria-label={`${reaction.reactionType} reaction, ${reaction.count} ${
                reaction.count === 1 ? 'person' : 'people'
              }${reaction.viewerReacted ? ', including you' : ''}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                reaction.viewerReacted
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-border bg-card text-muted-foreground',
              )}
            >
              <span>{reaction.reactionType}</span>
              <span className="tnum">{reaction.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
