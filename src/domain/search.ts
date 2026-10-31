import { z } from "zod";
import { distanceM } from "./geo";
import { fitListing, genderEligible, type Fit } from "./fit";
import { AMENITIES, CityZ, Diet, GenderRule, GuestRule, RoomType, type Listing, type Profile } from "./types";
import { landmarkById, landmarksIn } from "./landmarks";

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.string().optional().transform((s) => (s ? s.split(",").filter(Boolean) : [])).pipe(z.array(item).catch([]));

/** Parses URL query parameters into a safe search request. Invalid values fall back to defaults instead of failing. */
export const SearchQuery = z.object({
  city: CityZ.catch("Bengaluru"),
  near: z.string().optional().catch(undefined),
  radius: z.coerce.number().min(1).max(25).catch(5),
  max: z.coerce.number().int().min(1000).max(300000).optional().catch(undefined),
  room: csv(RoomType),
  diet: Diet.optional().catch(undefined),
  gender: GenderRule.optional().catch(undefined),
  guests: GuestRule.optional().catch(undefined),
  amen: csv(z.enum(AMENITIES)),
  sort: z.enum(["distance", "rent-asc", "rent-desc", "newest", "fit"]).catch("distance"),
  q: z.string().max(80).optional().catch(undefined),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

export type Result = { listing: Listing; distance: number; fit: Fit | null };

export function origin(q: SearchQuery): { lat: number; lng: number; label: string; id: string } {
  const lm = landmarkById(q.near);
  const pick = lm && lm.city === q.city ? lm : landmarksIn(q.city)[0];
  return { lat: pick.lat, lng: pick.lng, label: pick.name, id: pick.id };
}

export function search(all: Listing[], q: SearchQuery, profile: Profile | null): Result[] {
  const o = origin(q);
  const needle = q.q?.trim().toLowerCase();
  const results: Result[] = [];
  for (const l of all) {
    if (l.status !== "active" || l.city !== q.city) continue;
    const d = distanceM(o.lat, o.lng, l.lat, l.lng);
    if (d > q.radius * 1000) continue;
    if (q.max !== undefined && l.rent > q.max) continue;
    if (q.room.length && !q.room.includes(l.roomType)) continue;
    if (q.diet && l.diet !== q.diet) continue;
    if (q.gender && l.gender !== q.gender) continue;
    if (q.guests && rank(l.guests) < rank(q.guests)) continue;
    if (q.amen.length && !q.amen.every((a) => l.amenities.includes(a))) continue;
    if (needle && !`${l.title} ${l.locality} ${l.description}`.toLowerCase().includes(needle)) continue;
    if (profile && !genderEligible(l.gender, profile.gender)) continue;
    results.push({ listing: l, distance: d, fit: profile ? fitListing(l, profile) : null });
  }
  const by: Record<SearchQuery["sort"], (a: Result, b: Result) => number> = {
    distance: (a, b) => a.distance - b.distance,
    "rent-asc": (a, b) => a.listing.rent - b.listing.rent || a.distance - b.distance,
    "rent-desc": (a, b) => b.listing.rent - a.listing.rent || a.distance - b.distance,
    newest: (a, b) => b.listing.createdAt - a.listing.createdAt,
    fit: (a, b) => (b.fit?.pct ?? 0) - (a.fit?.pct ?? 0) || a.distance - b.distance,
  };
  return results.sort((a, b) => by[q.sort](a, b) || a.listing.id.localeCompare(b.listing.id));
}

const rank = (g: Listing["guests"]) => ({ none: 0, day: 1, overnight: 2 })[g];

/** Serialises a query back to URL parameters, omitting defaults. */
export function toParams(q: Partial<SearchQuery>): string {
  const p = new URLSearchParams();
  const put = (k: string, v: unknown) => { if (v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) p.set(k, Array.isArray(v) ? v.join(",") : String(v)); };
  put("city", q.city); put("near", q.near); if (q.radius !== undefined && q.radius !== 5) put("radius", q.radius);
  put("max", q.max); put("room", q.room); put("diet", q.diet); put("gender", q.gender); put("guests", q.guests);
  put("amen", q.amen); if (q.sort && q.sort !== "distance") put("sort", q.sort); put("q", q.q);
  return p.toString();
}
