import { useState } from 'react';
import { VideoOff } from 'lucide-react';
import MediaPlaceholder from '@/components/ui/media-placeholder';
import SafeImage from '@/components/ui/safe-image';
import { cn } from '@/lib/utils';
import type { PostDto } from '@/types/api';

interface PostMediaProps {
  post: PostDto;
  threadMode: 'dialog' | 'inline';
  onOpenThread: () => void;
  failedVideos: Record<string, boolean>;
  onVideoError: (mediaId: string) => void;
}

export function PostMedia({
  post,
  threadMode,
  onOpenThread,
  failedVideos,
  onVideoError,
}: PostMediaProps) {
  if (post.media.length === 0) return null;

