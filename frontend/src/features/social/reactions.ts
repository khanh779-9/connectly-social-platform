/** The Facebook-style fixed reaction set. Types are lowercase keys persisted by the backend. */
export interface ReactionDef {
  type: string;
  emoji: string;
  label: string;
}

export const REACTIONS: ReactionDef[] = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'care', emoji: '🥰', label: 'Care' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😡', label: 'Angry' },
];

export function reactionDef(type: string | null | undefined): ReactionDef {
  const normalized = (type ?? '').trim().toLowerCase();
  return (
    REACTIONS.find((item) => item.type === normalized) ?? REACTIONS[0]
  );
}
