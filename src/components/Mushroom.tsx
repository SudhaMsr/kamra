import { useId } from "react";

/*
 * Kamra's cute mushrooms: glossy gradient caps with cream polka dots, chubby cream bodies, big shiny eyes,
 * rosy cheeks and a tiny "w" smile. Character colours are fixed (not theme tokens) so the little guy looks the
 * same on light and dark backgrounds; all of them are decorative (aria-hidden).
 */

const EYE = "#2b1d24";
const BLUSH = "#f2705e";
export const CAPS = {
  red: ["#ffad45", "#ec4a2c", "#a92a1b"],
  gold: ["#ffe08a", "#f2a93b", "#b8701d"],
  brown: ["#e9b98a", "#b87a48", "#7c4c26"],
} as const;
type Cap = keyof typeof CAPS;

const safe = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");

/** Shared gradient definitions for a cap and a cream body. */
function Defs({ id, cap }: { id: string; cap: Cap }) {
  const [hi, mid, deep] = CAPS[cap];
  return (
    <defs>
      <radialGradient id={`${id}-cap`} cx="32%" cy="26%" r="80%">
        <stop offset="0" stopColor={hi} /><stop offset="0.42" stopColor={mid} /><stop offset="1" stopColor={deep} />
      </radialGradient>
      <radialGradient id={`${id}-body`} cx="40%" cy="35%" r="75%">
        <stop offset="0" stopColor="#fffaf0" /><stop offset="0.6" stopColor="#f6e8d0" /><stop offset="1" stopColor="#dcc4a0" />
      </radialGradient>
      <radialGradient id={`${id}-dot`} cx="35%" cy="30%" r="70%">
        <stop offset="0" stopColor="#fffdf6" /><stop offset="1" stopColor="#f0dfc4" />
      </radialGradient>
    </defs>
  );
}

function Eyes({ cx, cy, gap, r, look = "ahead" }: { cx: number; cy: number; gap: number; r: number; look?: "ahead" | "up" }) {
  const dy = look === "up" ? -r * 0.5 : 0;
  return (
    <g className="mascot-eyes">
      {[cx - gap, cx + gap].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={cy} rx={r} ry={r * 1.12} fill={EYE} />
          <circle cx={x + r * 0.35} cy={cy - r * 0.4 + dy} r={r * 0.38} fill="#fff" />
          <circle cx={x - r * 0.35} cy={cy + r * 0.4 + dy * 0.3} r={r * 0.17} fill="#fff" />
        </g>
      ))}
    </g>
  );
}

const Cheeks = ({ cx, cy, gap, r }: { cx: number; cy: number; gap: number; r: number }) => (
  <g fill={BLUSH} opacity="0.7">
    <ellipse cx={cx - gap} cy={cy} rx={r} ry={r * 0.66} /><ellipse cx={cx + gap} cy={cy} rx={r} ry={r * 0.66} />
  </g>
);

const Smile = ({ cx, cy, w }: { cx: number; cy: number; w: number }) => (
  <path d={`M${cx - w} ${cy}q${w / 2} ${w * 0.65} ${w} 0q${w / 2} ${w * 0.65} ${w} 0`} stroke={EYE} strokeWidth={w * 0.42} strokeLinecap="round" strokeLinejoin="round" fill="none" />
);

/** A glossy dome with polka dots, filling roughly x 6–114, y 6–76 in a 120-wide box. */
function Dome({ id, y = 0, spots }: { id: string; y?: number; spots: [number, number, number][] }) {
  return (
    <g transform={`translate(0 ${y})`}>
      {/* gills */}
      <ellipse cx="60" cy="70" rx="46" ry="8" fill="#e4cfae" />
      <path d="M24 70q8 4 14 5M42 72q8 3 16 3M66 75q8 0 16-3M86 74q6-1 12-4" stroke="#cdb38d" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M6 64C4 30 30 6 60 6s56 24 54 58c-1 8-14 9-54 9S7 72 6 64z" fill={`url(#${id}-cap)`} />
      {/* shine */}
      <ellipse cx="36" cy="24" rx="13" ry="6" transform="rotate(-28 36 24)" fill="#fff" opacity="0.32" />
      <circle cx="24" cy="38" r="2.6" fill="#fff" opacity="0.35" />
      {spots.map(([x, sy, r], i) => <circle key={i} cx={x} cy={sy} r={r} fill={`url(#${id}-dot)`} />)}
    </g>
  );
}

