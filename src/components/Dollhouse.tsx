import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LuPause, LuPlay } from "react-icons/lu";
import { prefersReducedMotion } from "../lib/motion";
import { MushroomHouse } from "./Mushroom";

/*
 * The hero: a little mushroom village on a floating patch of moss, built from CSS 3D transforms
 * (no WebGL, no library). The ground, fence, logs and soil edge are real 3D faces; the houses, trees, people
 * and labels are billboards that always turn to face the camera, like a paper theatre.
 *
 * Ground plan, 340 × 260 px, viewed from the bottom-left corner (the fence runs along the top and right edges):
 *
 *   ┌──────────────────────────────────────┐
 *   │  tree        tree             tree   │
 *   │     small house                      │
 *   │                     BIG HOUSE        │
 *   │  small house        (room for rent)  │
 *   │        logs ~~ path ~~               │
 *   └──────────────────────────────────────┘
 *
 * The story plays once on load (timings in ms), then idles with gentle loops:
 *   300 the big house's windows light up and an "Available" tag pops up
 *   900 flatmates step out of the small houses
 *  1500 match chips float up like spores
 * In the dark theme, fireflies drift around the clearing.
 */

type V = CSSProperties & Record<`--${string}`, string | number>;

/** A box on the ground. Draws the three faces the camera can see: top, front (south) and left (west). */
function Box({ x, y, w, d, h, top, front, side, className = "", round = 0 }: {
  x: number; y: number; w: number; d: number; h: number; top: string; front: string; side: string; className?: string; round?: number;
}) {
  return (
    <div className={`absolute ${className}`} style={{ left: x, top: y, width: w, height: d }}>
      <div className="dh-face" style={{ inset: 0, background: top, transform: `translateZ(${h}px)`, borderRadius: round }} />
      <div className="dh-face" style={{ left: 0, top: d, width: w, height: h, background: front, transformOrigin: "top", transform: "rotateX(90deg)", borderRadius: round }} />
      <div className="dh-face" style={{ left: 0, top: 0, width: h, height: d, background: side, transformOrigin: "left", transform: "rotateY(-90deg)", borderRadius: round }} />
    </div>
  );
}

