import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LuList, LuMap, LuRotateCcw, LuSearch, LuSlidersHorizontal } from "react-icons/lu";
import { ListingCard } from "../components/ListingCard";
import { ProximityMap } from "../components/ProximityMap";
import { ChoiceGroup, Dialog, Empty, useToast } from "../components/ui";
import { allListings, toggleSaved, useStore } from "../data/store";
import { KIND_LABEL, landmarkById, landmarksIn } from "../domain/landmarks";
import { SearchQuery, origin, search, toParams } from "../domain/search";
import { AMENITIES, CITIES, DIETS, GENDERS, GUESTS, ROOM_TYPES, type City } from "../domain/types";
import { plural } from "../lib/format";
import { useBriefLoading, useFlip } from "../lib/motion";
import { Link, navigate, useLocation, useTitle } from "../lib/router";

const RADII = [1, 2, 3, 5, 10, 15, 25];

export function Search() {
  const { query } = useLocation();
  const q = useMemo(() => SearchQuery.parse(Object.fromEntries(query)), [query]);
  const listings = useStore((s) => allListings(s));
  const profile = useStore((s) => s.profile);
  const saved = useStore((s) => s.saved);
  const results = useMemo(() => search(listings, q, profile), [listings, q, profile]);
  const o = origin(q);
  const lm = landmarkById(o.id)!;
  const [active, setActive] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const toast = useToast();
  useTitle(`Rooms near ${lm.short}, ${q.city}`);
  // A new place (city, landmark or radius) is a new search: show the radar and placeholders briefly.
  // Filters and sorting refine the current results instantly, and cards slide to their new positions.
  const searchKey = `${q.city}|${o.id}|${q.radius}`;
  const searching = useBriefLoading(searchKey);
  const listRef = useRef<HTMLUListElement>(null);
  useFlip(listRef, !searching);

  const set = (patch: Partial<SearchQuery>) => navigate(`/search?${toParams({ ...q, ...patch })}`, { replace: true });
  const activeFilters = [q.max, q.diet, q.gender, q.guests, q.q].filter(Boolean).length + q.room.length + q.amen.length;
  const reset = () => navigate(`/search?${toParams({ city: q.city, near: q.near, radius: q.radius, sort: q.sort })}`, { replace: true });

  const renderFilters = (p: string): ReactNode => (
    <div className="grid gap-6">
      <div className="field">
        <label htmlFor={`${p}-q`} className="label">Keyword</label>
        <div className="relative">
          <LuSearch aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input key={q.q ?? ""} id={`${p}-q`} type="search" defaultValue={q.q ?? ""} placeholder="e.g. balcony, metro" maxLength={80} className="input pl-9"
            onKeyDown={(e) => { if (e.key === "Enter") set({ q: e.currentTarget.value.trim() || undefined }); }}
            onBlur={(e) => { const v = e.currentTarget.value.trim() || undefined; if (v !== q.q) set({ q: v }); }} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${p}-max`} className="label">Max rent per month</label>
        <select id={`${p}-max`} className="input" value={q.max ?? ""} onChange={(e) => set({ max: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">Any budget</option>
          {[6000, 8000, 10000, 12000, 15000, 18000, 20000, 25000, 30000, 40000].map((v) => <option key={v} value={v}>Up to ₹{v.toLocaleString("en-IN")}</option>)}
        </select>
      </div>
      <fieldset className="grid gap-2">
        <legend className="label mb-2">Room type</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ROOM_TYPES) as Array<keyof typeof ROOM_TYPES>).map((k) => {
            const on = q.room.includes(k);
            return <button key={k} type="button" aria-pressed={on} className="chip" onClick={() => set({ room: on ? q.room.filter((x) => x !== k) : [...q.room, k] })}>{ROOM_TYPES[k]}</button>;
          })}
        </div>
      </fieldset>
      <ChoiceGroup name={`${p}-diet`} label="Kitchen" value={q.diet ?? "all"} onChange={(v) => set({ diet: v === "all" ? undefined : v })}
        options={[["all", "Any"], ...(Object.entries(DIETS) as Array<[keyof typeof DIETS, string]>)]} />
      <ChoiceGroup name={`${p}-gender`} label="Who can live here" value={q.gender ?? "all"} onChange={(v) => set({ gender: v === "all" ? undefined : v })}
        options={[["all", "Show all"], ...(Object.entries(GENDERS) as Array<[keyof typeof GENDERS, string]>)]} />
      <ChoiceGroup name={`${p}-guests`} label="Guests allowed (at least)" value={q.guests ?? "all"} onChange={(v) => set({ guests: v === "all" ? undefined : v })}
        options={[["all", "Any rule"], ["day", GUESTS.day], ["overnight", GUESTS.overnight]]} />
      <fieldset className="grid gap-2">
        <legend className="label mb-2">Must have</legend>
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map((a) => {
            const on = q.amen.includes(a);
            return <button key={a} type="button" aria-pressed={on} className="chip" onClick={() => set({ amen: on ? q.amen.filter((x) => x !== a) : [...q.amen, a] })}>{a}</button>;
          })}
        </div>
      </fieldset>
      {activeFilters > 0 && <button type="button" onClick={reset} className="btn-ghost justify-self-start"><LuRotateCcw aria-hidden />Clear {plural(activeFilters, "filter")}</button>}
    </div>
  );

  const map = <ProximityMap origin={o} radiusKm={q.radius} results={results} activeId={active} onActivate={setActive} onOpen={(id) => navigate(`/rooms/${id}`)} searching={searching} />;

  return (
    <div className="wrap grid max-w-[88rem] gap-6 py-6">
      <section aria-label="Where to search" className="card grid gap-3 p-3 sm:grid-cols-[0.8fr_1.4fr_0.7fr] sm:p-4">
        <div className="field">
          <label htmlFor="s-city" className="label">City</label>
          <select id="s-city" className="input" value={q.city} onChange={(e) => { const c = e.target.value as City; set({ city: c, near: landmarksIn(c)[0].id }); }}>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="s-near" className="label">Distance from</label>
          <select id="s-near" className="input" value={o.id} onChange={(e) => set({ near: e.target.value })}>
            {landmarksIn(q.city).map((l) => <option key={l.id} value={l.id}>{l.name} · {KIND_LABEL[l.kind]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="s-radius" className="label">Within</label>
          <select id="s-radius" className="input" value={q.radius} onChange={(e) => set({ radius: Number(e.target.value) })}>
            {RADII.map((r) => <option key={r} value={r}>{r} km</option>)}
          </select>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_26rem]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-20 grid gap-4">
            <h2 className="text-lg font-bold">Filters</h2>
            {renderFilters("side")}
          </div>
        </aside>

        <section aria-labelledby="results-h" aria-busy={searching} className="grid content-start gap-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 id="results-h" className="text-2xl font-bold sm:text-3xl">Rooms near {lm.short}</h1>
              <p className="text-muted" aria-live="polite">{searching ? `Searching within ${q.radius} km…` : `${plural(results.length, "room")} within ${q.radius} km${profile ? ", ranked for your lifestyle" : ""}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFiltersOpen(true)} className="btn-secondary lg:hidden" aria-haspopup="dialog">
                <LuSlidersHorizontal aria-hidden />Filters{activeFilters > 0 && <span className="rounded-full bg-brand px-1.5 text-xs text-brand-ink">{activeFilters}</span>}
              </button>
              <label htmlFor="s-sort" className="sr-only">Sort by</label>
              <select id="s-sort" className="input w-auto min-w-0 max-w-[12rem] py-2 sm:max-w-none" value={q.sort} onChange={(e) => set({ sort: e.target.value as SearchQuery["sort"] })}>
                <option value="distance">Nearest first</option>
                <option value="fit" disabled={!profile}>Best fit first</option>
                <option value="rent-asc">Rent: low to high</option>
                <option value="rent-desc">Rent: high to low</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          {!profile && (
            <p className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-marigold-soft px-4 py-3 text-sm">
              <span><b>See how each flat fits you.</b> Sign up, tell us how you live, and every room gets a fit score.</span>
              <Link to={`/signup?next=${encodeURIComponent("/search?" + toParams(q))}`} className="btn-primary py-2">Sign up free</Link>
            </p>
          )}

          <div className="flex rounded-xl border border-line bg-surface p-1 xl:hidden" role="tablist" aria-label="View">
            {([["list", "List", LuList], ["map", "Map", LuMap]] as const).map(([v, l, I]) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold ${view === v ? "bg-brand-soft text-brand" : "text-muted"}`}>
                <I aria-hidden />{l}
              </button>
            ))}
          </div>

          <div className={view === "map" ? "xl:hidden" : "hidden"}>{map}</div>

          <div className={`${view === "map" ? "hidden xl:grid" : "grid"} gap-4`}>
            {searching ? (
              <ul aria-hidden className="grid gap-4" data-testid="placeholders">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="card grid overflow-hidden sm:grid-cols-[13rem_1fr]">
                    <div className="skeleton aspect-[16/9] sm:aspect-auto sm:h-full" />
                    <div className="grid gap-3 p-4">
                      <div className="skeleton h-5 w-3/4 rounded-md" />
                      <div className="skeleton h-4 w-1/2 rounded-md" />
                      <div className="skeleton h-4 w-2/3 rounded-md" />
                      <div className="flex gap-2"><div className="skeleton h-6 w-20 rounded-full" /><div className="skeleton h-6 w-24 rounded-full" /></div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : results.length === 0 ? (
              <Empty icon={<LuSearch size={26} />} title="No rooms match yet"
                body={`Try a wider radius than ${q.radius} km or clear some filters. New rooms in ${q.city} are added every day.`}
                action={<div className="flex flex-wrap justify-center gap-2">
                  {q.radius < 25 && <button type="button" className="btn-primary" onClick={() => set({ radius: RADII.find((r) => r > q.radius) ?? 25 })}>Widen search</button>}
                  {activeFilters > 0 && <button type="button" className="btn-secondary" onClick={reset}>Clear filters</button>}
                </div>} />
            ) : (
              <ul ref={listRef} key={searchKey} className="@container grid gap-4" aria-label="Search results">
                {results.map((r, i) => (
                  <li key={r.listing.id} data-flip-id={r.listing.id} className="anim-rise stagger" style={{ "--i": i } as CSSProperties}>
                    <ListingCard result={r} landmark={lm.short} saved={saved.includes(r.listing.id)} active={active === r.listing.id}
                      onActivate={(on) => setActive(on ? r.listing.id : null)}
                      onToggleSave={() => toast(toggleSaved(r.listing.id) ? "Saved. Find it under Saved rooms." : "Removed from saved.")} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside aria-label="Map" className="hidden xl:block">
          <div className="sticky top-20">{map}</div>
        </aside>
      </div>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <div className="max-h-[65vh] overflow-y-auto pr-1">{renderFilters("sheet")}</div>
        <button type="button" className="btn-primary" onClick={() => setFiltersOpen(false)}>Show {plural(results.length, "room")}</button>
      </Dialog>
    </div>
  );
}
