import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

// The head script in app/layout.tsx sets <html data-theme> before first paint
// using the same rule: the toggle's saved choice, otherwise the system's.
const KEY = "theme";
const listeners = new Set<() => void>();

const system = (): Theme => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const saved = (): Theme | null => {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
};
const current = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function apply(t: Theme) {
  document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l());
}

/** Picking the system theme clears the saved choice so the site follows the system again. */
export function setTheme(t: Theme) {
  try {
    if (t === system()) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  apply(t);
}

function subscribe(l: () => void) {
  listeners.add(l);
  const mq = matchMedia("(prefers-color-scheme: dark)");
  // while nothing is saved, follow the system live (e.g. macOS switching at sunset)
  const follow = () => saved() === null && apply(system());
  mq.addEventListener("change", follow);
  return () => {
    listeners.delete(l);
    mq.removeEventListener("change", follow);
  };
}

export const useTheme = () => useSyncExternalStore(subscribe, current, (): Theme => "light");