/** Something that always faces the camera, standing at a ground position. */
function Bill({ x, y, z = 0, className = "", style, children }: { x: number; y: number; z?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return <div className={`dh-bill ${className}`} style={{ left: x, top: y, "--z": `${z}px`, ...style } as V}>{children}</div>;
}

function Tree({ width, far = false }: { width: number; far?: boolean }) {
  const leaf = far ? "var(--tree-far)" : "var(--tree)";
  return (
    <svg viewBox="0 0 80 120" width={width} height={width * 1.5} className="block">
      <rect x="36" y="76" width="8" height="44" rx="3" fill="var(--dh-wood-side)" />
      <path d="M40 4 74 70H6z" fill={leaf} />
      <path d="M40 30 78 96H2z" fill={leaf} />
      <path d="M40 30 78 96H40z" fill="color-mix(in oklab, var(--moss-deep) 22%, transparent)" />
    </svg>
  );
}

function Person({ color, delay, initials }: { color: string; delay: number; initials: string }) {
  return (
    <div className="anim-pop" style={{ animationDelay: `${delay}ms` }}>
      <div className="grid justify-items-center" style={{ animation: `k-bob 3.4s ease-in-out ${delay + 600}ms infinite` }}>
        <div className="grid h-7 w-7 place-items-center rounded-full text-[0.62rem] font-bold text-white shadow ring-2 ring-white/80" style={{ background: color }}>{initials}</div>
        <div className="-mt-0.5 h-7 w-9 rounded-t-full shadow" style={{ background: color }} />
      </div>
    </div>
  );
}

function Chip({ children, tone, delay }: { children: ReactNode; tone: "ok" | "warn"; delay: number }) {
  return (
    <div style={{ animation: `k-chip-up 520ms var(--ease) ${delay}ms both` }}>
      <div className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[0.72rem] font-bold shadow-md ${tone === "ok" ? "bg-ok-soft text-ok ring-1 ring-ok/40" : "bg-warn-soft text-warn ring-1 ring-warn/40"}`}
        style={{ animation: `k-bob 4s ease-in-out ${delay + 700}ms infinite` }}>
        {children}
      </div>
    </div>
  );
}

const FIREFLIES: [number, number, number, number][] = [[60, 120, 60, 0], [170, 60, 90, 1.3], [300, 230, 70, 0.6], [140, 220, 40, 2.1], [250, 40, 110, 2.8], [20, 40, 80, 1.7]];

const lightDevice = () => {
  const n = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  return !!n.connection?.saveData || (typeof n.deviceMemory === "number" && n.deviceMemory <= 2);
};

export function Dollhouse({ children }: { children?: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [isStatic] = useState(() => prefersReducedMotion() || lightDevice());

  // Pointer tilt (desktop, fine pointers only), throttled to one update per frame.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || isStatic || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--tilt-z", `${(nx * 10).toFixed(2)}deg`);
        el.style.setProperty("--tilt-x", `${(-ny * 8).toFixed(2)}deg`);
      });
    };
    const reset = () => { cancelAnimationFrame(raf); el.style.setProperty("--tilt-z", "0deg"); el.style.setProperty("--tilt-x", "0deg"); };
    const area = el.closest("section") ?? el;
    area.addEventListener("pointermove", onMove as EventListener);
    area.addEventListener("pointerleave", reset);
    return () => { cancelAnimationFrame(raf); area.removeEventListener("pointermove", onMove as EventListener); area.removeEventListener("pointerleave", reset); };
  }, [isStatic]);

  // Fit the scene to its box: the village is drawn at a fixed size and scaled to the available width.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width, h = e.contentRect.height;
      el.style.setProperty("--dh-scale", Math.max(0.45, Math.min(0.95, w / 540, h / 470)).toFixed(3));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Freeze while scrolled away, so the loop costs nothing off-screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const fence = { top: "var(--dh-wood)", front: "var(--dh-wood-side)", side: "var(--dh-wood-side)" };

  return (
    <div className="relative h-full w-full">
      <div ref={rootRef} aria-hidden data-testid="dollhouse" className="dh-root absolute inset-0 overflow-hidden rounded-[2rem]"
        data-paused={paused || undefined} data-offscreen={offscreen || undefined} data-static={isStatic || undefined}>
        {/* sky behind the scene */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 70% 15%, var(--sky-a), var(--sky-b) 70%)" }} />
        {/* The entrance animates this wrapper, not the stage: animating opacity on the 3D root would flatten it. */}
        <div className="dh-view anim-rise">
        <div className="dh-stage">
          {/* soft shadow under the island */}
          <div className="dh-face rounded-[3rem]" style={{ inset: -20, background: "var(--dh-shadow)", filter: "blur(16px)", transform: "translateZ(-26px)" }} />
          {/* soil edge: the patch of ground floats like a diorama */}
          <div className="dh-face rounded-b-2xl" style={{ left: 0, top: 260, width: 340, height: 22, background: "var(--dh-wood-side)", transformOrigin: "top", transform: "rotateX(-90deg)" }} />
          <div className="dh-face rounded-b-2xl" style={{ left: 0, top: 0, width: 22, height: 260, background: "var(--dh-wood)", transformOrigin: "left", transform: "rotateY(90deg)" }} />
          {/* moss */}
          <div className="dh-face rounded-[1.5rem]" style={{ inset: 0, background:
            "radial-gradient(circle at 25% 30%, var(--moss) 0 18%, transparent 19%), radial-gradient(circle at 80% 75%, color-mix(in oklab, var(--moss) 80%, var(--glow)) 0 14%, transparent 15%), linear-gradient(135deg, var(--moss), var(--moss-deep))" }} />
          {/* stepping-stone path up to the big house */}
          {[[40, 236, 26], [78, 222, 22], [116, 212, 24], [154, 204, 20], [190, 196, 22], [222, 184, 18]].map(([x, y, s], i) => (
            <div key={i} className="dh-face rounded-full" style={{ left: x, top: y, width: s, height: s * 0.7, background: "var(--stem)", transform: "translateZ(1px)", boxShadow: "0 2px 0 var(--stem-shade)" }} />
          ))}
          {/* warm light spilling from the house for rent */}
          <div className="dh-face rounded-full" style={{ left: 190, top: 110, width: 140, height: 110, transform: "translateZ(1.5px)",
            background: "radial-gradient(closest-side, color-mix(in oklab, var(--glow) 70%, transparent), transparent)",
            animation: "k-glow 1.4s var(--ease) 300ms both, k-breathe 4.5s ease-in-out 1.8s infinite" }} />
          {/* a wooden fence along the back edges */}
          <Box x={0} y={-6} w={340} d={6} h={34} {...fence} />
          <Box x={340} y={-6} w={6} d={266} h={34} {...fence} />
          {/* logs to sit on */}
          <Box x={30} y={150} w={64} d={14} h={14} round={7} top="var(--dh-wood)" front="var(--dh-wood-side)" side="var(--stem-shade)" />
          <Box x={140} y={232} w={50} d={12} h={12} round={6} top="var(--dh-wood)" front="var(--dh-wood-side)" side="var(--stem-shade)" />

          {/* trees and houses, back to front; all billboards */}
          <Bill x={34} y={18}><Tree width={46} far /></Bill>
          <Bill x={150} y={12}><Tree width={58} /></Bill>
          <Bill x={326} y={70}><Tree width={52} far /></Bill>
          <Bill x={322} y={190}><Tree width={44} /></Bill>
          <Bill x={96} y={70}><div className="anim-pop" style={{ animationDelay: "150ms" }}><MushroomHouse width={74} cap="gold" /></div></Bill>
          <Bill x={62} y={200}><div className="anim-pop" style={{ animationDelay: "250ms" }}><MushroomHouse width={66} cap="brown" /></div></Bill>
          {/* the room for rent */}
          <Bill x={250} y={168}>
            <div className="grid justify-items-center">
              <div className="anim-pop" style={{ animationDelay: "550ms" }}>
                <div className="mb-1 whitespace-nowrap rounded-xl bg-surface px-3 py-1.5 text-center shadow-lg ring-1 ring-line" style={{ animation: "k-bob 4.2s ease-in-out 1.2s infinite" }}>
                  <div className="text-[0.68rem] font-bold uppercase tracking-wider text-ok">Available</div>
                  <div className="font-mono text-sm font-semibold text-ink">₹16,500</div>
                </div>
              </div>
              <div className="anim-pop" style={{ animationDelay: "50ms" }}><MushroomHouse width={124} lit /></div>
            </div>
          </Bill>

          {/* flatmates at their doors, and what they'd mean for you */}
          <Bill x={136} y={92} z={2}><Person color="oklch(0.5 0.12 150)" initials="MN" delay={900} /></Bill>
          <Bill x={106} y={226} z={2}><Person color="oklch(0.52 0.14 35)" initials="AR" delay={1100} /></Bill>
          <Bill x={70} y={40} z={110}><Chip tone="ok" delay={1500}>Kitchen ✓</Chip></Bill>
          <Bill x={176} y={110} z={96}><Chip tone="ok" delay={1700}>Work hours ✓</Chip></Bill>
          <Bill x={30} y={250} z={150}><Chip tone="warn" delay={1900}>Guests !</Chip></Bill>

          {/* fireflies (shown in the dark theme) */}
          {FIREFLIES.map(([x, y, z, d], i) => (
            <Bill key={i} x={x} y={y} z={z} className="dh-firefly">
              <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--glow)", boxShadow: "0 0 8px 3px color-mix(in oklab, var(--glow) 70%, transparent)", animation: `k-firefly ${5 + (i % 3)}s ease-in-out ${d}s infinite` }} />
            </Bill>
          ))}
        </div>
        </div>
      </div>
      {children}
      {!isStatic && (
        <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused}
          aria-label={paused ? "Play the home animation" : "Pause the home animation"}
          className="absolute bottom-3 left-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-surface/90 text-ink shadow ring-1 ring-line hover:bg-surface">
          {paused ? <LuPlay aria-hidden size={16} /> : <LuPause aria-hidden size={16} />}
        </button>
      )}
    </div>
  );
}
