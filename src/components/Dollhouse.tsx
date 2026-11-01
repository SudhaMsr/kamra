import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LuPause, LuPlay } from "react-icons/lu";
import { prefersReducedMotion } from "../lib/motion";

/*
 * A cut-away 3D flat built from CSS 3D transforms (no WebGL, no library).
 *
 * Floor plan, 340 × 260 px, viewed from the bottom-left corner (back walls run along the top and right edges):
 *
 *   ┌────────────────────┬───────────────┐
 *   │ Kitchen            │               │
 *   │  (counter)         │  Bedroom      │
 *   ├────────────────────┤  (the room    │
 *   │ Living room        │   for rent)   │
 *   │  (sofa)            │               │
 *   └────────────────────┴───────────────┘
 *
 * The story plays once on load (timings in ms), then idles with gentle loops:
 *   300 the bedroom lights up and an "Available" tag pops up
 *   900 flatmates appear in the kitchen and living room
 *  1500 match chips float up from the rooms they describe
 */

type V = CSSProperties & Record<`--${string}`, string | number>;

/** A box on the floor. Draws the three faces the camera can see: top, front (south) and left (west). */
function Box({ x, y, w, d, h, top, front, side, className = "" }: {
  x: number; y: number; w: number; d: number; h: number; top: string; front: string; side: string; className?: string;
}) {
  return (
    <div className={`absolute ${className}`} style={{ left: x, top: y, width: w, height: d }}>
      <div className="dh-face" style={{ inset: 0, background: top, transform: `translateZ(${h}px)` }} />
      <div className="dh-face" style={{ left: 0, top: d, width: w, height: h, background: front, transformOrigin: "top", transform: "rotateX(90deg)" }} />
      <div className="dh-face" style={{ left: 0, top: 0, width: h, height: d, background: side, transformOrigin: "left", transform: "rotateY(-90deg)" }} />
    </div>
  );
}

/** Something that always faces the camera, standing at a floor position. */
function Bill({ x, y, z = 0, className = "", style, children }: { x: number; y: number; z?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return <div className={`dh-bill ${className}`} style={{ left: x, top: y, "--z": `${z}px`, ...style } as V}>{children}</div>;
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

  // Fit the scene to its box: the flat is drawn at a fixed size and scaled to the available width.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width, h = e.contentRect.height;
      el.style.setProperty("--dh-scale", Math.max(0.45, Math.min(0.95, w / 540, h / 430)).toFixed(3));
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

  const floor = (bg: string, x: number, y: number, w: number, h: number) => (
    <div className="dh-face" style={{ left: x, top: y, width: w, height: h, background: bg }} />
  );

  return (
    <div className="relative h-full w-full">
      <div ref={rootRef} aria-hidden data-testid="dollhouse" className="dh-root absolute inset-0 overflow-hidden"
        data-paused={paused || undefined} data-offscreen={offscreen || undefined} data-static={isStatic || undefined}>
        {/* The entrance animates this wrapper, not the stage: animating opacity on the 3D root would flatten it. */}
        <div className="dh-view anim-rise">
        <div className="dh-stage">
          {/* soft shadow under the flat */}
          <div className="dh-face rounded-3xl" style={{ inset: -18, background: "var(--dh-shadow)", filter: "blur(14px)", transform: "translateZ(-2px)" }} />
          {/* floors: kitchen, living, bedroom */}
          {floor("var(--dh-floor-b)", 0, 0, 210, 120)}
          {floor("var(--dh-floor-c)", 0, 120, 210, 140)}
          {floor("var(--dh-floor-a)", 210, 0, 130, 260)}
          {/* the bedroom for rent lights up */}
          <div className="dh-face" style={{ left: 210, top: 0, width: 130, height: 260, transform: "translateZ(1px)",
            background: "radial-gradient(circle at 50% 55%, color-mix(in oklab, var(--marigold) 75%, transparent), transparent 70%)",
            animation: "k-glow 1.4s var(--ease) 300ms both, k-breathe 4.5s ease-in-out 1.8s infinite" }} />
          {/* back walls along the top and right edges, plus low partitions */}
          <Box x={0} y={-8} w={340} d={8} h={70} top="var(--dh-wall-side)" front="var(--dh-wall)" side="var(--dh-wall-side)" />
          <Box x={340} y={-8} w={8} d={268} h={70} top="var(--dh-wall-side)" front="var(--dh-wall-side)" side="var(--dh-wall)" />
          <Box x={206} y={0} w={4} d={96} h={34} top="var(--dh-wall-side)" front="var(--dh-wall-side)" side="var(--dh-wall)" />
          <Box x={206} y={170} w={4} d={90} h={34} top="var(--dh-wall-side)" front="var(--dh-wall-side)" side="var(--dh-wall)" />
          <Box x={0} y={118} w={130} d={4} h={26} top="var(--dh-wall-side)" front="var(--dh-wall)" side="var(--dh-wall-side)" />
          {/* furniture */}
          <Box x={244} y={130} w={78} d={110} h={16} top="var(--brand)" front="color-mix(in oklab, var(--brand) 70%, black)" side="color-mix(in oklab, var(--brand) 82%, black)" />
          <Box x={250} y={136} w={66} d={26} h={22} top="#f6f7ff" front="#dfe2f5" side="#e9ebfa" />
          <Box x={222} y={20} w={28} d={46} h={30} top="var(--dh-wood)" front="var(--dh-wood-side)" side="var(--dh-wood-side)" />
          <Box x={10} y={8} w={150} d={30} h={30} top="var(--dh-wood)" front="var(--dh-wood-side)" side="var(--dh-wood-side)" />
          <Box x={60} y={58} w={60} d={36} h={22} top="color-mix(in oklab, var(--dh-wood) 70%, white)" front="var(--dh-wood-side)" side="var(--dh-wood-side)" />
          <Box x={20} y={196} w={110} d={36} h={20} top="var(--marigold)" front="color-mix(in oklab, var(--marigold) 70%, black)" side="color-mix(in oklab, var(--marigold) 82%, black)" />
          <Box x={140} y={160} w={36} d={36} h={12} top="var(--dh-wood)" front="var(--dh-wood-side)" side="var(--dh-wood-side)" />

          {/* people and labels, always facing the camera */}
          {/* Animations go on an inner element: animating the billboard's own transform would undo its facing. */}
          <Bill x={286} y={168} z={64}>
            <div className="anim-pop" style={{ animationDelay: "550ms" }}>
              <div className="whitespace-nowrap rounded-xl bg-surface px-3 py-1.5 text-center shadow-lg ring-1 ring-line" style={{ animation: "k-bob 4.2s ease-in-out 1.2s infinite" }}>
                <div className="text-[0.68rem] font-bold uppercase tracking-wider text-ok">Available</div>
                <div className="font-mono text-sm font-semibold text-ink">₹16,500</div>
              </div>
            </div>
          </Bill>
          <Bill x={150} y={86} z={2}><Person color="oklch(0.55 0.13 160)" initials="MN" delay={900} /></Bill>
          <Bill x={110} y={176} z={2}><Person color="oklch(0.55 0.14 25)" initials="AR" delay={1100} /></Bill>
          <Bill x={70} y={30} z={70}><Chip tone="ok" delay={1500}>Kitchen ✓</Chip></Bill>
          <Bill x={150} y={86} z={104}><Chip tone="ok" delay={1700}>Work hours ✓</Chip></Bill>
          <Bill x={44} y={250} z={34}><Chip tone="warn" delay={1900}>Guests !</Chip></Bill>
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
