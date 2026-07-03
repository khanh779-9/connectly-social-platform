import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';

/**
 * One placeholder block. Skeletons are static on purpose: a pulsing feed
 * repaints the whole viewport every frame, which is the single most expensive
 * thing a low-end device can be asked to do while it waits for data.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded bg-secondary', className)}
      {...props}
    />
  );
}

/** The same grey block, kept separate so the shapes below stay readable. */
function Block({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded bg-secondary', className)} {...props} />;
}

/**
 * PostCard skeleton. It mirrors the real card - header, text, media and the
 * action row - so the feed does not jump when the posts arrive.
 */
export function PostCardSkeleton() {
  return (
    <article className="rounded border border-border bg-card">
      <div className="p-4 sm:p-5">
        {/* PostHeader */}
        <div className="flex items-start gap-3">
          <Block className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Block className="h-4 w-32" />
            <Block className="h-3 w-20" />
          </div>
          <Block className="h-6 w-6 shrink-0 rounded-full" />
        </div>

        {/* PostContent - the real text is 15px, so the lines are 15px tall too */}
        <div className="mt-3 space-y-2">
          <Block className="h-[15px] w-full" />
          <Block className="h-[15px] w-[92%]" />
          <Block className="h-[15px] w-[58%]" />
        </div>

        {/* PostMedia */}
        <div className="mt-3 aspect-[4/3] w-full overflow-hidden rounded-lg bg-secondary">
          <div className="grid h-full grid-cols-2 gap-1 p-0.5">
            <Block className="rounded-md" />
            <Block className="rounded-md" />
            <Block className="rounded-md" />
            <Block className="rounded-md" />
          </div>
        </div>

        {/* PostActions - icon plus label, the way the real row reads */}
        <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Block className="h-[18px] w-[18px] rounded-full" />
            <Block className="h-3 w-14" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Block className="h-[18px] w-[18px] rounded-full" />
            <Block className="h-3 w-12" />
          </div>
          <div className="ml-auto flex items-center gap-2 px-2 py-1.5">
            <Block className="h-[18px] w-[18px] rounded-full" />
            <Block className="h-3 w-10" />
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Story rail skeleton — matches StoryRail tile dimensions.
 */
export function StoryRailSkeleton({ count = 8 }: { count?: number } = {}) {
  return (
    <Card className="rounded border border-border bg-card p-3">
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex w-[86px] shrink-0 flex-col items-center gap-1.5">
            <Block className="h-16 w-16 rounded-full border-2 border-border" />
            <Block className="h-3 w-full rounded" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * Notification item skeleton.
 */
export function NotificationSkeleton() {
  return (
    <li className="border-b border-border px-4 py-3">
      <div className="flex items-start gap-3">
        <Block className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Block className="h-4 w-full" />
          <Block className="h-3 w-3/4" />
        </div>
      </div>
    </li>
  );
}

/**
 * Comment row skeleton.
 */
export function CommentRowSkeleton() {
  return (
    <div className="flex gap-3 pb-3">
      <Block className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <Block className="h-4 w-24" />
          <Block className="h-3 w-20" />
        </div>
        <Block className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export { Skeleton };
