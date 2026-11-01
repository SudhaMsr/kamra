import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Small looping SVG scenes for "How it works". They only animate while on screen; off screen (or with reduced
 * motion) they hold a designed still frame. Purely decorative: the step text beside them carries the meaning.
 */
function Scene({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPlaying(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} aria-hidden data-scene={label} className={`scene overflow-hidden rounded-xl bg-raised ${playing ? "is-playing" : ""}`}>
      <svg viewBox="0 0 160 96" className="block h-28 w-full">{children}</svg>
    </div>
  );
}

/** Step 1: a pin drops onto a tech park while the radar pulses. */
export function SearchScene() {
  return (
    <Scene label="search">
      <g opacity=".5" stroke="var(--map-ring)" strokeWidth=".6">
        {[24, 48, 72, 96, 120, 144].map((x) => <path key={x} d={`M${x} 0V96`} />)}
        {[24, 48, 72].map((y) => <path key={y} d={`M0 ${y}H160`} />)}
      </g>
      <circle cx="80" cy="62" r="34" fill="none" stroke="var(--brand)" strokeWidth="1.2" className="anim-ring" />
      <circle cx="80" cy="62" r="34" fill="none" stroke="var(--brand)" strokeWidth="1.2" className="anim-ring" style={{ animationDelay: "1.2s" }} />
      <g>
        <rect x="70" y="52" width="20" height="18" rx="2" fill="var(--ink)" />
        <path d="M74 56h3M79 56h3M84 56h3M74 61h3M79 61h3M84 61h3" stroke="var(--paper)" strokeWidth="1.6" />
      </g>
      <g className="anim-pin">
        <path d="M112 44c0-7 5-12 11-12s11 5 11 12c0 8-11 18-11 18s-11-10-11-18z" fill="var(--marigold)" />
        <circle cx="123" cy="44" r="4" fill="var(--surface)" />
      </g>
    </Scene>
  );
}

/** Step 2: lifestyle chips slide in and snap into a profile card. */
export function ProfileScene() {
  const chips = [["Pure veg", "var(--ok)"], ["Day job", "var(--brand)"], ["No smoking", "var(--marigold)"]] as const;
  return (
    <Scene label="profile">
      <rect x="34" y="10" width="92" height="76" rx="8" fill="var(--surface)" stroke="var(--line)" />
      <circle cx="50" cy="26" r="8" fill="var(--brand)" />
      <rect x="62" y="20" width="44" height="5" rx="2.5" fill="var(--ink)" opacity=".8" />
      <rect x="62" y="28" width="30" height="4" rx="2" fill="var(--muted)" opacity=".7" />
      {chips.map(([t, c], i) => (
        <g key={t} className="anim-snap" style={{ animationDelay: `${i * 0.35}s` }}>
          <rect x="42" y={42 + i * 13} width={t.length * 4.6 + 12} height="10" rx="5" fill={c} opacity=".18" />
          <text x="48" y={49.5 + i * 13} fontSize="6.4" fontWeight="700" fill={c}>{t}</text>
        </g>
      ))}
    </Scene>
  );
}

/** Step 3: a chat bubble, then the door opens and the key turns. */
export function MoveInScene() {
  return (
    <Scene label="move-in">
      <rect x="82" y="16" width="44" height="70" rx="3" fill="var(--marigold)" opacity=".35" />
      <rect x="78" y="12" width="52" height="76" rx="4" fill="none" stroke="var(--ink)" strokeWidth="2.4" />
      <g className="anim-door">
        <rect x="82" y="16" width="44" height="70" rx="2" fill="var(--brand)" />
        <circle cx="120" cy="52" r="2.4" fill="var(--marigold)" />
      </g>
      <g className="anim-bubble">
        <rect x="20" y="22" width="48" height="26" rx="10" fill="var(--surface)" stroke="var(--line)" />
        <path d="M30 48l-4 8 12-8" fill="var(--surface)" stroke="var(--line)" />
        {[34, 44, 54].map((x) => <circle key={x} cx={x} cy="35" r="2.6" fill="var(--muted)" />)}
      </g>
      <g className="anim-key">
        <circle cx="46" cy="66" r="6" fill="none" stroke="var(--marigold)" strokeWidth="3" />
        <path d="M52 66h18M64 66v5M68 66v4" stroke="var(--marigold)" strokeWidth="3" strokeLinecap="round" />
      </g>
    </Scene>
  );
}
