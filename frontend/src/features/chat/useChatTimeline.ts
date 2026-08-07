import { useLayoutEffect, useRef, useState } from 'react';
import type { ChatMessageDto } from '@/types/api';

/** How close to the bottom still counts as "the reader is at the newest message". */
const BOTTOM_THRESHOLD_PX = 72;

/** Reaching this point asks the page to load the previous messages. */
export const LOAD_OLDER_THRESHOLD_PX = 48;

function sentAtTime(message: ChatMessageDto): number {
  const value = Date.parse(message.sentAt);
  return Number.isNaN(value) ? 0 : value;
}

/** Chat is a timeline: the oldest message first, the newest one last. */
export function sortChatMessages(messages: ChatMessageDto[]): ChatMessageDto[] {
  return [...messages].sort((left, right) => {
    const time = sentAtTime(left) - sentAtTime(right);
    if (time !== 0) return time;
    return left.id.localeCompare(right.id);
  });
}

/** Adds new messages to the list without repeating one that is already there. */
export function mergeChatMessages(
  current: ChatMessageDto[],
  incoming: ChatMessageDto[],
): ChatMessageDto[] {
  const byId = new Map<string, ChatMessageDto>();
  current.forEach((message) => byId.set(message.id, message));
  incoming.forEach((message) => {
    if (!byId.has(message.id)) byId.set(message.id, message);
  });
  return sortChatMessages([...byId.values()]);
}

/** What we remember about the chat window from the previous render. */
interface TimelineSnapshot {
  conversationId: string;
  height: number;
  scrollTop: number;
  firstId: string | null;
  lastId: string | null;
}

/**
 * Keeps the chat window at the newest message until the reader scrolls away.
 * When older messages are loaded, the scroll position moves by the same height,
 * so the messages that were on screen stay where they were.
 */
export function useChatTimeline(messages: ChatMessageDto[], conversationId: string) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const previous = useRef<TimelineSnapshot>({
    conversationId: '',
    height: 0,
    scrollTop: 0,
    firstId: null,
    lastId: null,
  });

  function handleScroll() {
    const node = scrollRef.current;
    if (!node) return;

    const distanceFromBottom = node.scrollHeight - node.clientHeight - node.scrollTop;
    setAtBottom(distanceFromBottom <= BOTTOM_THRESHOLD_PX);
  }

