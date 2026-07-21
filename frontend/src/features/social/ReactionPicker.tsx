import { REACTIONS } from './reactions';

interface ReactionPickerProps {
  onSelect: (type: string) => void;
  /** Keep the card open when the pointer moves onto it. */
  onPointerEnterCard?: () => void;
  onPointerLeaveCard?: () => void;
}

/**
 * Floating facebook-style reaction bar: a quick tap keeps the normal Like
 * behaviour, while hover (desktop) or long-press (touch) opens this card.
 */
export default function ReactionPicker({
  onSelect,
  onPointerEnterCard,
  onPointerLeaveCard,
}: ReactionPickerProps) {
  return (
    <div
      role="menu"
      aria-label="Pick a reaction"
      onPointerEnter={onPointerEnterCard}
      onPointerLeave={onPointerLeaveCard}
      className="absolute bottom-full left-0 z-30 mb-2 flex items-center gap-0.5 rounded border border-border bg-card p-1 shadow-md"
    >
      {REACTIONS.map((reaction) => (
        <button
          key={reaction.type}
          type="button"
          title={reaction.label}
          aria-label={reaction.label}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(reaction.type);
          }}
          className={cnReactionButton(reaction.type)}
        >
          <span className="text-lg leading-none transition-transform duration-100 group-hover:scale-125">
            {reaction.emoji}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Each reaction gets its accent color on hover, like its Facebook counterpart. */
function cnReactionButton(type: string): string {
  const base =
    'group flex h-9 w-9 items-center justify-center rounded-md transition-colors';
  switch (type) {
    case 'love':
    case 'angry':
      return `${base} hover:bg-destructive-soft`;
    case 'haha':
    case 'wow':
    case 'care':
      return `${base} hover:bg-secondary`;
    default:
      return `${base} hover:bg-secondary`;
  }
}
