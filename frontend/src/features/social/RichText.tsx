import { Link } from 'react-router-dom';
import { splitRichText } from '@/lib/social';
import type { MentionDto } from '@/types/api';

export interface RichTextProps {
  text: string;
  /** resolved mentions of the content — used to turn @handle into a profile link */
  mentions?: MentionDto[] | null;
  className?: string;
}

/**
 * Renders post/comment bodies: hashtags link to the topic feed, @mentions link
 * to the mentioned profile. Handles that could not be resolved stay plain text.
 */
export default function RichText({ text, mentions, className }: RichTextProps) {
  const userIdByUsername = new Map(
    (mentions ?? []).map((mention) => [mention.username.toLowerCase(), mention.userId]),
  );

  return (
    <p className={className}>
      {splitRichText(text).map((segment, index) => {
        if (segment.hashtag) {
          return (
            <Link
              key={`${index}-tag`}
              to={`/hashtag/${encodeURIComponent(segment.hashtag)}`}
              className="text-accent hover:underline"
            >
              {segment.text}
            </Link>
          );
        }
        if (segment.mention) {
          const userId = userIdByUsername.get(segment.mention);
          if (!userId) return <span key={`${index}-mention`}>{segment.text}</span>;
          return (
            <Link
              key={`${index}-mention`}
              to={`/profile/${userId}`}
              className="font-medium text-accent hover:underline"
            >
              {segment.text}
            </Link>
          );
        }
        return <span key={`${index}-text`}>{segment.text}</span>;
      })}
    </p>
  );
}
