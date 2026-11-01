import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

/** Small motion helpers. Everything here is a no-op when the person prefers reduced motion. */

export const prefersReducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const canAnimate = (el: Element | null | undefined): el is HTMLElement =>
  !!el && !prefersReducedMotion() && typeof (el as HTMLElement).animate === "function";

/** Shakes an element horizontally to signal "something here needs fixing". Doesn't remount, so focus is kept. */
export function shake(el: Element | null | undefined) {
  if (!canAnimate(el)) return;
  el.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(7px)" }, { transform: "translateX(-5px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }],
    { duration: 380, easing: "ease-in-out" },
  );
}

/** A quick hop, used to point at a map pin. */
export function bounce(el: Element | null | undefined) {
  if (!canAnimate(el)) return;
  el.animate([{ transform: "translateY(0)" }, { transform: "translateY(-7px)" }, { transform: "translateY(0)" }, { transform: "translateY(-2px)" }, { transform: "translateY(0)" }],
    { duration: 420, easing: EASE });
}

/**
 * True for a short moment whenever `key` changes, so a new search can show its loading state.
 * Computed during render (not after), so stale results never flash before the placeholders appear.
 */
export function useBriefLoading(key: string, ms = 450): boolean {
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    if (settled === key) return;
    const t = window.setTimeout(() => setSettled(key), prefersReducedMotion() ? 0 : ms);
    return () => window.clearTimeout(t);
  }, [key, settled, ms]);
  return settled !== key;
}

/**
 * FLIP list animation: children with data-flip-id that move between renders slide from their old position to the
 * new one. Only transform animates; new items keep their own CSS entrance.
 */
export function useFlip(container: RefObject<HTMLElement | null>, enabled: boolean) {
  const prev = useRef<Map<string, { left: number; top: number }>>(new Map());
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) { prev.current = new Map(); return; }
    const items = [...root.querySelectorAll<HTMLElement>("[data-flip-id]")];
    // Layout position (offsetLeft/Top) ignores in-flight transforms, so entrance animations never trigger a slide.
    const next = new Map(items.map((el) => [el.dataset.flipId!, { left: el.offsetLeft, top: el.offsetTop }]));
    if (enabled && prev.current.size && !prefersReducedMotion()) {
      for (const el of items) {
        const before = prev.current.get(el.dataset.flipId!);
        const after = next.get(el.dataset.flipId!)!;
        if (!before) continue; // new items run their own CSS entrance
        const dx = before.left - after.left, dy = before.top - after.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 360, easing: EASE });
      }
    }
    prev.current = enabled ? next : new Map();
  });
}

/** Counts up from 0 to `value` once when it first appears (or when the value changes). */
export function useCountUp(value: number, ms = 600): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  useEffect(() => {
    if (prefersReducedMotion()) { setShown(value); return; }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/**
 * Reveals an element with a short rise when it scrolls into view. Elements already on screen when the page loads
 * are left alone, and nothing is hidden if motion is reduced or IntersectionObserver isn't available.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.classList.add("reveal-pending");
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      el.classList.remove("reveal-pending");
      el.classList.add("anim-rise");
      io.disconnect();
    }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => { io.disconnect(); el.classList.remove("reveal-pending"); };
  }, []);
  return ref;
}

/** Runs a DOM-changing update as a View Transition (a short cross-fade) when the browser supports it. */
export function withViewTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || prefersReducedMotion()) { update(); return; }
  doc.startViewTransition(() => flushSync(update));
}

/**
 * Tilts an element a few degrees towards the pointer (desktop mice and trackpads only).
 * Writes an inline transform; nothing happens on touch screens or with reduced motion.
 */
export function useTilt<T extends HTMLElement>(maxDeg = 3) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { el.style.transform = `perspective(900px) rotateX(${(-ny * maxDeg).toFixed(2)}deg) rotateY(${(nx * maxDeg).toFixed(2)}deg)`; });
    };
    const leave = () => { cancelAnimationFrame(raf); el.style.transform = ""; };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, [maxDeg]);
  return ref;
}
