import { useMemo, useState, type FormEvent } from "react";
import { LuArrowRight, LuBadgeCheck, LuBuilding2, LuLeaf, LuMessageCircle, LuPhoneOff, LuShieldCheck, LuTrainFront, LuUsers } from "react-icons/lu";
import { allListings, useStore } from "../data/store";
import { KIND_LABEL, LANDMARKS, landmarksIn } from "../domain/landmarks";
import { toParams } from "../domain/search";
import { CITIES, type City } from "../domain/types";
import { inr } from "../lib/format";
import { Link, navigate, useTitle } from "../lib/router";
import { RoomArt } from "../components/ui";

export function Home() {
  useTitle("");
  const profileCity = useStore((s) => s.profile?.city);
  const [city, setCity] = useState<City>(profileCity ?? "Bengaluru");
  const [near, setNear] = useState(landmarksIn(profileCity ?? "Bengaluru")[0].id);
  const [max, setMax] = useState("");
  const listings = useStore((s) => allListings(s));
  const stats = useMemo(() => {
    const active = listings.filter((l) => l.status === "active");
    const veg = active.filter((l) => l.diet === "pure-veg").length;
    return { rooms: active.length, cities: new Set(active.map((l) => l.city)).size, veg };
  }, [listings]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m = Number(max);
    navigate(`/search?${toParams({ city, near, max: Number.isFinite(m) && m >= 1000 ? m : undefined })}`);
  };

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-marigold-soft opacity-70 blur-3xl dark:opacity-40" />
        <div className="wrap relative grid gap-10 py-12 md:grid-cols-[1.15fr_1fr] md:items-center md:py-20">
          <div className="grid gap-6">
            <p className="eyebrow text-brand">Flatshares across {stats.cities} Indian cities</p>
            <h1 className="text-[2.6rem] font-extrabold leading-[1.02] sm:text-6xl">
              Find a flatmate,<br /><span className="relative inline-block">not just a flat.<span aria-hidden className="absolute -bottom-1 left-0 h-3 w-full -rotate-1 rounded bg-marigold/45" style={{ zIndex: -1 }} /></span>
            </h1>
            <p className="max-w-xl text-lg text-muted">
              Search rooms by distance from your office or metro, then see how each household fits you on food, guests, smoking and work hours before you message.
            </p>

            <form onSubmit={submit} className="card grid gap-3 p-4 shadow-sm sm:grid-cols-2 sm:items-end" aria-label="Search rooms">
              <div className="field">
                <label htmlFor="h-city" className="label">City</label>
                <select id="h-city" value={city} className="input"
                  onChange={(e) => { const c = e.target.value as City; setCity(c); setNear(landmarksIn(c)[0].id); }}>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="h-near" className="label">Near</label>
                <select id="h-near" value={near} onChange={(e) => setNear(e.target.value)} className="input">
                  {landmarksIn(city).map((l) => <option key={l.id} value={l.id}>{l.name} ({KIND_LABEL[l.kind]})</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="h-max" className="label">Max rent (₹)</label>
                <input id="h-max" inputMode="numeric" pattern="[0-9]*" placeholder="Any" value={max}
                  onChange={(e) => setMax(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="input" />
              </div>
              <button type="submit" className="btn-primary h-[2.9rem] px-6 sm:w-full">Search<LuArrowRight aria-hidden /></button>
            </form>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Popular:</span>
              {["blr-itpl", "hyd-hitec", "pun-hinjewadi", "mum-bkc", "ggn-cyber", "che-elcot"].map((id) => {
                const l = LANDMARKS.find((x) => x.id === id)!;
                return (
                  <Link key={id} to={`/search?${toParams({ city: l.city, near: l.id })}`} className="chip">
                    {l.kind === "metro" ? <LuTrainFront aria-hidden /> : <LuBuilding2 aria-hidden />}{l.short}
                  </Link>
                );
              })}
            </div>
          </div>

          <div aria-hidden className="relative hidden pt-8 md:block">
            <div className="card rotate-[-2deg] overflow-hidden shadow-xl">
              <RoomArt seed="hero-room" className="h-56 w-full" />
              <div className="grid gap-2 p-5">
                <div className="flex items-baseline justify-between"><span className="font-display text-lg font-bold">Bright room with balcony</span><span className="font-mono">{inr(16500)}</span></div>
                <span className="text-sm text-muted">HSR Layout · 2.1 km from ORR Bellandur</span>
                <div className="flex gap-1.5"><span className="tag tag-ok">92% fit</span><span className="tag">No restriction</span><span className="tag tag-ok"><LuBadgeCheck />ID verified</span></div>
              </div>
            </div>
            <div className="card absolute -right-3 top-0 w-56 rotate-[3deg] p-4 shadow-xl ring-1 ring-line">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Why 92%</p>
              <ul className="grid gap-1.5 text-sm">
                <li className="flex justify-between"><span>Kitchen</span><span className="font-bold text-ok">Match</span></li>
                <li className="flex justify-between"><span>Work hours</span><span className="font-bold text-ok">Match</span></li>
                <li className="flex justify-between"><span>Guests</span><span className="font-bold text-warn">Clash</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap grid gap-8 py-14" aria-labelledby="how">
        <div className="grid gap-2">
          <p className="eyebrow">How it works</p>
          <h2 id="how" className="text-3xl font-bold">Three steps, no brokers</h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            ["Tell us how you live", "Diet, smoking, guests, work hours and budget. Two minutes, and every room gets a fit score.", LuUsers, "/profile"],
            ["Search near your office", "Pick a tech park or metro station and a radius. Rooms are sorted by real distance.", LuBuilding2, "/search"],
            ["Message and visit", "Chat inside Kamra, book a visit slot, and only share your number once you've met.", LuMessageCircle, "/messages"],
          ].map(([t, b, Icon, to], i) => {
            const I = Icon as typeof LuUsers;
            return (
              <li key={t as string} className="card grid content-start gap-3 p-6">
                <span className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-ink"><I aria-hidden /></span>
                  <span className="font-mono text-sm text-muted">Step {i + 1}</span>
                </span>
                <h3 className="text-lg font-bold">{t as string}</h3>
                <p className="text-muted">{b as string}</p>
                <Link to={to as string} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">Start<LuArrowRight aria-hidden /></Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="border-y border-line bg-surface" aria-labelledby="trust">
        <div className="wrap grid gap-8 py-14 md:grid-cols-[1fr_1.4fr] md:items-start">
          <div className="grid gap-3">
            <p className="eyebrow">Built for Indian flatshares</p>
            <h2 id="trust" className="text-3xl font-bold">The rules that actually decide where you live</h2>
            <p className="text-muted">Filters for what matters in an Indian home, plus protection from the scams that plague rental listings.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              [LuLeaf, "Pure veg or mixed kitchen", `${stats.veg} of ${stats.rooms} rooms here have a pure veg kitchen. Filter for it directly.`],
              [LuUsers, "Girls-only, boys-only or open", "Gender rules are respected automatically, so you only see rooms you can live in."],
              [LuPhoneOff, "Your number stays private", "Phone numbers and emails typed into chat are hidden until you choose to share in person."],
              [LuShieldCheck, "Never pay a token blind", "Listers are ID-verified, and Kamra will never ask you to pay a token or gate pass before a visit."],
            ].map(([Icon, t, b]) => {
              const I = Icon as typeof LuLeaf;
              return (
                <li key={t as string} className="grid gap-2 rounded-2xl bg-raised p-5">
                  <I aria-hidden className="text-brand" size={22} />
                  <h3 className="text-base font-bold">{t as string}</h3>
                  <p className="text-sm text-muted">{b as string}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="wrap grid gap-6 py-14" aria-labelledby="cities">
        <h2 id="cities" className="text-3xl font-bold">Browse by city</h2>
        <ul className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CITIES.map((c) => {
            const n = listings.filter((l) => l.city === c && l.status === "active").length;
            return (
              <li key={c}>
                <Link to={`/search?${toParams({ city: c, radius: 25 })}`} className="card flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 p-4 hover:border-brand">
                  <span className="min-w-0 font-display text-lg font-bold">{c}</span>
                  <span className="whitespace-nowrap text-sm text-muted">{n} rooms</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
