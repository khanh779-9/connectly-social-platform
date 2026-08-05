import { useEffect, useRef, useState } from 'react';
import { FileText, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** One pending upload: the browser file plus a preview URL for images. */
export interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
}

const MAX_FILES = 10;

/**
 * Turns the picked files into the tray above the composer. Image previews are
 * object URLs, so they are revoked as soon as the file leaves the tray.
 */
export function usePendingAttachments() {
  const [pending, setPending] = useState<PendingAttachment[]>([]);

  const add = (files: File[]) => {
    if (files.length === 0) return;
    setPending((prev) => {
      const room = MAX_FILES - prev.length;
      if (room <= 0) return prev;
      return [
        ...prev,
        ...files.slice(0, room).map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        })),
      ];
    });
  };

  const remove = (id: string) => {
    setPending((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const clear = () => {
    setPending((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  };

  return { pending, add, remove, clear };
}

/** The paperclip that opens the file picker. */
export function AttachmentButton({
  onPick,
  disabled,
}: {
  onPick: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          if (picked.length > 0) onPick(picked);
          event.target.value = '';
        }}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Đính kèm tệp tin"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-[18px] w-[18px]" />
      </Button>
    </>
  );
}

/** The strip of files waiting to be sent, above the composer input. */
export default function ChatAttachmentTray({
  pending,
  onRemove,
}: {
  pending: PendingAttachment[];
  onRemove: (id: string) => void;
}) {
  if (pending.length === 0) return null;

  const images = pending.filter((item) => item.previewUrl);
  const files = pending.filter((item) => !item.previewUrl);

  return (
    <div className="border-t border-border px-4 py-3">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((item) => (
            <div
              key={item.id}
              className="relative h-20 w-20 overflow-hidden rounded border border-border bg-secondary"
            >
              <img
                src={item.previewUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <button
                type="button"
                aria-label={`Bỏ ${item.file.name}`}
                onClick={() => onRemove(item.id)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className={cn('space-y-1', images.length > 0 && 'mt-2')}>
          {files.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded border border-border bg-secondary/50 px-2 py-1.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground">
                  {item.file.name}
                </span>
                <span className="block text-[12px] text-muted-foreground">
                  {Math.max(1, Math.round(item.file.size / 1024))} KB
                </span>
              </span>
              <button
                type="button"
                aria-label={`Bỏ ${item.file.name}`}
                onClick={() => onRemove(item.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
