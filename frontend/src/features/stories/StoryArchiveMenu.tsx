import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  addStoryToHighlight,
  createHighlight,
  fetchMyHighlights,
  getErrorMessage,
} from '@/lib/social';
import type { HighlightDto } from '@/types/api';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import Overlay from '@/components/ui/overlay';

export interface StoryArchiveMenuProps {
  storyId: string;
  onClose: () => void;
  onArchived: (highlight: HighlightDto) => void;
}

// Pick a highlight to archive one of your stories into (the story leaves the 24h rail).
export default function StoryArchiveMenu({ storyId, onClose, onArchived }: StoryArchiveMenuProps) {
  const [highlights, setHighlights] = useState<HighlightDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useFocusTrap(true, { initialFocus: closeRef, returnFocus: closeRef });

  async function load() {
    setLoading(true);
    try {
      setHighlights(await fetchMyHighlights());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function archive(highlight: HighlightDto) {
    setBusyId(highlight.id);
    setError(null);
    try {
      await addStoryToHighlight(highlight.id, storyId);
      onArchived(highlight);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function createAndArchive(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusyId('new');
    setError(null);
    try {
      const highlight = await createHighlight(title.trim());
      await addStoryToHighlight(highlight.id, storyId);
      onArchived(highlight);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <Overlay
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Archive story into highlight"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded border border-border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Save to highlight</p>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {loading && (
            <p className="flex items-center justify-center gap-2 py-6 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          )}

          {!loading && highlights.length === 0 && !creating && (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
              You have no highlights yet. Create one below.
            </p>
          )}

          {highlights.map((highlight) => (
            <button
              key={highlight.id}
              type="button"
              disabled={busyId !== null}
              onClick={() => archive(highlight)}
              className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-secondary disabled:opacity-70"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[12px] font-semibold text-muted-foreground">
                {highlight.title.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                {highlight.title}
              </span>
              {busyId === highlight.id && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </button>
          ))}
        </div>

        {creating ? (
          <form onSubmit={createAndArchive} className="flex items-end gap-2 border-t border-border p-3">
            <div className="flex-1">
              <label htmlFor="archive-highlight-title" className="text-[13px] font-medium text-foreground">
                New highlight
              </label>
              <input
                id="archive-highlight-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={60}
                autoFocus
                placeholder="e.g. Travel"
                className="mt-1 h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
                aria-describedby={error ? 'archive-error' : undefined}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!title.trim() || busyId !== null}
            >
              {busyId === 'new' ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <div className="border-t border-border p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreating(true)}
              className="w-full"
            >
              <Plus className="h-3.5 w-3.5" />
              New highlight
            </Button>
          </div>
        )}

        {error && <p id="archive-error" className="px-4 pb-3 text-[12px] text-destructive" role="alert">{error}</p>}
      </div>
    </Overlay>
  );
}
