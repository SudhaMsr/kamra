import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useCountUp, useReveal } from "../lib/motion";
import { LuBadgeCheck, LuCircleCheck, LuHouse, LuShieldCheck, LuTriangleAlert, LuX } from "react-icons/lu";
import type { Fit } from "../domain/fit";
import type { Listing } from "../domain/types";
import { initials } from "../lib/format";

/* ---------- toasts (announced politely to screen readers) ---------- */
type Toast = { id: number; text: string; tone: "ok" | "error"; leaving?: boolean };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const regionRef = useRef<HTMLDivElement>(null);
  // The region is a manual popover so it lives in the browser's top layer: toasts show above open dialogs.
  // Re-showing it moves it to the top of that layer, above any dialog opened since.
  const raise = () => {
    const el = regionRef.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el?.showPopover) return;
    try { if (el.matches(":popover-open")) el.hidePopover?.(); el.showPopover(); } catch { /* unsupported: stays in normal flow */ }
  };
  useEffect(raise, []);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = ++seq.current;
    raise();
    setItems((x) => [...x.slice(-2), { id, text, tone }]);
    // Fade out first, then remove, so toasts leave as smoothly as they arrive.
    window.setTimeout(() => {
      setItems((x) => x.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      window.setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 240);
    }, tone === "error" ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div ref={regionRef} {...({ popover: "manual" } as Record<string, string>)} aria-live="polite" role="status"
        className="pointer-events-none fixed inset-x-0 bottom-20 top-auto z-50 m-0 flex h-auto w-auto flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-4 text-inherit md:bottom-6">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${t.leaving ? "anim-out" : "anim-rise"} ${t.tone === "error" ? "bg-warn text-white dark:text-paper" : "bg-ink text-paper"}`}>
            {t.tone === "error" ? <LuTriangleAlert aria-hidden className="mt-0.5 shrink-0" /> : <LuCircleCheck aria-hidden className="mt-0.5 shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- dialog (native <dialog>: focus trap, Esc to close) ---------- */
/** Modal dialog. `sheet` makes it a bottom sheet on phones (used for filters). */
export function Dialog({ open, onClose, title, children, wide, sheet }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; sheet?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref} aria-labelledby={titleId} onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      onKeyDown={(e) => {
        // Keep Tab inside the dialog instead of escaping to the browser toolbar.
        if (e.key !== "Tab" || !ref.current) return;
        const f = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-[2px] ${sheet ? "max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:open:anim-sheet sm:open:anim-scale-in" : "open:anim-scale-in"}`}
    >
      {open && (
        <div className="grid gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-xl font-bold">{title}</h2>
            <button type="button" onClick={onClose} className="btn-ghost -m-2 p-2" aria-label="Close"><LuX aria-hidden size={20} /></button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/* ---------- form field wrapper with accessible error wiring ---------- */
export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string; id: string; children: (a: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode }) {
  const desc = [hint && id + "-hint", error && id + "-err"].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="label">{label}</label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": desc })}
      {hint && <p id={id + "-hint"} className="hint">{hint}</p>}
      {error && <p id={id + "-err"} className="error anim-rise">{error}</p>}
    </div>
  );
}

