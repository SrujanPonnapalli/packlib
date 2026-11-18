// One isometric floor slab: the side (thickness 2.5) and the top face.
const slab = (y: number) => ({
  side: `M5 ${y}L16 ${y + 5.5}L27 ${y}v2.5L16 ${y + 8}L5 ${y + 2.5}Z`,
  top: `M5 ${y}L16 ${y - 5.5}L27 ${y}L16 ${y + 5.5}Z`,
});

/** PackLib's mark: a building's floors, with one lifted off in Wolfpack Red, the way the explorer opens a floor. */
export default function Logo({ size = 20 }: { size?: number }) {
  const floors = [
    { ...slab(24), top_: "var(--color-ink)", side_: "var(--color-graphite)" },
    { ...slab(19), top_: "var(--color-ink)", side_: "var(--color-graphite)" },
    { ...slab(10), top_: "var(--color-wolfpack)", side_: "var(--color-wolfpack-deep)" },
  ];
  return (
    <svg width={size} height={size} viewBox="1 3 30 30" aria-hidden="true">
      {/* Paper-coloured strokes cut a thin gap between the faces. */}
      <g stroke="var(--color-paper)" strokeWidth="1.4" strokeLinejoin="round" paintOrder="stroke">
        {floors.map((f) => (
          <g key={f.top}>
            <path d={f.side} fill={f.side_} />
            <path d={f.top} fill={f.top_} />
          </g>
        ))}
      </g>
    </svg>
  );
}