/** The mascot, sitting with its legs out. `lost` looks up, says "o" and sweats a little. */
export function Mascot({ size = 96, mood = "curious" }: { size?: number; mood?: "curious" | "lost" }) {
  const id = safe(useId());
  return (
    <svg viewBox="0 0 120 116" width={size} height={size * (116 / 120)} aria-hidden className="mascot block overflow-visible">
      <Defs id={id} cap="red" />
      <ellipse cx="60" cy="111" rx="40" ry="4.5" fill="#000" opacity="0.12" />
      <g className="mascot-body">
        {/* arms tucked at the sides */}
        <ellipse cx="27" cy="88" rx="7" ry="11" transform="rotate(18 27 88)" fill={`url(#${id}-body)`} />
        <ellipse cx="93" cy="88" rx="7" ry="11" transform={mood === "lost" ? "rotate(-40 93 80)" : "rotate(-18 93 88)"} fill={`url(#${id}-body)`} />
        {/* chubby body */}
        <path d="M32 66c-6 18-5 34 4 41 8 5 40 5 48 0 9-7 10-23 4-41z" fill={`url(#${id}-body)`} />
        {/* stubby legs */}
        <ellipse cx="42" cy="104" rx="13" ry="8" transform="rotate(-12 42 104)" fill="#fbf1e0" />
        <ellipse cx="80" cy="105" rx="12" ry="7.5" transform="rotate(10 80 105)" fill="#f3e3c8" />
        <Eyes cx={60} cy={82} gap={13} r={6} look={mood === "lost" ? "up" : "ahead"} />
        <Cheeks cx={60} cy={92} gap={21} r={6} />
        {mood === "lost" ? <ellipse cx="60" cy="93" rx="3" ry="3.6" fill={EYE} /> : <Smile cx={60} cy={91} w={4.5} />}
        <Dome id={id} spots={[[34, 20, 6.5], [60, 12, 4.5], [86, 22, 10], [26, 46, 7.5], [104, 46, 5.5], [64, 34, 5.5], [46, 36, 3.5]]} />
      </g>
      {mood === "lost" && (
        <>
          <path d="M100 58c3 4 4 7 1 9-3 1-5-2-4-5z" fill="#8fd0ff" />
          <text x="104" y="20" fontSize="22" fontWeight="800" fill="#f2a93b" className="mascot-q">?</text>
        </>
      )}
    </svg>
  );
}

/** A mushroom house for the hero village. `lit` warms its window eyes (the room for rent). */
export function MushroomHouse({ width, cap = "red", lit = false, delay = 0 }: { width: number; cap?: Cap; lit?: boolean; delay?: number }) {
  const id = safe(useId());
  const glow = lit ? { animation: `k-glow 1.4s var(--ease) ${300 + delay}ms both, k-breathe 4.5s ease-in-out ${1800 + delay}ms infinite` } : undefined;
  return (
    <svg viewBox="0 0 120 134" width={width} height={width * (134 / 120)} data-house={cap} className="block overflow-visible drop-shadow-[0_6px_6px_var(--dh-shadow)]">
      <Defs id={id} cap={cap} />
      {/* chubby stem */}
      <path d="M30 70c-5 20-6 40-2 52 3 7 13 10 32 10s29-3 32-10c4-12 3-32-2-52z" fill={`url(#${id}-body)`} />
      {/* round door with a step */}
      <path d="M50 132v-13a10 10 0 0 1 20 0v13z" fill="var(--dh-wood)" />
      <path d="M50 132v-13a10 10 0 0 1 10-10v23z" fill="var(--dh-wood-side)" />
      <circle cx="66" cy="123" r="1.6" fill="#ffd27a" />
      {lit ? (
        <>
          {/* window eyes that light up, with a happy face */}
          {[[42, 90], [78, 90]].map(([x, y]) => (
            <g key={x}>
              <circle cx={x} cy={y} r="8" fill="var(--dh-wood-side)" />
              <circle cx={x} cy={y} r="6" fill="#3b2c26" />
              <circle cx={x} cy={y} r="6" fill="#ffd27a" style={glow} />
              <path d={`M${x - 6} ${y}h12M${x} ${y - 6}v12`} stroke="var(--dh-wood-side)" strokeWidth="1.4" />
            </g>
          ))}
          <Cheeks cx={60} cy={101} gap={26} r={5} />
          <Smile cx={60} cy={100} w={3.5} />
        </>
      ) : (
        <>
          <Eyes cx={60} cy={92} gap={13} r={5} />
          <Cheeks cx={60} cy={101} gap={21} r={5} />
          <Smile cx={60} cy={100} w={3.5} />
        </>
      )}
      <Dome id={id} spots={[[34, 20, 6.5], [62, 12, 4.5], [88, 24, 9.5], [24, 48, 7], [104, 48, 5], [64, 36, 5.5]]} />
      {/* grass tufts */}
      <path d="M20 132c3-8 5-9 7-2 2-9 5-9 6 0M88 132c2-8 5-8 6 0 2-7 4-7 5 1" stroke="var(--moss)" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** The logo mark: the mascot's face in a rounded green tile. */
export function LogoMark({ size = 30, className = "" }: { size?: number; className?: string }) {
  const id = safe(useId());
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={className}>
      <Defs id={id} cap="red" />
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <path d="M19 36c-3 9-2 16 2 19 4 2 18 2 22 0 4-3 5-10 2-19z" fill={`url(#${id}-body)`} />
      <ellipse cx="26.5" cy="44" rx="2.6" ry="3" fill={EYE} /><ellipse cx="37.5" cy="44" rx="2.6" ry="3" fill={EYE} />
      <circle cx="27.4" cy="42.8" r="1" fill="#fff" /><circle cx="38.4" cy="42.8" r="1" fill="#fff" />
      <ellipse cx="21.5" cy="49" rx="2.6" ry="1.7" fill={BLUSH} opacity="0.75" /><ellipse cx="42.5" cy="49" rx="2.6" ry="1.7" fill={BLUSH} opacity="0.75" />
      <path d="M8 34C7 18 18 8 32 8s25 10 24 26c0 4-7 5-24 5S8 38 8 34z" fill={`url(#${id}-cap)`} />
      <ellipse cx="22" cy="17" rx="6" ry="3" transform="rotate(-28 22 17)" fill="#fff" opacity="0.32" />
      <circle cx="21" cy="25" r="3.4" fill="#fff8ec" /><circle cx="35" cy="15" r="2.6" fill="#fff8ec" /><circle cx="45" cy="27" r="4" fill="#fff8ec" />
    </svg>
  );
}
