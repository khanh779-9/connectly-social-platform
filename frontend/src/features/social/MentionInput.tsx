import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { avatarTone } from '@/lib/avatar';
import { activeMentionQuery, initials, searchMentionUsers } from '@/lib/social';
import { cn } from '@/lib/utils';
import type { ProfileDto } from '@/types/api';

export interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  onSubmit?: () => void;
  /** fired on Escape — used by the reply box to close itself */
  onCancel?: () => void;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Single-line text input with @mention autocomplete. Selecting a suggestion
 * inserts the handle at the caret; Enter/Arrow keys drive the list.
 */
export default function MentionInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  onSubmit,
  onCancel,
  autoFocus,
  className,
}: MentionInputProps) {
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<ProfileDto[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (query === null || !query) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchMentionUsers(query)
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          setActiveIndex(0);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  function applyMention(profile: ProfileDto) {
    const handle = profile.username;
    if (!handle) return;
    const input = inputRef.current;
    const caret = input?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const atIndex = before.lastIndexOf('@');
    if (atIndex < 0) return;
    onChange(`${value.slice(0, atIndex)}@${handle} ${value.slice(caret)}`);
    setQuery(null);
    setResults([]);
    window.requestAnimationFrame(() => {
      const position = atIndex + handle.length + 2;
      input?.focus();
      input?.setSelectionRange(position, position);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (query !== null && results.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % results.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        applyMention(results[activeIndex]);
        return;
      }
      if (event.key === 'Escape') {
        setQuery(null);
        setResults([]);
        onCancel?.();
        return;
      }
    }
    if (event.key === 'Escape') {
      onCancel?.();
      return;
    }
    if (event.key === 'Enter') {
      if (query !== null && results.length > 0) {
        event.preventDefault();
        applyMention(results[activeIndex]);
        return;
      }
      onSubmit?.();
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setQuery(activeMentionQuery(event.target.value, event.target.selectionStart ?? 0));
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          'h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring',
          className,
        )}
      />

      {query !== null && results.length > 0 && (
        <div className="absolute bottom-full left-0 z-30 mb-1 max-h-56 w-72 overflow-y-auto rounded border border-border bg-card shadow-lg">
          {results.map((profile, index) => (
            <button
              key={profile.userId}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                applyMention(profile);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                index === activeIndex ? 'bg-secondary' : 'hover:bg-secondary',
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
    </div>
  );
}
