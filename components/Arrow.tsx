/** Small right arrow for links, nudges right when its `group` parent is hovered. */
export default function Arrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="transition-transform duration-150 ease-[var(--ease-out-quint)] group-hover:translate-x-0.5">
      <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
