import { LEVELS } from "@/data/hunt";

type ButtonProps = {
  n: number;
  landmark: string;
  count: number;
  on: boolean;
  dim: boolean;
  onClick: () => void;
  onHover?: (n: number | null) => void;
  /** Numeral only; the name and count move to the tooltip. */
  compact?: boolean;
};

export function LevelButton({ n, landmark, count, on, dim, onClick, onHover, compact }: ButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={compact ? `${landmark} · ${count} ${count === 1 ? "space" : "spaces"}` : undefined}
      aria-label={`Level ${n}, ${landmark}, ${count} ${count === 1 ? "space" : "spaces"}`}
      onClick={onClick}
      onPointerEnter={() => onHover?.(n)}
      onPointerLeave={() => onHover?.(null)}
      className={`group flex w-full items-center gap-2.5 rounded-md py-1 text-left transition-opacity duration-200 ${dim ? "opacity-50" : ""}`}
    >
      <span
        className={`plaque grid size-7 shrink-0 place-items-center rounded-md text-[18px] font-semibold leading-none transition-colors duration-200 sm:size-9 sm:text-[22px] ${
          on ? "bg-stair text-ink" : "text-ink group-hover:bg-vellum"
        }`}
      >
        {n}
      </span>
      <span className={compact ? "hidden" : "hidden min-w-0 sm:block"}>
        <span className="block truncate text-[13px] font-medium leading-tight">{landmark}</span>
        <span className="block text-[12px] leading-tight tabular-nums text-pencil">
          {count} {count === 1 ? "space" : "spaces"}
        </span>
      </span>
    </button>
  );
}

type Props = {
  active: number | null;
  counts: Record<number, number>;
  onSelect: (level: number | null) => void;
};

export default function LevelRail({ active, counts, onSelect }: Props) {
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Levels">
      {LEVELS.map(({ n, landmark }) => {
        const count = counts[n] ?? 0;
        return (
          <li key={n}>
            <LevelButton
              n={n}
              landmark={landmark}
              count={count}
              on={active === n}
              dim={(active !== null && active !== n) || count === 0}
              onClick={() => onSelect(active === n ? null : n)}
              compact
            />
          </li>
        );
      })}
    </ul>
  );
}
