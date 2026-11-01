import { useMemo, useRef, useState, type FormEvent } from "react";
import { LuArrowLeft, LuArrowRight, LuCheck, LuImagePlus, LuLocateFixed, LuPlus, LuTrash2, LuUser } from "react-icons/lu";
import { ChoiceGroup, Empty, Field, Toggle, useToast } from "../components/ui";
import { findListing, saveListing, useStore } from "../data/store";
import { distanceM, formatCoord, formatDistance } from "../domain/geo";
import { landmarksIn } from "../domain/landmarks";
import {
  AMENITIES, CITIES, DIETS, FURNISHING, GENDERS, GUESTS, ListingInput, ROOM_TYPES, SHIFTS, fieldErrors,
  type City, type HouseholdMember,
} from "../domain/types";
import { errorMessage } from "../lib/errors";
import { inr, isoDay } from "../lib/format";
import { compressImage } from "../lib/image";
import { shake } from "../lib/motion";
import { Link, navigate, useLocation, useTitle } from "../lib/router";

type Draft = {
  title: string; description: string; city: City; locality: string; lat: string; lng: string;
  rent: string; deposit: string; roomType: keyof typeof ROOM_TYPES; diet: keyof typeof DIETS; gender: keyof typeof GENDERS;
  guests: keyof typeof GUESTS; furnishing: keyof typeof FURNISHING; smoking: boolean; drinking: boolean;
  amenities: string[]; availableFrom: string; household: HouseholdMember[]; photos: string[];
};

const STEPS = [
  { key: "basics", label: "The room", fields: ["title", "roomType", "rent", "deposit", "availableFrom", "furnishing", "description"] },
  { key: "rules", label: "House rules", fields: ["diet", "gender", "guests", "smoking", "drinking", "amenities"] },
  { key: "location", label: "Location", fields: ["city", "locality", "lat", "lng"] },
  { key: "people", label: "Flatmates", fields: ["household"] },
  { key: "photos", label: "Photos", fields: ["photos"] },
] as const;

function blank(city: City): Draft {
  const lm = landmarksIn(city)[0];
  return {
    title: "", description: "", city, locality: lm.localities[0], lat: lm.lat.toFixed(5), lng: lm.lng.toFixed(5),
    rent: "", deposit: "", roomType: "private", diet: "veg-nonveg", gender: "any", guests: "day", furnishing: "furnished",
    smoking: false, drinking: false, amenities: ["Wi-Fi"], availableFrom: isoDay(7), household: [], photos: [],
  };
}

export function PostRoom() {
  const { query } = useLocation();
  const editId = query.get("edit");
  const profile = useStore((s) => s.profile);
  const editing = useStore((s) => (editId ? s.myListings.find((l) => l.id === editId) : undefined));
  useTitle(editing ? "Edit your room" : "List a room");

  if (!profile) {
    return (
      <div className="wrap max-w-2xl py-10">
        <Empty page icon={<LuUser size={26} />} title="Sign up to list a room"
          body="Flatmates want to know who they'd live with. Your profile takes two minutes and is shown with your listing."
          action={<div className="flex flex-wrap justify-center gap-2"><Link to="/signup?next=%2Fpost" className="btn-primary">Create an account</Link><Link to="/login?next=%2Fpost" className="btn-secondary">Log in</Link></div>} />
      </div>
    );
  }
  if (editId && !editing) {
    return (
      <div className="wrap max-w-2xl py-10">
        <Empty page icon={<LuUser size={26} />} title="You can't edit this room" body={findListing(editId) ? "Only the person who listed a room can edit it." : "This room doesn't exist any more."}
          action={<Link to="/my-rooms" className="btn-primary">Your listings</Link>} />
      </div>
    );
  }
  const initial: Draft = editing
    ? { ...editing, lat: String(editing.lat), lng: String(editing.lng), rent: String(editing.rent), deposit: String(editing.deposit), amenities: [...editing.amenities] }
    : blank(profile.city);
  return <Wizard key={editId ?? "new"} initial={initial} editId={editing?.id} />;
}

