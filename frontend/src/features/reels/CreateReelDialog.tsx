import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createReel, getErrorMessage, uploadMedia } from '@/lib/social';
import type { ReelDto } from '@/types/api';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import Overlay from '@/components/ui/overlay';

const VISIBILITIES = [
  { value: 0, label: 'Public' },
  { value: 1, label: 'Friends' },
  { value: 2, label: 'Only me' },
];

export interface CreateReelDialogProps {
  onClose: () => void;
  onCreated: (reel: ReelDto) => void;
}

/** Publish a reel: upload a vertical video, add a caption, choose the audience. */
export default function CreateReelDialog({ onClose, onCreated }: CreateReelDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useFocusTrap(true, { initialFocus: closeRef, returnFocus: closeRef });

  // revoke the preview URL when the dialog closes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile(next: File | null) {
    if (!next) return;
    if (!next.type.startsWith('video/')) {
      setError('A reel needs a video file.');
      return;
    }
    setFile(next);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(next));
  }

  async function submit() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const mediaAssetId = await uploadMedia(file, 'videos');
      const reel = await createReel({
        mediaAssetId,
        caption: caption.trim() || null,
        visibility,
      });
      onCreated(reel);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
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
    <Overlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create reel"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded border border-border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Create reel</p>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(event) => {
              pickFile(event.target.files?.[0] ?? null);
              event.target.value = '';
            }}
          />

          {previewUrl ? (
            <div className="relative overflow-hidden rounded border border-border bg-secondary">
              <video
                src={previewUrl}
                className="max-h-72 w-full object-contain"
                muted
                loop
                playsInline
                controls
              />
              <button
                type="button"
                aria-label="Remove video"
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                  setFile(null);
                }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded border border-dashed border-input bg-secondary/40 px-4 py-10 text-muted-foreground transition-colors hover:bg-secondary"
            >
              <Upload className="h-5 w-5" />
              <span className="text-[13px] font-medium text-foreground">Choose a video</span>
              <span className="text-[12px]">Vertical 9:16 works best</span>
            </button>
          )}

          <div>
            <label htmlFor="reel-caption" className="text-[13px] font-medium text-foreground">
              Caption
            </label>
            <textarea
              id="reel-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Say something… use #tags and @mentions"
              className="mt-1 w-full resize-none rounded border border-input bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              aria-describedby={error ? 'reel-create-error' : undefined}
            />
          </div>

          <div>
            <span className="text-[13px] font-medium text-foreground">Audience</span>
            <div className="mt-1 flex gap-2">
              {VISIBILITIES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVisibility(option.value)}
                  className={
                    visibility === option.value
                      ? 'flex-1 rounded border border-accent bg-secondary px-3 py-2 text-[13px] font-medium text-foreground'
                      : 'flex-1 rounded border border-input px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-secondary'
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p id="reel-create-error" className="text-[12px] text-destructive" role="alert">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!file || busy} onClick={submit}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Publishing…' : 'Publish reel'}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
