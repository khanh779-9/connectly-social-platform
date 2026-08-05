import { useEffect, useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import SafeImage from '@/components/ui/safe-image';
import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/lib/utils';
import type { ChatAttachmentDto } from '@/types/api';
import Overlay from '@/components/ui/overlay';

/** How many tiles the grid shows before the rest collapses into a "+N" tile. */
const MAX_VISIBLE_TILES = 9;

export function isImageAttachment(attachment: ChatAttachmentDto): boolean {
  return attachment.contentType.startsWith('image/');
}

export function isVideoAttachment(attachment: ChatAttachmentDto): boolean {
  return attachment.contentType.startsWith('video/');
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Full-screen preview of one image; opens on click and closes with Esc. */
function ImageLightbox({
  attachments,
  index,
  onClose,
}: {
  attachments: ChatAttachmentDto[];
  index: number;
  onClose: () => void;
}) {
  const containerRef = useFocusTrap(true);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const current = attachments[index];
  if (!current) return null;

  return (
    <Overlay
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Xem trước ảnh"
      className="fixed inset-0 z-[var(--z-modal)] flex flex-col items-center justify-center gap-3 bg-black/90 p-4"
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 rounded-full text-white hover:bg-white/10 hover:text-white"
        aria-label="Đóng xem trước"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </Button>

      <SafeImage
        src={current.url}
        alt={current.fileName}
        className="max-h-[82vh] max-w-full rounded object-contain"
        fallbackLabel="Không tải được ảnh"
      />

      {attachments.length > 1 && (
        <div className="flex items-center gap-3 text-[13px] text-white/90">
          <button
            type="button"
            onClick={() => undefined}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <span className="tnum">
            {index + 1} / {attachments.length}
          </span>
          <a
            href={current.url}
            download={current.fileName}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Download className="h-4 w-4" />
            Tải xuống
          </a>
        </div>
      )}
    </Overlay>
  );
}

/**
 * The attachment block of a chat bubble. Images travel as a grouped mosaic —
 * one tile for a single picture, a grid for several — and everything else
 * falls back to a file row.
 */
export default function ChatAttachments({
  attachments,
  mine,
}: {
  attachments: ChatAttachmentDto[];
  mine: boolean;
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (attachments.length === 0) return null;

  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((item) => !isImageAttachment(item));
  const overflow = images.length - MAX_VISIBLE_TILES;

  return (
    <>
      {images.length > 0 && (
        <div
          className={cn(
            'grid gap-1',
            images.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
            images.length >= 5 && 'grid-cols-3',
          )}
        >
          {images.slice(0, MAX_VISIBLE_TILES).map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreviewIndex(index)}
              className={cn(
                'group relative block overflow-hidden rounded bg-secondary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                images.length === 1 ? 'max-h-[320px] w-full' : 'aspect-square',
              )}
              aria-label={`Xem trước ${item.fileName}`}
            >
              <SafeImage
                src={item.url}
                alt={item.fileName}
                loading="lazy"
                className={cn(
                  'w-full object-cover',
                  images.length === 1 ? 'max-h-[320px]' : 'h-full',
                )}
                fallbackLabel=""
              />
              {index === MAX_VISIBLE_TILES - 1 && overflow > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[18px] font-semibold text-white tnum">
                  +{overflow + 1}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className={cn('space-y-1', images.length > 0 && 'mt-2')}>
          {files.map((item) => (
            <li key={item.id}>
              <a
                href={item.url}
                download={item.fileName}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'flex items-center gap-2 rounded px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  mine
                    ? 'hover:bg-white/15 focus-visible:ring-accent-foreground/60'
                    : 'hover:bg-secondary focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    mine ? 'bg-white/20 text-accent-foreground' : 'bg-accent-soft text-accent',
                  )}
                >
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-[13px] font-medium',
                      mine ? 'text-accent-foreground' : 'text-foreground',
                    )}
                  >
                    {item.fileName}
                  </span>
                  <span
                    className={cn(
                      'block text-[12px]',
                      mine ? 'text-accent-foreground/80' : 'text-muted-foreground',
                    )}
                  >
                    {formatBytes(item.sizeBytes)}
                  </span>
                </span>
                <Download
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    mine ? 'text-accent-foreground/80' : 'text-muted-foreground',
                  )}
                />
              </a>
            </li>
          ))}
        </ul>
      )}

      {previewIndex !== null && (
        <ImageLightbox
          attachments={images}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  );
}
