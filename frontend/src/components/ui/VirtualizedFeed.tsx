import { useEffect, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { PostCardSkeleton } from './skeleton';

interface VirtualizedFeedProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  className?: string;
  containerClassName?: string;
  loading?: boolean;
  skeletonCount?: number;
  emptyMessage?: string;
  loadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

/** Space between two rows, in pixels. */
const GAP = 8;

export function VirtualizedFeed<T>({
  items,
  renderItem,
  estimateSize = 200,
  overscan = 5,
  className,
  containerClassName,
  loading,
  skeletonCount = 5,
  emptyMessage = 'No items to display.',
  loadMore,
  hasMore,
  loadingMore,
}: VirtualizedFeedProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  // The whole page scrolls, the feed is only a part of it. So the virtualizer
  // needs to know how far the list starts from the top of the page.
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    setScrollMargin(listRef.current?.offsetTop ?? 0);
  }, [items.length]);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan,
    gap: GAP,
    scrollMargin,
  });

  // Ask for the next page when the reader gets close to the bottom.
  useEffect(() => {
    if (!loadMore || !hasMore || loadingMore) return;

    function onScroll() {
      const nearBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 600;
      if (nearBottom) loadMore?.();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMore, hasMore, loadingMore]);

  if (loading && items.length === 0) {
    return (
      <div ref={listRef} className={cn(containerClassName)}>
        <div className={cn('flex flex-col', className)} style={{ gap: GAP }}>
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <PostCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn('flex justify-center py-16 text-sm text-muted-foreground', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div ref={listRef} className={cn(containerClassName)}>
      <div
        className={cn('relative', className)}
        style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%' }}
      >
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${row.start}px)`,
            }}
          >
            {renderItem(items[row.index], row.index)}
          </div>
        ))}
      </div>

      {hasMore && !loadingMore && loadMore && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={loadMore}
            className="px-4 py-2 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
          >
            Load more
          </button>
        </div>
      )}

      {loadingMore && (
        <div className="flex justify-center py-8 text-muted-foreground">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
