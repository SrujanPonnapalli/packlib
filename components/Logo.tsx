/** PackLib logo: library books on a shelf with the middle one highlighted. The uneven heights also look like a little bar chart. */
export default function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 16) / 18} viewBox="0 0 18 16" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round">
        <rect x="1.25" y="5" width="3" height="9.5" rx="0.5" fill="none" />
        <rect x="4.75" y="1.5" width="3.5" height="13" rx="0.5" fill="var(--color-accent)" />
        <rect x="12" y="4" width="3.25" height="10.5" rx="0.5" fill="none" transform="rotate(-16 12 14.5)" />
      </g>
      <path d="M0.75 14.75h16.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
