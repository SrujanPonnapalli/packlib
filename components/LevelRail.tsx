import { useLibrary } from "./LibraryContext";
import { BUSY_LABEL, type Busy } from "@/lib/occupancy";
import { BusyDot } from "./Busy";

type ButtonProps = {
  n: number;
  /** What the building calls the floor: "3", "G". */
  label: string;
  /** "Level" or "Floor". */
  word: string;
  landmark: string;
  count: number;
  on: boolean;
  dim: boolean;
  onClick: () => void;
  onHover?: (n: number | null) => void;
  /** Numeral only; the name and count move to the tooltip. */
  compact?: boolean;
  /** Live busyness, when the level has a sensor and a reading. */
  busy?: Busy | null;
};

export function LevelButton({ n, label, word, landmark, count, on, dim, onClick, onHover, compact, busy }: ButtonProps) {
  const spacesText = `${count} ${count === 1 ? "space" : "spaces"}`;
  const now = busy ? ` · ${BUSY_LABEL[busy]} now` : "";
  return (
    <button
      type="button"
      aria-pressed={on}
      title={compact ? `${landmark} · ${spacesText}${now}` : undefined}
      aria-label={`${word} ${label}, ${landmark}, ${spacesText}${now.replace(" ·", ",")}`}
      aria-keyshortcuts={label}
      onClick={onClick}
      onPointerEnter={() => onHover?.(n)}
      onPointerLeave={() => onHover?.(null)}
      className={`group flex w-full items-center gap-2.5 rounded-md py-1 text-left transition-opacity duration-200 ${dim ? "opacity-50" : ""}`}
    >
      <span
        className={`plaque relative grid size-10 shrink-0 place-items-center rounded-[5px] text-[21px] font-semibold leading-none transition-colors duration-200 sm:size-9 sm:text-[22px] ${
          on ? "bg-accent text-on-accent" : "text-ink group-hover:bg-vellum"
        }`}
      >
        {label}
        {busy && <BusyDot busy={busy} className="absolute -right-0.5 -top-0.5 ring-2 ring-paper" />}
      </span>
      <span className={compact ? "hidden" : "hidden min-w-0 sm:block"}>
        <span className="block truncate text-[13px] font-medium leading-tight">{landmark}</span>
        <span className="block text-[12px] leading-tight tabular-nums text-pencil">
          {spacesText}
          {busy && ` · ${BUSY_LABEL[busy]}`}
        </span>
      </span>
    </button>
  );
}

type Props = {
  active: number | null;
  counts: Record<number, number>;
  busy: Record<number, Busy | null>;
  onSelect: (level: number | null) => void;
};

export default function LevelRail({ active, counts, busy, onSelect }: Props) {
  const lib = useLibrary();
  // Eleven Hill floors need a tighter rail than Hunt's five, and tighter still on a short window.
  return (
    <ul className={`flex flex-col ${lib.levels.length > 6 ? "gap-0 [@media(max-height:780px)]:[&_button]:py-0" : "gap-1.5"}`} aria-label={`${lib.floorWord}s`}>
      {lib.levels.map(({ n, label, landmark }) => {
        const count = counts[n] ?? 0;
        return (
          <li key={n}>
            <LevelButton
              n={n}
              label={label}
              word={lib.floorWord}
              landmark={landmark}
              count={count}
              on={active === n}
              dim={(active !== null && active !== n) || count === 0}
              onClick={() => onSelect(active === n ? null : n)}
              busy={busy[n]}
              compact
            />
          </li>
        );
      })}
    </ul>
  );
}
