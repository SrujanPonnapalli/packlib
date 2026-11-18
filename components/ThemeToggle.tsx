"use client";

import { flushSync } from "react-dom";
import { setTheme, useTheme } from "@/lib/theme";

// Both icons sit in the same cell; which one shows comes from <html data-theme> through the dark: variant, so it is right before hydration.
const ICON = "col-start-1 row-start-1 transition-[rotate,scale,opacity] duration-500 ease-out-quint";

/** Sun ↔ moon. The switch itself spreads out from the button as a circle where the browser can. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) return setTheme(next);
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const root = document.documentElement;
    root.style.setProperty("--tx", `${x}px`);
    root.style.setProperty("--ty", `${y}px`);
    root.style.setProperty("--tr", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    root.classList.add("theme-switching");
    const t = document.startViewTransition(() => flushSync(() => setTheme(next)));
    t.finished.finally(() => root.classList.remove("theme-switching"));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`grid size-8 shrink-0 place-items-center rounded-full text-graphite transition-[background-color,color,scale] duration-150 ease-out-quint hover:bg-vellum hover:text-ink active:scale-90 ${className}`}
    >
      {/* Sun in light, crescent moon in dark: one turns and shrinks away as the other turns in. */}
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className={`${ICON} dark:-rotate-90 dark:scale-50 dark:opacity-0`}>
        <circle cx="12" cy="12" r="4" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="12" y1="2.75" x2="12" y2="4.75" transform={`rotate(${a} 12 12)`} />
        ))}
      </svg>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" className={`${ICON} rotate-90 scale-50 opacity-0 dark:rotate-0 dark:scale-100 dark:opacity-100`}>
        <path d="M19.5 14.6A7.75 7.75 0 0 1 9.4 4.5a7.75 7.75 0 1 0 10.1 10.1Z" />
      </svg>
    </button>
  );
}
