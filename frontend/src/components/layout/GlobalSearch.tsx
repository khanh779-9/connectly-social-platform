import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { avatarTone } from '@/lib/avatar';
import { initials, searchAll } from '@/lib/social';
import { cn } from '@/lib/utils';
import type { ProfileDto, SearchResultDto } from '@/types/api';

const EMPTY: SearchResultDto = { users: [], posts: [], groups: [], pages: [], events: [], hashtags: [] };

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResultDto>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Debounced query against the social search endpoint.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResult(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchAll(term, 6)
        .then((data) => {
          if (!cancelled) {
            setResult({
              users: data.users ?? [],
              posts: data.posts ?? [],
              groups: data.groups ?? [],
              pages: data.pages ?? [],
              events: data.events ?? [],
              hashtags: data.hashtags ?? [],
            });
            setOpen(true);
          }
        })
        .catch(() => {
          if (!cancelled) setResult(EMPTY);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  // Close on an outside click, and focus the field with ⌘K / Ctrl+K.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  /** Enter (or "See all results") opens the full search page instead of a suggestion. */
  function searchEverything() {
    const term = query.trim();
    if (term.length < 2) return;
    setOpen(false);
    setFocused(false);
    inputRef.current?.blur();
    navigate(`/search?q=${encodeURIComponent(term)}`);
  }

  function go(path: string) {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    navigate(path);
  }

  function clear() {
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  const otherResultCount =
    result.groups.length + result.pages.length + result.events.length + result.hashtags.length;
  const hasResults =
    result.users.length > 0 || result.posts.length > 0 || otherResultCount > 0;
  // The field stays compact until it is used, then it opens up for typing.
  const expanded = focused || query.length > 0 || open;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full min-w-0 transition-[max-width] duration-200',
        expanded ? 'max-w-xl' : 'max-w-[15rem]',
      )}
    >
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            searchEverything();
          }
          if (event.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        onFocus={() => {
          setOpen(true);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        placeholder="Search Connectly"
        aria-label="Search people and posts"
        className="h-9 w-full rounded-full border border-transparent bg-secondary pl-9 pr-9 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:bg-secondary-hover focus:border-ring focus:bg-card focus:ring-1 focus:ring-ring sm:pl-10 sm:pr-16"
      />

