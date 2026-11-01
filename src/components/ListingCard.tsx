import { LuBookmark, LuClock, LuLeaf, LuMapPin, LuUsers } from "react-icons/lu";
import { commuteMinutes, formatDistance } from "../domain/geo";
import type { Result } from "../domain/search";
import { GENDERS, ROOM_TYPES } from "../domain/types";
import { inr } from "../lib/format";
import { useTilt } from "../lib/motion";
import { Link } from "../lib/router";
import { FitBadge, RoomArt, TrustTags } from "./ui";

type Props = { result: Result; landmark: string; saved: boolean; onToggleSave: () => void; active?: boolean; onActivate?: (on: boolean) => void };

export function ListingCard({ result, landmark, saved, onToggleSave, active, onActivate }: Props) {
  const { listing: l, distance, fit } = result;
  const tiltRef = useTilt<HTMLElement>(2.5);
  return (
    <article
      ref={tiltRef}
      onMouseEnter={() => onActivate?.(true)} onMouseLeave={() => onActivate?.(false)}
      className={`card group relative grid overflow-hidden transition-[box-shadow,transform,translate] duration-[var(--t-fast)] ease-[var(--ease)] @xl:grid-cols-[13rem_1fr] ${active ? "-translate-y-0.5 shadow-md ring-2 ring-marigold" : "hover:-translate-y-0.5 hover:shadow-md"}`}
    >
      <div className="relative aspect-[16/9] bg-raised @xl:aspect-auto @xl:h-full">
        {l.photos[0]
          ? <img src={l.photos[0]} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          : <RoomArt seed={l.id} className="absolute inset-0 h-full w-full" />}
        <span className="absolute left-2 top-2 tag bg-surface/95 text-ink ring-1 ring-line">{ROOM_TYPES[l.roomType]}</span>
      </div>
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[1.05rem] font-bold leading-snug">
              <Link to={`/rooms/${l.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">{l.title}</Link>
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><LuMapPin aria-hidden className="shrink-0" />{l.locality}, {l.city}</p>
          </div>
          <p className="shrink-0 text-right">
            <span className="block font-mono text-lg font-semibold">{inr(l.rent)}</span>
            <span className="text-xs text-muted">per month</span>
          </p>
        </div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5"><LuClock aria-hidden className="text-muted" /><b>{formatDistance(distance)}</b><span className="text-muted">from {landmark}</span></span>
          <span className="text-muted">≈ {commuteMinutes(distance)} min commute</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {fit && <FitBadge fit={fit} />}
          <span className="tag">{GENDERS[l.gender]}</span>
          {l.diet === "pure-veg" && <span className="tag tag-ok"><LuLeaf aria-hidden />Pure veg</span>}
          {l.household.length > 0 && <span className="tag"><LuUsers aria-hidden />{l.household.length + 1} in flat</span>}
          <TrustTags l={l} />
        </div>
      </div>
      <button
        type="button" onClick={onToggleSave} aria-pressed={saved}
        aria-label={saved ? `Remove ${l.title} from saved` : `Save ${l.title}`}
        className={`absolute right-2 top-2 z-10 grid h-10 w-10 place-items-center rounded-full shadow @xl:left-[10.6rem] @xl:right-auto ${saved ? "bg-marigold text-[#22261b]" : "bg-surface/95 text-ink ring-1 ring-line hover:bg-marigold-soft"}`}
      >
        <LuBookmark key={String(saved)} aria-hidden className={saved ? "anim-pop fill-current" : ""} />
      </button>
    </article>
  );
}
