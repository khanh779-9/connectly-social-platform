import { useEffect, useRef, useState } from 'react';
import { BarChart3, Image as ImageIcon, Loader2, Plus, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { avatarTone } from '@/lib/avatar';
import {
  activeMentionQuery,
  getErrorMessage,
  initials,
  searchMentionUsers,
  uploadMedia,
} from '@/lib/social';
import { cn } from '@/lib/utils';
import type { ProfileDto } from '@/types/api';

const VISIBILITIES = [
  { value: 0, label: 'Public' },
  { value: 1, label: 'Friends' },
  { value: 2, label: 'Only me' },
];

/** Id of the hidden file picker, so the "+" tile can open the same input. */
const IMAGE_INPUT_ID = 'composer-image-input';

// Character limit for posts (can be configured)
const MAX_POST_LENGTH = 5000;

export interface PollDraft {
  question: string;
  options: string[];
  allowMultiple: boolean;
}

export interface ComposerProps {
  me: ProfileDto | null;
  busy: boolean;
  error?: string | null;
  onPost: (
    content: string,
    mediaAssetIds: string[],
    visibility: number,
    poll?: PollDraft | null,
  ) => Promise<void> | void;
  /** Reports a failed image upload so the page can show it (`onPost` is never called). */
  onError?: (message: string) => void;
  /** Audience from Settings → Posting; preselected so the user rarely has to change it. */
  defaultVisibility?: number;
  /** Optional character limit override */
  maxLength?: number;
}

/**
 * Makes the textarea grow with the text, up to `maxRows` lines.
 */
function useAutoResizeTextarea(maxRows = 10) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [height, setHeight] = useState('auto');

  function adjustHeight() {
    const textarea = ref.current;
    if (!textarea) return;

    // Start from 'auto' so the browser reports the real height of the text.
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;

    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10) || 24;
    const maxHeight = lineHeight * maxRows;

    setHeight(`${Math.min(scrollHeight, maxHeight)}px`);
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  return { ref, height, adjustHeight };
}

