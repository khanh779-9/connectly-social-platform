import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import SafeImage from '@/components/ui/safe-image';
import {
  createHighlight,
  deleteHighlight,
  fetchHighlightStories,
  fetchHighlights,
  fetchMyHighlights,
  getErrorMessage,
} from '@/lib/social';
import type { HighlightDto, StoryDto } from '@/types/api';

export interface HighlightsBarProps {
  ownerUserId: string;
  isMe: boolean;
  /** when set, the owner can archive one of their own stories into a highlight */
  onOpenHighlight?: (highlight: HighlightDto, stories: StoryDto[]) => void;
}

/** Permanent story collections shown on a profile. */
export default function HighlightsBar({
  ownerUserId,
  isMe,
  onOpenHighlight,
}: HighlightsBarProps) {
  const [highlights, setHighlights] = useState<HighlightDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = isMe ? await fetchMyHighlights() : await fetchHighlights(ownerUserId);
      setHighlights(list);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ownerUserId, isMe]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createHighlight(title.trim());
      setHighlights((prev) => [...prev, created]);
      setTitle('');
      setCreating(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function open(highlight: HighlightDto) {
    try {
      const stories = await fetchHighlightStories(highlight.id);
      onOpenHighlight?.(highlight, stories);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function remove(highlight: HighlightDto) {
    setError(null);
    try {
      await deleteHighlight(highlight.id);
      setHighlights((prev) => prev.filter((item) => item.id !== highlight.id));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  // A visitor should not get an empty card when the profile has no highlights.
  if (!isMe && !loading && !error && highlights.length === 0) return null;

  return (
    <Card className="rounded border border-border bg-card p-3">
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {isMe && (
          <div className="w-[86px] shrink-0">
            <button
              type="button"
              onClick={() => setCreating((prev) => !prev)}
              className="flex w-[86px] flex-col items-center gap-1.5"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-input text-muted-foreground transition-colors hover:border-accent hover:text-accent">
                <Plus className="h-5 w-5" />
              </span>
              <span className="w-full truncate text-center text-[12px] text-muted-foreground">
                New highlight
              </span>
            </button>
          </div>
        )}

        {highlights.map((highlight) => (
          <div key={highlight.id} className="group relative w-[86px] shrink-0">
            <button
              type="button"
              onClick={() => open(highlight)}
              className="flex w-[86px] flex-col items-center gap-1.5"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-secondary">
                {highlight.coverUrl ? (
                  <SafeImage
                    src={highlight.coverUrl}
                    alt={highlight.title}
                    className="h-full w-full rounded-full object-cover"
                    fallbackLabel=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="text-[12px] font-semibold text-muted-foreground">
                    {highlight.title.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-[12px] text-muted-foreground">
                {highlight.title}
              </span>
            </button>
            {isMe && (
              <button
                type="button"
                aria-label={`Delete highlight ${highlight.title}`}
                onClick={() => remove(highlight)}
                className="absolute -right-0.5 -top-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {creating && isMe && (
        <form onSubmit={submit} className="mt-3 flex items-end gap-2 border-t border-border pt-3">
          <div className="flex-1">
            <label htmlFor="highlight-title" className="text-[13px] font-medium text-foreground">
              Highlight title
            </label>
            <input
              id="highlight-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={60}
              placeholder="e.g. Travel"
              className="mt-1 h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              aria-describedby={error ? 'highlight-error' : undefined}
            />
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={!title.trim() || saving}>
            {saving ? 'Saving…' : 'Create'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </form>
      )}

      {loading && (
        <p className="flex items-center justify-center gap-2 py-3 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading highlights…
        </p>
      )}

      {!loading && error && <p id="highlight-error" className="px-1 py-3 text-[12px] text-destructive" role="alert">{error}</p>}

      {!loading && !error && highlights.length === 0 && (
        <p className="px-1 py-3 text-[13px] text-muted-foreground">
          {isMe
            ? 'No highlights yet. Create one, then archive a story into it.'
            : 'No highlights yet.'}
        </p>
      )}
    </Card>
  );
}
