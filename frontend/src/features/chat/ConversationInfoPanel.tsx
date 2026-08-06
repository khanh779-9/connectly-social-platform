import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Download, FileText, Loader2, Play, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import SafeImage from '@/components/ui/safe-image';
import { avatarTone } from '@/lib/avatar';
import {
  blockUser,
  fetchRelationship,
  getErrorMessage,
  initials,
  unblockUser,
} from '@/lib/social';
import { cn } from '@/lib/utils';
import type { ChatAttachmentDto, ChatMessageDto, ConversationDto, ProfileDto } from '@/types/api';

export interface ConversationInfoPanelProps {
  conversation: ConversationDto;
  /** display names / avatars resolved by the page */
  profiles: Record<string, ProfileDto | null>;
  /** the messages already loaded for this conversation — attachments come from here */
  messages: ChatMessageDto[];
  myId: string | null;
  /** true when older messages still live on the server, so the lists are partial */
  partialHistory?: boolean;
  onClose: () => void;
  className?: string;
}

/** Attachment plus the timestamp of the message it travelled with. */
type AttachmentRow = ChatAttachmentDto & { sentAt: string };

const MEDIA_PREVIEW_COUNT = 9;
const FILE_PREVIEW_COUNT = 4;

function isMedia(contentType: string): boolean {
  return contentType.startsWith('image/') || contentType.startsWith('video/');
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Right rail of the Messages page: who is in the conversation, the profile link
 * and everything that was attached to the loaded messages.
 */
export default function ConversationInfoPanel({
  conversation,
  profiles,
  messages,
  myId,
  partialHistory = false,
  onClose,
  className,
}: ConversationInfoPanelProps) {
  const [showAllMedia, setShowAllMedia] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const isGroup = conversation.type === 'group';
  const partner =
    conversation.members.find((member) => member.userId !== myId) ??
    conversation.members[0] ??
    null;
  const partnerProfile = partner ? profiles[partner.userId] ?? null : null;
  const title = isGroup
    ? conversation.title ?? 'Nhóm trò chuyện'
    : partnerProfile?.displayName ?? 'Hội thoại';
  const avatarUrl = isGroup ? null : partnerProfile?.avatarUrl ?? null;

  // Block state lives in the social service — read it when the panel opens.
  useEffect(() => {
    if (isGroup || !partner) {
      setBlocked(false);
      return;
    }
    let cancelled = false;
    setBlockError(null);
    fetchRelationship(partner.userId)
      .then((relationship) => {
        if (!cancelled) setBlocked(relationship.isBlocked);
      })
      .catch(() => {
        // an unreachable social service leaves the button in its default state
      });
    return () => {
      cancelled = true;
    };
  }, [isGroup, partner?.userId]);

  async function toggleBlock() {
    if (!partner || blockBusy) return;
    setBlockBusy(true);
    setBlockError(null);
    try {
      if (blocked) {
        await unblockUser(partner.userId);
        setBlocked(false);
      } else {
        await blockUser(partner.userId);
        setBlocked(true);
      }
    } catch (err) {
      setBlockError(getErrorMessage(err));
    } finally {
      setBlockBusy(false);
    }
  }

  const attachments = useMemo(() => {
    const rows: AttachmentRow[] = [];
    messages.forEach((message) => {
      if (message.status === 'deleted') return;
      message.attachments.forEach((attachment) => {
        rows.push({ ...attachment, sentAt: message.sentAt });
      });
    });
    // newest first, like the file lists in other messengers
    rows.sort((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt));
    return rows;
  }, [messages]);

  const media = attachments.filter((item) => isMedia(item.contentType));
  const files = attachments.filter((item) => !isMedia(item.contentType));
  const visibleMedia = showAllMedia ? media : media.slice(0, MEDIA_PREVIEW_COUNT);
  const visibleFiles = showAllFiles ? files : files.slice(0, FILE_PREVIEW_COUNT);

  return (
    <aside
      id="conversation-info"
      aria-label="Thông tin hội thoại"
      className={cn('flex min-h-0 flex-col overflow-hidden border border-border bg-card', className)}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="min-w-0 truncate text-[15px] font-semibold text-foreground">
          Thông tin hội thoại
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Đóng thông tin hội thoại"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-quiet">
        {/* Identity */}
        <div className="flex flex-col items-center gap-1.5 border-b border-border px-4 py-5 text-center">
          <Avatar className="h-20 w-20">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={title} /> : null}
            <AvatarFallback
              className="text-xl font-semibold"
              style={avatarTone(isGroup ? conversation.id : partner?.userId)}
            >
              {initials(title)}
            </AvatarFallback>
          </Avatar>
          <p className="max-w-full truncate text-[15px] font-semibold text-foreground">{title}</p>
          <p className="text-[12px] text-muted-foreground">
            {isGroup
              ? `${conversation.members.length} thành viên`
              : partner?.online
                ? 'Đang hoạt động'
                : 'Tin nhắn riêng'}
          </p>
          <div className="mt-1 flex flex-col items-center gap-1 text-[12px] text-muted-foreground">
            <span>Tạo ngày {formatDate(conversation.createdAt)}</span>
            {!isGroup && partner ? (
              <Link
                to={`/profile/${partner.userId}`}
                className="font-medium text-accent hover:underline"
              >
                Xem trang cá nhân
              </Link>
            ) : null}
          </div>

          {!isGroup && partner && (
            <div className="mt-3 w-full">
              <Button
                variant={blocked ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full"
                disabled={blockBusy}
                aria-pressed={blocked}
                onClick={toggleBlock}
              >
                {blockBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                {blocked ? 'Bỏ chặn' : 'Chặn người này'}
              </Button>
              {blocked && (
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  Hai bên không thể gửi tin nhắn cho nhau khi bị chặn.
                </p>
              )}
              {blockError && (
                <p className="mt-1.5 text-[12px] text-destructive" role="alert">
                  {blockError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Members (only meaningful for a group) */}
        {isGroup && (
          <section className="border-b border-border px-4 py-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Thành viên ({conversation.members.length})
            </h3>
            <ul className="mt-2 space-y-0.5">
              {conversation.members.map((member) => {
                const profile = profiles[member.userId] ?? null;
                const name =
                  profile?.displayName ?? (member.userId === myId ? 'Bạn' : 'Thành viên');
                return (
                  <li key={member.userId}>
                    <Link
                      to={`/profile/${member.userId}`}
                      className="flex items-center gap-2 rounded px-1 py-1 transition-colors hover:bg-secondary"
                    >
                      <Avatar className="h-7 w-7">
                        {profile?.avatarUrl ? (
                          <AvatarImage src={profile.avatarUrl} alt={name} />
                        ) : null}
                        <AvatarFallback className="text-[12px]" style={avatarTone(member.userId)}>
                          {initials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                        {name}
                      </span>
                      {member.role !== 'member' && (
                        <span className="shrink-0 text-[12px] capitalize text-muted-foreground">
                          {member.role}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Photos & videos */}
        <section className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ảnh/Video
            </h3>
            <span className="text-[12px] text-muted-foreground tnum">{media.length}</span>
          </div>

          {media.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Chưa có ảnh hoặc video nào trong hội thoại này.
            </p>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {visibleMedia.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    title={item.fileName}
                    className="relative block aspect-square overflow-hidden rounded border border-border bg-secondary"
                  >
                    {item.contentType.startsWith('image/') ? (
                      <SafeImage
                        src={item.url}
                        alt={item.fileName}
                        loading="lazy"
                        className="h-full w-full object-cover"
                        fallbackLabel=""
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-[#111315] text-white/90">
                        <Play className="h-5 w-5" />
                      </span>
                    )}
                  </a>
                ))}
              </div>
              {media.length > MEDIA_PREVIEW_COUNT && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setShowAllMedia((open) => !open)}
                >
                  {showAllMedia ? 'Thu gọn' : `Xem tất cả ${media.length}`}
                </Button>
              )}
            </>
          )}
        </section>

        {/* Files */}
        <section className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              File
            </h3>
            <span className="text-[12px] text-muted-foreground tnum">{files.length}</span>
          </div>

          {files.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Chưa có file nào được gửi trong hội thoại này.
            </p>
          ) : (
            <>
              <ul className="mt-2 space-y-0.5">
                {visibleFiles.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded px-1 py-1.5 transition-colors hover:bg-secondary"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-foreground">
                          {item.fileName}
                        </span>
                        <span className="block text-[12px] text-muted-foreground">
                          {formatBytes(item.sizeBytes)} · {formatDate(item.sentAt)}
                        </span>
                      </span>
                      <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  </li>
                ))}
              </ul>
              {files.length > FILE_PREVIEW_COUNT && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setShowAllFiles((open) => !open)}
                >
                  {showAllFiles ? 'Thu gọn' : `Xem tất cả ${files.length}`}
                </Button>
              )}
            </>
          )}
        </section>

        {partialHistory && (
          <p className="px-4 pb-4 text-[12px] leading-relaxed text-muted-foreground">
            Chỉ tính trên các tin nhắn đã tải. Cuộn lên trong hội thoại để tải thêm tệp cũ.
          </p>
        )}
      </div>
    </aside>
  );
}
