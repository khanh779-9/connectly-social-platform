import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { PollDto } from '@/types/api';
import { votePoll } from '@/lib/social';

interface PostPollProps {
  poll: PollDto | null;
  votingPoll: boolean;
  onVote: (optionId: string) => void;
}

export function PostPoll({ poll, votingPoll, onVote }: PostPollProps) {
  if (!poll) return null;

  const pollTotalVotes = poll.totalVotes ?? 0;

  return (
    <div className="mt-3 rounded border border-border">
      <p className="px-3 pt-3 text-[14px] font-medium text-foreground">
        {poll.question}
      </p>
      <div className="space-y-1.5 p-3">
        {poll.options.map((option) => {
          const percent = pollTotalVotes > 0 ? Math.round((option.voteCount / pollTotalVotes) * 100) : 0;
          const voted = option.viewerVoted;
          return (
            <button
              key={option.id}
              type="button"
              disabled={votingPoll}
              onClick={() => onVote(option.id)}
              className={cn(
                'relative w-full overflow-hidden rounded border px-3 py-2 text-left text-[13px] transition-colors',
                voted
                  ? 'border-accent-action text-foreground'
                  : 'border-input text-foreground hover:bg-secondary',
                votingPoll && 'cursor-default opacity-80',
              )}
            >
              <span
                className={cn(
                  'absolute inset-y-0 left-0',
                  voted ? 'bg-secondary' : 'bg-secondary/60',
                )}
                style={{ width: `${percent}%` }}
              />
              <span className="relative flex items-center justify-between gap-3">
                <span className="truncate">
                  {option.text}
                  {voted && ' ✓'}
                </span>
                <span className="tnum text-[12px] text-muted-foreground">
                  {option.voteCount} · {percent}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="border-t border-border px-3 py-2 text-[12px] text-muted-foreground tnum">
        {poll.totalVotes} votes · {poll.options.length} options
        {poll.allowMultiple ? ' · multiple answers' : ''}
      </p>
    </div>
  );
}