function Wizard({ initial, editId }: { initial: Draft; editId?: string }) {
  const [d, setD] = useState<Draft>(initial);
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string>();
  const [geoMsg, setGeoMsg] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [dir, setDir] = useState<"right" | "left">("right");
  const toast = useToast();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const parsed = useMemo(() => ListingInput.safeParse({ ...d, rent: d.rent, deposit: d.deposit === "" ? 0 : d.deposit }), [d]);
  const errors = parsed.success ? {} : fieldErrors(parsed.error);
  const stepErrors = (i: number) => Object.entries(errors).filter(([k]) => (STEPS[i].fields as readonly string[]).includes(k.split(".")[0]));
  const err = (k: string) => (showErrors ? errors[k] : undefined);
  const isLast = step === STEPS.length;

  /** Shakes the form and moves focus to the first field with a problem (in on-screen order). */
  const flagErrors = () => {
    setShowErrors(true);
    shake(formRef.current);
    requestAnimationFrame(() => (formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]'))?.focus());
  };

  const go = (to: number) => {
    if (to > step && stepErrors(step).length) { flagErrors(); toast(stepErrors(step)[0][1], "error"); return; }
    setShowErrors(false); setDir(to > step ? "right" : "left"); setStep(to);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const publish = async (e: FormEvent) => {
    e.preventDefault();
    const bad = STEPS.findIndex((_, i) => stepErrors(i).length);
    if (bad >= 0) { setDir("left"); setStep(bad); flagErrors(); toast(stepErrors(bad)[0][1], "error"); return; }
    setBusy(true);
    try {
      const l = saveListing({ ...d, deposit: d.deposit === "" ? 0 : d.deposit }, editId);
      toast(editId ? "Changes saved." : "Your room is live.");
      navigate(`/rooms/${l.id}`);
    } catch (x) { toast(errorMessage(x), "error"); }
    finally { setBusy(false); }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoErr(undefined);
    const room = 6 - d.photos.length;
    if (room <= 0) { setPhotoErr("You've added the maximum of 6 photos."); return; }
    const list = [...files].slice(0, room);
    try {
      const out = await Promise.all(list.map(compressImage));
      setD((x) => ({ ...x, photos: [...x.photos, ...out].slice(0, 6) }));
      if (files.length > room) setPhotoErr(`Only ${room} more photo${room === 1 ? "" : "s"} fit, so the rest were skipped.`);
    } catch (x) { setPhotoErr(errorMessage(x)); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const locateMe = () => {
    if (!("geolocation" in navigator)) { setGeoMsg("Your browser can't share location. Enter coordinates or pick a landmark."); return; }
    setGeoMsg("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (p) => { set("lat", p.coords.latitude.toFixed(5)); set("lng", p.coords.longitude.toFixed(5)); setGeoMsg(`Location set (accurate to about ${Math.round(p.coords.accuracy)} m).`); },
      (e) => setGeoMsg(e.code === e.PERMISSION_DENIED ? "Location permission was denied. Pick a landmark or enter coordinates instead." : "Couldn't get your location. Pick a landmark or enter coordinates."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const lat = Number(d.lat), lng = Number(d.lng);
  const nearest = Number.isFinite(lat) && Number.isFinite(lng)
    ? landmarksIn(d.city).map((m) => ({ m, dist: distanceM(m.lat, m.lng, lat, lng) })).sort((a, b) => a.dist - b.dist)[0]
    : undefined;

  return (
    <div className="wrap grid max-w-3xl gap-6 py-8">
      <div className="grid gap-2">
        <p className="eyebrow">{editId ? "Edit listing" : "List a room"} · free</p>
        <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold outline-none">{isLast ? "Review and publish" : STEPS[step].label}</h1>
      </div>

      <nav aria-label="Steps">
        <ol className="grid grid-cols-6 gap-1.5">
          {[...STEPS.map((s) => s.label), "Review"].map((label, i) => {
            const done = i < step, cur = i === step;
            return (
              <li key={label}>
                <button type="button" onClick={() => (i < step ? go(i) : i === step + 1 ? go(i) : undefined)} disabled={i > step + 1}
                  aria-current={cur ? "step" : undefined}
                  className="grid w-full gap-1.5 text-left disabled:cursor-not-allowed">
                  <span className="h-1.5 overflow-hidden rounded-full bg-line">
                    <span className={`block h-full origin-left rounded-full transition-[transform,background-color] duration-[var(--t-slow)] ease-[var(--ease)] ${done ? "bg-brand" : "bg-marigold"}`}
                      style={{ transform: `scaleX(${done || cur ? 1 : 0})` }} />
                  </span>
                  <span className={`hidden text-xs font-semibold sm:block ${cur ? "text-ink" : "text-muted"}`}>{label}</span>
                  <span className="sr-only">{done ? " (done)" : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <form ref={formRef} onSubmit={isLast ? publish : (e) => { e.preventDefault(); go(step + 1); }} noValidate className="card grid gap-6 overflow-hidden p-5 sm:p-7">
        <div key={step} className={`grid gap-6 ${dir === "right" ? "anim-in-right" : "anim-in-left"}`}>
        {step === 0 && (
          <>
            <Field id="title" label="Headline" hint="What makes it worth a look? e.g. “Bright room with balcony near the metro”" error={err("title")}>
              {(a) => <input {...a} maxLength={80} className="input" value={d.title} onChange={(e) => set("title", e.target.value)} />}
            </Field>
            <ChoiceGroup name="roomType" label="Type of room" value={d.roomType} onChange={(v) => set("roomType", v)} options={Object.entries(ROOM_TYPES) as Array<[Draft["roomType"], string]>} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="rent" label="Rent per month (₹)" error={err("rent")}>
                {(a) => <input {...a} inputMode="numeric" className="input font-mono" value={d.rent} onChange={(e) => set("rent", e.target.value.replace(/\D/g, "").slice(0, 7))} />}
              </Field>
              <Field id="deposit" label="Deposit (₹)" hint={Number(d.rent) > 0 && Number(d.deposit) > 0 ? `${(Number(d.deposit) / Number(d.rent)).toFixed(1)} months of rent` : "Enter 0 if there's no deposit"} error={err("deposit")}>
                {(a) => <input {...a} inputMode="numeric" className="input font-mono" value={d.deposit} onChange={(e) => set("deposit", e.target.value.replace(/\D/g, "").slice(0, 8))} />}
              </Field>
              <Field id="available" label="Available from" error={err("availableFrom")}>
                {(a) => <input {...a} type="date" min={isoDay(0)} className="input" value={d.availableFrom} onChange={(e) => set("availableFrom", e.target.value)} />}
              </Field>
              <Field id="furnishing" label="Furnishing">
                {(a) => <select {...a} className="input" value={d.furnishing} onChange={(e) => set("furnishing", e.target.value as Draft["furnishing"])}>
                  {Object.entries(FURNISHING).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>}
              </Field>
            </div>
            <Field id="description" label="Describe the room and the flat" hint={`${d.description.trim().length}/1500 · at least 30 characters. Mention size, light, what's shared and what the household is like.`} error={err("description")}>
              {(a) => <textarea {...a} rows={6} maxLength={1500} className="input" value={d.description} onChange={(e) => set("description", e.target.value)} />}
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <ChoiceGroup name="diet" label="Kitchen" value={d.diet} onChange={(v) => set("diet", v)} options={Object.entries(DIETS) as Array<[Draft["diet"], string]>} />
            <ChoiceGroup name="gender" label="Who can live here" value={d.gender} onChange={(v) => set("gender", v)} options={Object.entries(GENDERS) as Array<[Draft["gender"], string]>} />
            <ChoiceGroup name="guests" label="Guests" value={d.guests} onChange={(v) => set("guests", v)} options={Object.entries(GUESTS) as Array<[Draft["guests"], string]>} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle id="smoking" label="Smoking allowed" checked={d.smoking} onChange={(v) => set("smoking", v)} />
              <Toggle id="drinking" label="Drinking allowed" checked={d.drinking} onChange={(v) => set("drinking", v)} />
            </div>
            <fieldset className="grid gap-2">
              <legend className="label mb-2">What's included</legend>
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map((a) => {
                  const on = d.amenities.includes(a);
                  return <button key={a} type="button" aria-pressed={on} className="chip" onClick={() => set("amenities", on ? d.amenities.filter((x) => x !== a) : [...d.amenities, a])}>{on && <LuCheck aria-hidden />}{a}</button>;
                })}
              </div>
            </fieldset>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="city" label="City">
                {(a) => <select {...a} className="input" value={d.city} onChange={(e) => { const c = e.target.value as City; const lm = landmarksIn(c)[0]; setD((x) => ({ ...x, city: c, locality: lm.localities[0], lat: lm.lat.toFixed(5), lng: lm.lng.toFixed(5) })); }}>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>}
              </Field>
              <Field id="locality" label="Locality" hint="Shown publicly. Your exact address is only shared after a visit is confirmed." error={err("locality")}>
                {(a) => <input {...a} list="localities" maxLength={60} className="input" value={d.locality} onChange={(e) => set("locality", e.target.value)} />}
              </Field>
              <datalist id="localities">{landmarksIn(d.city).flatMap((m) => m.localities).map((x) => <option key={x} value={x} />)}</datalist>
            </div>
            <fieldset className="grid gap-2">
              <legend className="label mb-2">Start from a nearby landmark</legend>
              <div className="flex flex-wrap gap-2">
                {landmarksIn(d.city).map((m) => (
                  <button key={m.id} type="button" className="chip" aria-pressed={nearest?.m.id === m.id && (nearest?.dist ?? 1) < 5}
                    onClick={() => setD((x) => ({ ...x, lat: m.lat.toFixed(5), lng: m.lng.toFixed(5), locality: m.localities[0] }))}>{m.short}</button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field id="lat" label="Latitude" error={err("lat")}>
                {(a) => <input {...a} inputMode="decimal" className="input font-mono" value={d.lat} onChange={(e) => set("lat", e.target.value.replace(/[^\d.-]/g, "").slice(0, 12))} />}
              </Field>
              <Field id="lng" label="Longitude" error={err("lng")}>
                {(a) => <input {...a} inputMode="decimal" className="input font-mono" value={d.lng} onChange={(e) => set("lng", e.target.value.replace(/[^\d.-]/g, "").slice(0, 12))} />}
              </Field>
              <button type="button" className="btn-secondary" onClick={locateMe}><LuLocateFixed aria-hidden />Use my location</button>
            </div>
            <p className="text-sm text-muted" aria-live="polite">
              {geoMsg ?? (nearest && !errors.lat && !errors.lng ? `${formatCoord(lat, lng)} · ${formatDistance(nearest.dist)} from ${nearest.m.short}` : "")}
            </p>
            {nearest && nearest.dist > 25000 && !errors.lat && (
              <p className="rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn">These coordinates are {formatDistance(nearest.dist)} from {d.city}'s hubs. Check that the city is right.</p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-muted">Add the people already living in the flat (not you; you're shown as the lister). Seekers use this to judge fit. Leave it empty for a PG or if you live alone.</p>
            {d.household.length === 0 && <p className="rounded-xl bg-raised p-4 text-sm text-muted">No flatmates added.</p>}
            <ul className="grid gap-4">
              {d.household.map((m, i) => (
                <li key={i} className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-[1fr_5rem_1.2fr_1fr_auto] sm:items-end">
                  <Field id={`hh-${i}-name`} label="First name" error={err(`household.${i}.name`)}>
                    {(a) => <input {...a} maxLength={30} className="input" value={m.name} onChange={(e) => set("household", d.household.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />}
                  </Field>
                  <Field id={`hh-${i}-age`} label="Age" error={err(`household.${i}.age`)}>
                    {(a) => <input {...a} inputMode="numeric" className="input" value={String(m.age || "")} onChange={(e) => set("household", d.household.map((x, j) => (j === i ? { ...x, age: Number(e.target.value.replace(/\D/g, "").slice(0, 2)) } : x)))} />}
                  </Field>
                  <Field id={`hh-${i}-work`} label="Work" error={err(`household.${i}.work`)}>
                    {(a) => <input {...a} maxLength={40} className="input" value={m.work} onChange={(e) => set("household", d.household.map((x, j) => (j === i ? { ...x, work: e.target.value } : x)))} />}
                  </Field>
                  <Field id={`hh-${i}-shift`} label="Hours">
                    {(a) => <select {...a} className="input" value={m.shift} onChange={(e) => set("household", d.household.map((x, j) => (j === i ? { ...x, shift: e.target.value as HouseholdMember["shift"] } : x)))}>
                      {Object.entries(SHIFTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>}
                  </Field>
                  <button type="button" className="btn-danger" onClick={() => set("household", d.household.filter((_, j) => j !== i))} aria-label={`Remove flatmate ${m.name || i + 1}`}><LuTrash2 aria-hidden /></button>
                </li>
              ))}
            </ul>
            {d.household.length < 10 && (
              <button type="button" className="btn-secondary justify-self-start" onClick={() => set("household", [...d.household, { name: "", age: 25, work: "", shift: "day" }])}>
                <LuPlus aria-hidden />Add a flatmate
              </button>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <p className="text-muted">Rooms with photos get far more messages. Add up to 6; they're resized on your device before upload.</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Your photos">
              {d.photos.map((p, i) => (
                <li key={`${p.length}:${p.slice(-24)}`} className="anim-pop relative aspect-[4/3] overflow-hidden rounded-xl bg-raised">
                  <img src={p} alt={`Photo ${i + 1}${i === 0 ? " (cover)" : ""}`} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-2 top-2 tag bg-surface text-ink">Cover</span>}
                  <div className="absolute right-2 top-2 flex gap-1">
                    {i > 0 && <button type="button" className="rounded-lg bg-surface/95 px-2 py-1 text-xs font-semibold" onClick={() => set("photos", [p, ...d.photos.filter((_, j) => j !== i)])}>Make cover</button>}
                    <button type="button" className="grid h-8 w-8 place-items-center rounded-lg bg-surface/95 text-warn" aria-label={`Remove photo ${i + 1}`} onClick={() => set("photos", d.photos.filter((_, j) => j !== i))}><LuTrash2 aria-hidden /></button>
                  </div>
                </li>
              ))}
              {d.photos.length < 6 && (
                <li>
                  <label htmlFor="photos" className="grid aspect-[4/3] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-center text-sm font-semibold text-muted hover:border-brand hover:text-brand focus-within:border-brand">
                    <span className="grid justify-items-center gap-1"><LuImagePlus aria-hidden size={26} />Add photos</span>
                    <input ref={fileRef} id="photos" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
                  </label>
                </li>
              )}
            </ul>
            {photoErr && <p className="error" role="alert">{photoErr}</p>}
          </>
        )}

        {isLast && (
          <div className="grid gap-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ["Headline", d.title], ["Type", ROOM_TYPES[d.roomType]], ["Rent", d.rent ? inr(Number(d.rent)) : "—"], ["Deposit", inr(Number(d.deposit || 0))],
                ["Kitchen", DIETS[d.diet]], ["Who can live here", GENDERS[d.gender]], ["Guests", GUESTS[d.guests]],
                ["Location", `${d.locality}, ${d.city}`], ["Flatmates", String(d.household.length)], ["Photos", String(d.photos.length)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-raised px-3.5 py-2.5"><dt className="text-xs font-bold uppercase tracking-wider text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
            {Object.keys(errors).length > 0
              ? <p role="alert" className="rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn">Some details need fixing. Publishing will take you to the first one.</p>
              : <p className="rounded-xl bg-ok-soft p-3 text-sm font-semibold text-ok">Everything looks good.</p>}
          </div>
        )}

        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
          {step > 0 ? <button type="button" className="btn-ghost" onClick={() => go(step - 1)}><LuArrowLeft aria-hidden />Back</button> : <span />}
          {isLast
            ? <button type="submit" className="btn-primary px-6" disabled={busy}>{busy ? "Saving…" : editId ? "Save changes" : "Publish room"}</button>
            : <button type="submit" className="btn-primary px-6">Continue<LuArrowRight aria-hidden /></button>}
        </div>
      </form>
    </div>
  );
}
