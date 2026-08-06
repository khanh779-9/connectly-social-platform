const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});

function parseMessageDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/**
 * A compact, exact timestamp for a chat bubble. Today's messages only need
 * the clock; older messages keep enough date context to remain unambiguous.
 */
export function formatChatMessageTime(iso: string): string {
  const date = parseMessageDate(iso);
  if (!date) return '';

  const now = new Date();
  const clock = timeFormatter.format(date);

  if (isSameCalendarDay(date, now)) return clock;

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })}, ${clock}`;
  }

  return `${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}, ${clock}`;
}
