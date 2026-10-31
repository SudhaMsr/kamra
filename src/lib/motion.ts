/** Small helpers for one-off animations that must not remount elements (which would drop focus). */
export const prefersReducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Shakes an element horizontally to signal "something here needs fixing". */
export function shake(el: Element | null | undefined) {
  if (!el || prefersReducedMotion() || typeof (el as HTMLElement).animate !== "function") return;
  (el as HTMLElement).animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(7px)" }, { transform: "translateX(-5px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }],
    { duration: 380, easing: "ease-in-out" },
  );
}
