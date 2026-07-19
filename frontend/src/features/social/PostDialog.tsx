import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PostCard from '@/features/social/PostCard';
import {
  ensureProfiles,
  fetchPost,
  getErrorMessage,
  removeBookmark,
  removeReaction,
  saveBookmark,
  setReaction,
} from '@/lib/social';
import type { PostDto, ProfileDto } from '@/types/api';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import Overlay from '@/components/ui/overlay';

/**
 * Post detail dialog opened from the "N comments" link on a feed card.
 * On small screens it becomes a full-screen sheet instead of a floating card.
 */
export default function PostDialog({
  postId,
  onClose,
}: {
  postId: string;
  onClose: () => void;
}) {
  const [post, setPost] = useState<PostDto | null>(null);
  const [author, setAuthor] = useState<ProfileDto | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useFocusTrap(true, { initialFocus: closeRef, returnFocus: closeRef });

  async function load() {
    setStatus('loading');
    setError(null);
    try {
      const found = await fetchPost(postId);
      setPost(found);
      setMyReaction(found.viewerReaction ?? null);
      setSaved(Boolean(found.viewerBookmarked));
      const resolved = await ensureProfiles([found.authorUserId]);
      setAuthor(resolved[found.authorUserId] ?? null);
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, [postId]);

  // Lock the page behind the dialog, move focus inside and close on Escape.
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

  async function handleReact(target: PostDto, type: string | null) {
    const previous = myReaction;
    setMyReaction(type);
    try {
      if (type) await setReaction(target.id, type);
      else await removeReaction(target.id);
    } catch {
      setMyReaction(previous);
    }
  }

  async function handleToggleBookmark(target: PostDto, wasSaved: boolean) {
    setSaved(!wasSaved);
    try {
      if (wasSaved) await removeBookmark(target.id);
      else await saveBookmark(target.id);
    } catch {
      setSaved(wasSaved);
    }
  }