/** Single-choice group rendered as chips with radio semantics and arrow-key support. */
export function ChoiceGroup<T extends string>({ label, value, options, onChange, name }: { label: string; name: string; value: T | undefined; options: Array<[T, string]>; onChange: (v: T) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const idx = Math.max(0, options.findIndex(([v]) => v === value));
  const move = (d: number) => { const n = (idx + d + options.length) % options.length; onChange(options[n][0]); refs.current[n]?.focus(); };
  return (
    <div className="grid gap-2">
      <span className="label" id={`${name}-label`}>{label}</span>
      <div role="radiogroup" aria-labelledby={`${name}-label`} className="flex flex-wrap gap-2"
        onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); } if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); } }}>
        {options.map(([v, l], i) => (
          <button key={v} type="button" role="radio" aria-checked={v === value} tabIndex={i === idx ? 0 : -1}
            ref={(el) => { refs.current[i] = el; }} onClick={() => onChange(v)} className="chip">{l}</button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange, id }: { label: string; checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
      <span className="text-sm font-semibold">{label}</span>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span aria-hidden className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-brand peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marigold" />
        <span aria-hidden className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Empty({ icon, title, body, action, page }: { icon: ReactNode; title: string; body: string; action?: ReactNode; page?: boolean }) {
  const H = page ? "h1" : "h2";
  return (
    <div className="card grid justify-items-center gap-3 px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand" aria-hidden>{icon}</div>
      <H className={page ? "text-2xl font-extrabold" : "text-lg font-bold"}>{title}</H>
      <p className="max-w-sm text-muted">{body}</p>
      {action}
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `oklch(0.52 0.13 ${hue})` }}>
      {initials(name)}
    </span>
  );
}

export function FitBadge({ fit, compact }: { fit: Fit; compact?: boolean }) {
  const shown = useCountUp(fit.pct);
  const tone = fit.pct >= 80 ? "bg-ok-soft text-ok" : fit.pct >= 50 ? "bg-marigold-soft text-ink dark:text-marigold" : "bg-warn-soft text-warn";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8rem] font-bold ${tone}`}>
      <span aria-hidden className="relative h-2 w-8 overflow-hidden rounded-full bg-current/20">
        <span className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-current" style={{ transform: `scaleX(${shown / 100})` }} />
      </span>
      <span aria-hidden className="tabular-nums">{shown}%{compact ? "" : " fit"}</span>
      <span className="sr-only">{fit.pct}% lifestyle match</span>
    </span>
  );
}

export function FitBreakdown({ fit }: { fit: Fit }) {
  return (
    <ul className="grid gap-2">
      {fit.rows.map((r, i) => (
        <li key={r.key} className="anim-rise stagger flex items-start gap-3 rounded-xl bg-raised px-3 py-2.5" style={{ "--i": i } as CSSProperties}>
          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-black ${r.ok ? "bg-ok text-paper" : "bg-warn text-paper"}`} aria-hidden>{r.ok ? "✓" : "!"}</span>
          <span className="grid">
            <span className="text-sm font-bold">{r.label} <span className={r.ok ? "text-ok" : "text-warn"}>· {r.ok ? "Match" : "Clash"}</span></span>
            <span className="text-sm text-muted">{r.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TrustTags({ l }: { l: Listing }) {
  return (
    <>
      {l.verified.id && <span className="tag tag-ok"><LuBadgeCheck aria-hidden />ID verified</span>}
      {l.verified.property && <span className="tag tag-ok"><LuHouse aria-hidden />Property verified</span>}
      {l.verified.visited && <span className="tag tag-ok"><LuShieldCheck aria-hidden />Kamra visited</span>}
    </>
  );
}

/* ---------- generated room artwork, used until the lister adds photos ---------- */
// [furniture, accent, light-theme wall, dark-theme wall]
const PALETTES = [
  ["#2a31a0", "#e8930c", "#f3ead8", "#262c63"], ["#13703f", "#e8930c", "#e9f1ea", "#163a2d"], ["#7a2f6b", "#f2b544", "#f4e7ee", "#3a2140"],
  ["#0f5c78", "#ef8a5a", "#e3eef3", "#16384a"], ["#4a3d9e", "#f0c24b", "#eceaf7", "#2b2660"],
];
export function RoomArt({ seed, className = "", label }: { seed: string; className?: string; label?: string }) {
  let h = 0; for (const c of seed) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  const [a, b, bg, bgDark] = PALETTES[h % PALETTES.length];
  const win = 20 + (h % 30), bedX = 120 + ((h >> 3) % 60), rug = (h >> 5) % 2 === 0;
  return (
    <svg viewBox="0 0 320 200" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={className} preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="200" fill={bg} className="dark:hidden" />
      <rect width="320" height="200" fill={bgDark} className="hidden dark:inline" />
      <rect y="150" width="320" height="50" fill={a} opacity=".12" />
      <rect x={win} y="28" width="70" height="62" rx="4" fill="#fff" className="opacity-85 dark:opacity-25" stroke={a} strokeWidth="4" />
      <line x1={win + 35} y1="28" x2={win + 35} y2="90" stroke={a} strokeWidth="3" />
      <circle cx={win + 52} cy="48" r="9" fill={b} />
      {rug && <ellipse cx="200" cy="175" rx="80" ry="12" fill={b} opacity=".35" />}
      <rect x={bedX} y="112" width="150" height="44" rx="8" fill={a} className="dark:brightness-150" />
      <rect x={bedX} y="100" width="14" height="60" rx="4" fill={a} />
      <rect x={bedX + 20} y="102" width="42" height="18" rx="7" fill="#fff" />
      <rect x={bedX + 66} y="104" width="80" height="12" rx="5" fill={b} />
      <rect x="22" y="118" width="40" height="42" rx="4" fill={b} opacity=".85" />
      <circle cx="42" cy="108" r="12" fill={a} opacity=".55" />
    </svg>
  );
}

/** A list item that rises into view when it's scrolled to. `i` staggers siblings. */
export function RevealItem({ i = 0, className = "", children }: { i?: number; className?: string; children: ReactNode }) {
  const ref = useReveal<HTMLLIElement>();
  return <li ref={ref} className={`stagger ${className}`} style={{ "--i": i } as CSSProperties}>{children}</li>;
}

/** A short confetti burst, used to celebrate a room being let. Purely decorative. */
export function Burst() {
  const bits = Array.from({ length: 16 }, (_, k) => {
    const angle = (k / 16) * Math.PI * 2 + (k % 2 ? 0.2 : -0.1);
    const dist = 46 + (k % 4) * 14;
    return { dx: `${Math.cos(angle) * dist}px`, dy: `${Math.sin(angle) * dist - 10}px`, rot: `${(k % 2 ? 1 : -1) * (120 + k * 20)}deg`, color: ["var(--marigold)", "var(--brand)", "var(--ok)"][k % 3] };
  });
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10">
      {bits.map((b, k) => (
        <span key={k} className="burst-bit absolute h-2 w-1.5 rounded-sm"
          style={{ background: b.color, "--dx": b.dx, "--dy": b.dy, "--rot": b.rot } as CSSProperties} />
      ))}
    </span>
  );
}

/** A number that counts up from 0 after an optional delay (instant with reduced motion). */
export function CountUp({ to, delay = 0 }: { to: number; delay?: number }) {
  const [go, setGo] = useState(delay === 0);
  useEffect(() => { if (delay) { const t = window.setTimeout(() => setGo(true), delay); return () => window.clearTimeout(t); } }, [delay]);
  const n = useCountUp(go ? to : 0);
  return <span className="tabular-nums">{n}</span>;
}
