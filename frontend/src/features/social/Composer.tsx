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

