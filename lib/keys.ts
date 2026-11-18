/**
 * Page shortcuts stay out of the way: not while typing, not with a modifier held (browser/OS
 * shortcuts), and not inside widgets that use the arrow keys themselves (tabs, radio groups, the chart).
 */
export function forPage(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return false;
  const t = e.target as HTMLElement | null;
  if (!t?.closest) return true;
  return !t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="tablist"], [role="radiogroup"], [role="img"][tabindex], dialog');
}
