/**
 * The Connectly mark: three nodes joined by two lines. Drawn for the product
 * rather than a letter in a box.
 */
export default function ConnectlyMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="Connectly"
    >
      <rect width="24" height="24" rx="4" fill="#15181c" />
      <path
        d="M8 8.5 16 15.5M16 8.5 8 15.5"
        stroke="#7d858e"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8.5" r="2.5" fill="#3fb3a6" />
      <circle cx="16" cy="8.5" r="2.5" fill="#ffffff" />
      <circle cx="12" cy="15.5" r="2.5" fill="#ffffff" />
    </svg>
  );
}
