import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Heart,
  Loader2,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
  VideoOff,
  X,
} from 'lucide-react';
import MediaPlaceholder from '@/components/ui/media-placeholder';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { avatarTone } from '@/lib/avatar';
import { cn } from '@/lib/utils';
import RichText from '@/features/social/RichText';
import {
  ensureProfiles,
  fetchComments,
  getErrorMessage,
  initials,
  postComment,
  recordReelView,
} from '@/lib/social';
import type { CommentDto, ProfileDto, ReelDto } from '@/types/api';
import Overlay from '@/components/ui/overlay';

export interface ReelPlayerProps {
  reels: ReelDto[];
  startIndex: number;
  onClose: () => void;
  /** update the reel in the parent list (counts, viewer state) */
  onUpdate?: (reel: ReelDto) => void;
  onToggleReaction?: (reel: ReelDto) => void;
  onToggleBookmark?: (reel: ReelDto) => void;
  onShare?: (reel: ReelDto) => void;
}

/** Only report a view after the reel was watched for this long. */
const MIN_WATCH_MS = 500;

/**
 * Full-screen vertical player: one reel at a time, arrow-key navigation,
 * a comment overlay and view/watch-time reporting.
 */
export default function ReelPlayer({
  reels,
  startIndex,
  onClose,
  onUpdate,
  onToggleReaction,
  onToggleBookmark,
  onShare,
}: ReelPlayerProps) {
  const [index, setIndex] = useState(startIndex);
  // Start muted: browsers block autoplay with sound, which left the reel on its
  // first frame. The viewer can unmute from the header.
  const [muted, setMuted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, ProfileDto | null>>({});
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  // watch time per reel id — accumulated while the reel is on screen
  const watchedRef = useRef<Record<string, number>>({});
  const reportedRef = useRef<Set<string>>(new Set());
  const currentIdRef = useRef<string | null>(null);
  const reelsRef = useRef(reels);
  reelsRef.current = reels;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const current = reels[index] ?? null;

  /** Sends the watch time of a reel to the backend (once per reel). */
  const reportView = useCallback((reelId: string) => {
    const watched = Math.round(watchedRef.current[reelId] ?? 0);
    if (watched < MIN_WATCH_MS || reportedRef.current.has(reelId)) return;
    reportedRef.current.add(reelId);
    const reel = reelsRef.current.find((item) => item.id === reelId);
    if (!reel) return;
    recordReelView(reelId, watched)
      .then((updated) => onUpdateRef.current?.(updated))
      .catch(() => undefined);
  }, []);

  // load the creator profiles of the visible reels
  useEffect(() => {
    const ids = reels.map((reel) => reel.authorUserId);
    ensureProfiles(ids).then((resolved) => setProfiles((prev) => ({ ...prev, ...resolved })));
  }, [reels]);

  // reset the player whenever the active reel changes
  useEffect(() => {
    if (!current) return;
    setError(null);
    setVideoFailed(false);
    setComments([]);
    setCommentDraft('');
    setCommentsOpen(false);
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      const attempt = video.play();
      if (attempt) attempt.catch(() => undefined);
    }
  }, [current]);

  // the mute state is applied without restarting the playback
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted]);

  // report the reel we are leaving (and the last one when the player closes)
  useEffect(() => {
    const previous = currentIdRef.current;
    if (previous && previous !== current?.id) reportView(previous);
    currentIdRef.current = current?.id ?? null;
  }, [current, reportView]);

  useEffect(() => {
    return () => {
      if (currentIdRef.current) reportView(currentIdRef.current);
    };
  }, [reportView]);

  // keyboard navigation
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex((prev) => Math.min(prev + 1, reels.length - 1));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((prev) => Math.max(prev - 1, 0));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reels.length]);

  // lock body scroll while the player is open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // load comments when the overlay opens
  useEffect(() => {
    if (!commentsOpen || !current) return;
    let cancelled = false;
    fetchComments(current.id)
      .then((items) => {
        if (!cancelled) setComments(items);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [commentsOpen, current]);

  async function handleSendComment() {
    const content = commentDraft.trim();
    if (!content || !current) return;
    setSending(true);
    setError(null);
    try {
      const created = await postComment(current.id, content);
      setComments((prev) => [...prev, created]);
      setCommentDraft('');
      onUpdateRef.current?.({ ...current, commentCount: current.commentCount + 1 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (!current) return null;

  const author = profiles[current.authorUserId] ?? null;
  const liked = Boolean(current.viewerReaction);

  return (
    <Overlay
      role="dialog"
      aria-modal="true"
      aria-label="Reels"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
    >
      <div className="relative flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-[#111315]">
        {/* header */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 py-3 text-white">
          <button
            type="button"
            aria-label="Close reels"
            onClick={() => onCloseRef.current()}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
          <span className="text-[13px] font-medium">Reels</span>
          <button
            type="button"
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={() => setMuted((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>

        {/* video */}
        <div className="flex h-full w-full items-center justify-center">
          {videoFailed ? (
            <MediaPlaceholder
              icon={VideoOff}
              label="This reel cannot be played right now."
              size="md"
              className="h-full w-full px-6 text-white/90"
            />
          ) : (
            <video
              ref={videoRef}
              key={current.id}
              src={current.url}
              className="h-full w-full object-contain"
              muted={muted}
              loop
              playsInline
              autoPlay
              onError={() => setVideoFailed(true)}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                const previous = watchedRef.current[`pos:${current.id}`] ?? 0;
                if (video.currentTime > previous) {
                  watchedRef.current[current.id] =
                    (watchedRef.current[current.id] ?? 0) +
                    (video.currentTime - previous) * 1000;
                }
                watchedRef.current[`pos:${current.id}`] = video.currentTime;
              }}
            />
          )}
        </div>

