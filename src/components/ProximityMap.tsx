import { useId } from "react";
import { LuBuilding2 } from "react-icons/lu";
import { formatCoord, formatDistance, toLocalXY } from "../domain/geo";
import type { Result } from "../domain/search";

type Props = {
  origin: { lat: number; lng: number; label: string };
  radiusKm: number;
  results: Result[];
  activeId: string | null;
  onActivate: (id: string | null) => void;
  onOpen: (id: string) => void;
};

/** Rings at "nice" distances that fit inside the search radius. */
function rings(radiusKm: number): number[] {
  const step = radiusKm <= 2 ? 0.5 : radiusKm <= 5 ? 1 : radiusKm <= 10 ? 2.5 : 5;
  const out: number[] = [];
  for (let r = step; r <= radiusKm + 1e-9; r += step) out.push(Number(r.toFixed(2)));
  return out;
}
const short = (rent: number) => (rent >= 100000 ? `₹${(rent / 100000).toFixed(1)}L` : `₹${Math.round(rent / 1000)}k`);

/**
 * A distance map around the search centre (equirectangular projection, north up).
 * Pins are real buttons laid over the SVG so they work with keyboard and screen readers.
 */
export function ProximityMap({ origin, radiusKm, results, activeId, onActivate, onOpen }: Props) {
  const gridId = "grid" + useId().replace(/:/g, "");
  const R = radiusKm * 1000;
  const pos = (lat: number, lng: number) => {
    const { x, y } = toLocalXY(origin.lat, origin.lng, lat, lng);
    return { left: 50 + (x / R) * 46, top: 50 - (y / R) * 46 };
  };
  const active = results.find((r) => r.listing.id === activeId) ?? null;
  const scaleKm = rings(radiusKm)[0];

  return (
    <figure className="card overflow-hidden">
      <div className="relative aspect-square w-full bg-map-land">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <pattern id={gridId} width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="var(--map-ring)" strokeWidth=".12" /></pattern>
          </defs>
          <rect width="100" height="100" fill={`url(#${gridId})`} />
          {rings(radiusKm).map((km) => (
            <g key={km}>
              <circle cx="50" cy="50" r={(km / radiusKm) * 46} fill="none" stroke="var(--map-ring)" strokeWidth=".35" strokeDasharray={km === radiusKm ? "0" : "1.2 1"} />
              <text x={50 + (km / radiusKm) * 46 * 0.707 + 0.8} y={50 - (km / radiusKm) * 46 * 0.707 - 0.8} fontSize="2.6" fill="var(--muted)" fontFamily="var(--font-mono)">{km} km</text>
            </g>
          ))}
          <circle cx="50" cy="50" r="46" fill="var(--brand)" opacity=".05" />
          <g transform="translate(92 9)">
            <path d="M0-4 2.4 2.5 0 1.2-2.4 2.5z" fill="var(--ink)" />
            <text y="6.6" fontSize="3" textAnchor="middle" fill="var(--ink)" fontWeight="700">N</text>
          </g>
          <g transform="translate(5 94)">
            <line x1="0" x2={(scaleKm / radiusKm) * 46} y1="0" y2="0" stroke="var(--ink)" strokeWidth=".6" />
            <line x1="0" x2="0" y1="-1.2" y2="1.2" stroke="var(--ink)" strokeWidth=".6" />
            <line x1={(scaleKm / radiusKm) * 46} x2={(scaleKm / radiusKm) * 46} y1="-1.2" y2="1.2" stroke="var(--ink)" strokeWidth=".6" />
            <text y="-2" fontSize="2.6" fill="var(--ink)" fontFamily="var(--font-mono)">{scaleKm} km</text>
          </g>
        </svg>

        <div className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2" title={origin.label}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-paper shadow-lg ring-4 ring-surface"><LuBuilding2 aria-hidden size={18} /></span>
          <span className="sr-only">Search centre: {origin.label}</span>
        </div>

        <ul aria-label="Rooms on the map" className="pointer-events-none absolute inset-0 z-10 m-0 list-none p-0">
          {results.map((r) => {
            const p = pos(r.listing.lat, r.listing.lng);
            const on = r.listing.id === activeId;
            return (
              <li key={r.listing.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r.listing.id)}
                  onMouseEnter={() => onActivate(r.listing.id)} onMouseLeave={() => onActivate(null)}
                  onFocus={() => onActivate(r.listing.id)} onBlur={() => onActivate(null)}
                  aria-label={`${r.listing.title}, ${r.listing.locality}, ${short(r.listing.rent)} a month, ${formatDistance(r.distance)} away`}
                  className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-full rounded-full px-2 py-0.5 font-mono text-[0.72rem] font-semibold shadow transition-transform ${on ? "z-20 scale-110 bg-marigold text-ink" : "z-10 bg-surface text-ink ring-1 ring-line hover:bg-marigold"}`}
                  style={{ left: `${p.left}%`, top: `${p.top}%` }}
                >
                  {short(r.listing.rent)}
                  <span aria-hidden className={`absolute left-1/2 top-full h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 ${on ? "bg-marigold" : "bg-surface"}`} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <figcaption className="grid gap-1 border-t border-line px-4 py-3 text-sm">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-semibold">Centre: {origin.label}</span>
          <span className="font-mono text-xs text-muted">{formatCoord(origin.lat, origin.lng)}</span>
        </span>
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-muted" aria-live="polite">
          {active ? (
            <>
              <span>{active.listing.locality} · {formatDistance(active.distance)} away</span>
              <span className="font-mono text-xs">{formatCoord(active.listing.lat, active.listing.lng)}</span>
            </>
          ) : <span>Hover or tab to a pin to see its exact coordinates.</span>}
        </span>
      </figcaption>
    </figure>
  );
}
