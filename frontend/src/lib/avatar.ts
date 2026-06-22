/**
 * A stable pale tint per person, so a list of avatars is a list of people
 * rather than a row of identical grey circles. Hues stay clear of violet and
 * of the cream/terracotta pair the house rules reject.
 */
const HUES = [30, 90, 150, 210, 330];

function hash(seed: string): number {
  let value = 0;
  for (let i = 0; i < seed.length; i += 1) {
    value = (value * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return value;
}

export function avatarTone(seed?: string | null): {
  background: string;
  color: string;
} {
  if (!seed) {
    return { background: 'hsl(210 14% 93%)', color: 'hsl(213 12% 34%)' };
  }
  const hue = HUES[hash(seed) % HUES.length];
  return {
    background: `hsl(${hue} 44% 93%)`,
    color: `hsl(${hue} 42% 30%)`,
  };
}