export default function Composer({
  me,
  busy,
  error,
  onPost,
  onError,
  defaultVisibility = 0,
  maxLength = MAX_POST_LENGTH,
}: ComposerProps) {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState(defaultVisibility);

  // The setting can arrive after the first render (it is fetched with the profile).
  useEffect(() => {
    setVisibility(defaultVisibility);
  }, [defaultVisibility]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<ProfileDto[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-resize textarea
  const { ref: textareaRef, height, adjustHeight } = useAutoResizeTextarea(12);

  // The textarea follows the height of the text.
  useEffect(() => {
    adjustHeight();
  }, [content]);

  // The sidebar "New post" button dispatches this event.
  useEffect(() => {
    const focus = () => textareaRef.current?.focus();
    window.addEventListener('connectly:focus-composer', focus);
    return () => window.removeEventListener('connectly:focus-composer', focus);
  }, []);

  // Object URLs for the picked files; revoke them when the selection changes.
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  // Mention autocomplete: look up the @handle being typed at the caret.
  useEffect(() => {
    if (!mentionQuery) {
      setMentionResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchMentionUsers(mentionQuery)
        .then((results) => {
          if (cancelled) return;
          setMentionResults(results);
          setMentionIndex(0);
        })
        .catch(() => {
          if (!cancelled) setMentionResults([]);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mentionQuery]);

  /** Inserts the picked @handle at the caret and keeps the caret after it. */
  function applyMention(profile: ProfileDto) {
    const handle = profile.username;
    if (!handle) return;
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? content.length;
    const before = content.slice(0, caret);
    const atIndex = before.lastIndexOf('@');
    if (atIndex < 0) return;
    const next = `${content.slice(0, atIndex)}@${handle} ${content.slice(caret)}`;
    setContent(next);
    setMentionQuery(null);
    setMentionResults([]);
    window.requestAnimationFrame(() => {
      const position = atIndex + handle.length + 2;
      textarea?.focus();
      textarea?.setSelectionRange(position, position);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery === null || mentionResults.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setMentionIndex((prev) => (prev + 1) % mentionResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setMentionIndex((prev) => (prev - 1 + mentionResults.length) % mentionResults.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      applyMention(mentionResults[mentionIndex]);
    } else if (event.key === 'Escape') {
      setMentionQuery(null);
      setMentionResults([]);
    }
  }

  const visibilityLabel = VISIBILITIES.find((item) => item.value === visibility)?.label ?? 'Public';

  const filledOptions = pollOptions.map((option) => option.trim()).filter(Boolean);
  const pollReady = pollOpen && pollQuestion.trim().length > 0 && filledOptions.length >= 2;

  function resetPoll() {
    setPollOpen(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setAllowMultiple(false);
  }

  /** Empties the draft only once the post has actually been accepted. */
  function clearDraft() {
    setContent('');
    setFiles([]);
    resetPoll();
    setVisibility(defaultVisibility);
  }

  async function handleSubmit() {
    const text = content.trim();
    const hasPoll = pollReady;
    if ((!text && files.length === 0 && !hasPoll) || busy || uploading) return;
    try {
      await onPost(
        text,
        [],
        visibility,
        hasPoll
          ? { question: pollQuestion.trim(), options: filledOptions, allowMultiple }
          : null,
      );
      clearDraft();
    } catch (error) {
      // the text, images and poll stay so the user can retry
      onError?.(getErrorMessage(error));
    }
  }

  async function publish() {
    const text = content.trim();
    const hasPoll = pollReady;
    if ((!text && files.length === 0 && !hasPoll) || busy || uploading) return;
    setUploading(true);
    try {
      const mediaAssetIds = await Promise.all(files.map((file) => uploadMedia(file, 'post')));
      await onPost(
        text,
        mediaAssetIds,
        visibility,
        hasPoll
          ? { question: pollQuestion.trim(), options: filledOptions, allowMultiple }
          : null,
      );
      clearDraft();
    } catch (error) {
      onError?.(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  const charCount = content.length;
  const isNearLimit = charCount > maxLength * 0.8;
  const isOverLimit = charCount > maxLength;

  return (
    <Card className="rounded border border-border bg-card p-4">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10">
          {me?.avatarUrl ? <AvatarImage src={me.avatarUrl} alt={me.displayName} /> : null}
          <AvatarFallback style={avatarTone(me?.userId)}>
            {initials(me?.displayName)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(event) => {
                const newContent = event.target.value;
                // Allow typing over limit but prevent submission
                if (newContent.length <= maxLength) {
                  setContent(newContent);
                }
                setMentionQuery(activeMentionQuery(newContent, event.target.selectionStart ?? 0));
              }}
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind?"
              rows={2}
              style={{ height, minHeight: '56px' }}
              className="w-full resize-none rounded bg-transparent px-0 py-1 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground transition-colors"
              aria-describedby={error ? 'composer-error' : 'composer-char-count'}
              maxLength={maxLength}
            />
            {/* Character counter - appears on focus or when near limit */}
            <div
              id="composer-char-count"
              className={cn(
                'absolute bottom-1 right-2 text-[12px] font-medium transition-opacity duration-150',
                isOverLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : 'text-muted-foreground/60',
              )}
              aria-live="polite"
            >
              {charCount} / {maxLength}
            </div>
          </div>

          {/* Mention autocomplete */}
          {mentionQuery !== null && mentionResults.length > 0 && (
            <div className="mt-2 overflow-hidden rounded border border-border bg-card shadow-sm">
              {mentionResults.map((profile, index) => (
                <button
                  key={profile.userId}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyMention(profile);
                  }}
                  onMouseEnter={() => setMentionIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                    index === mentionIndex ? 'bg-secondary' : 'hover:bg-secondary',
                  )}
                >
                  <Avatar className="h-7 w-7">
                    {profile.avatarUrl ? (
                      <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                    ) : null}
                    <AvatarFallback style={avatarTone(profile.userId)}>
                      {initials(profile.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {profile.displayName}
                    </span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      @{profile.username ?? ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {previews.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {previews.map((url, index) => (
                <div key={url} className="relative overflow-hidden rounded border border-border">
                  <img src={url} alt="" className="h-28 w-full object-cover" decoding="async" />
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {/* Add more images placeholder when less than max */}
              {files.length < 4 && (
                <label
                  htmlFor={IMAGE_INPUT_ID}
                  className="flex h-28 w-full items-center justify-center rounded border-2 border-dashed border-border transition-colors hover:border-accent hover:bg-accent-soft cursor-pointer"
                >
                  <span className="text-muted-foreground/60">+</span>
                </label>
              )}
            </div>
          )}

          {pollOpen && (
            <div className="mt-3 space-y-2 rounded border border-border p-3">
              <input
                type="text"
                value={pollQuestion}
                onChange={(event) => setPollQuestion(event.target.value)}
                maxLength={300}
                placeholder="Poll question"
                aria-label="Poll question"
                className="h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              />
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(event) =>
                      setPollOptions((prev) =>
                        prev.map((item, i) => (i === index ? event.target.value : item)),
                      )
                    }
                    maxLength={140}
                    placeholder={`Option ${index + 1}`}
                    aria-label={`Poll option ${index + 1}`}
                    className="h-9 flex-1 rounded border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      aria-label="Remove option"
                      onClick={() =>
                        setPollOptions((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 6 && (
                <button
                  type="button"
                  onClick={() => setPollOptions((prev) => [...prev, ''])}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add option
                </button>
              )}
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={allowMultiple}
                  onChange={(event) => setAllowMultiple(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-input accent-[var(--accent)]"
                />
                Allow multiple answers
              </label>
            </div>
          )}

          {/*
            The picker has to live outside the preview block: the "Add images"
            button is what opens it, so it cannot wait for a preview to exist.
          */}
          <input
            ref={inputRef}
            id={IMAGE_INPUT_ID}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              if (picked.length > 0) setFiles((prev) => [...prev, ...picked.slice(0, 4 - prev.length)]);
              event.target.value = '';
            }}
          />

          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Add images"
              onClick={() => inputRef.current?.click()}
            >
              <ImageIcon className="h-[18px] w-[18px]" />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Add poll"
              aria-pressed={pollOpen}
              className={pollOpen ? 'text-accent' : undefined}
              onClick={() => (pollOpen ? resetPoll() : setPollOpen(true))}
            >
              <BarChart3 className="h-[18px] w-[18px]" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  {visibilityLabel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {VISIBILITIES.map((item) => (
                  <DropdownMenuItem
                    key={item.value}
                    onSelect={() => setVisibility(item.value)}
                    className={item.value === visibility ? 'bg-secondary' : undefined}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="primary"
              size="sm"
              className="ml-auto"
              disabled={
                (!content.trim() && files.length === 0 && !pollReady) || busy || uploading || isOverLimit
              }
              onClick={files.length > 0 ? publish : handleSubmit}
            >
              {(busy || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
              Post
            </Button>
          </div>

          {error && <p id="composer-error" className="mt-2 text-[12px] text-destructive" role="alert">{error}</p>}
        </div>
      </div>
    </Card>
  );
}
