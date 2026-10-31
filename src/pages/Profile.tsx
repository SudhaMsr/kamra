import { useState, type FormEvent } from "react";
import { LuBadgeCheck, LuRotateCcw } from "react-icons/lu";
import { ChoiceGroup, Dialog, Field, Toggle, useToast } from "../components/ui";
import { isPersistent, resetAll, saveProfile, useStore } from "../data/store";
import { CITIES, DIETS, GUESTS, Profile as ProfileZ, SHIFTS, fieldErrors, type City, type Profile } from "../domain/types";
import { navigate, useLocation, useTitle } from "../lib/router";

type Form = Omit<Profile, "budget" | "age"> & { budget: string; age: string };
const DEFAULTS: Form = { name: "", gender: "woman", diet: "veg-nonveg", smokes: false, drinks: false, guests: "day", shift: "day", budget: "15000", city: "Bengaluru", age: "", work: "", about: "", lookingForRoom: true };

export function ProfilePage() {
  const existing = useStore((s) => s.profile);
  const { query } = useLocation();
  const next = query.get("next");
  const toast = useToast();
  const [f, setF] = useState<Form>(existing ? { ...existing, budget: String(existing.budget), age: String(existing.age) } : DEFAULTS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  useTitle(existing ? "Your profile" : "Create your profile");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => { const { [k as string]: _, ...rest } = e; return rest; }); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = ProfileZ.safeParse(f);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      setErrors(errs);
      const first = Object.keys(errs)[0];
      document.getElementById(`p-${first}`)?.focus();
      toast("Some details need fixing.", "error");
      return;
    }
    try {
      saveProfile(r.data);
      toast(existing ? "Profile updated. Fit scores are refreshed." : "Profile created. Every room now shows how it fits you.");
      if (next && next.startsWith("/")) navigate(next);
      else if (!existing) navigate(`/search?city=${encodeURIComponent(r.data.city)}&sort=fit`);
    } catch (x) { toast((x as Error).message, "error"); }
  };

  return (
    <div className="wrap grid max-w-3xl gap-6 py-8">
      <div className="grid gap-2">
        <p className="eyebrow">{existing ? "Profile" : "Two minutes"}</p>
        <h1 className="text-3xl font-extrabold">{existing ? `Hi, ${existing.name.split(" ")[0]}` : "Tell us how you live"}</h1>
        <p className="text-muted">Listers see this when you message them, and every room gets a fit score from it. Be honest; it saves everyone a wasted visit.</p>
      </div>
      {!isPersistent() && <p role="alert" className="rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn">Your browser is blocking storage (private mode?). Your profile will be lost when you close this tab.</p>}

      <form onSubmit={submit} noValidate className="grid gap-6">
        <section className="card grid gap-5 p-5 sm:p-7" aria-labelledby="about-you">
          <h2 id="about-you" className="text-lg font-bold">About you</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="p-name" label="Name" error={errors.name}>{(a) => <input {...a} autoComplete="name" maxLength={40} className="input" value={f.name} onChange={(e) => set("name", e.target.value)} />}</Field>
            <Field id="p-age" label="Age" error={errors.age}>{(a) => <input {...a} inputMode="numeric" className="input" value={f.age} onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 2))} />}</Field>
            <Field id="p-work" label="What you do" hint="e.g. Software engineer at a fintech" error={errors.work}>{(a) => <input {...a} maxLength={60} className="input" value={f.work} onChange={(e) => set("work", e.target.value)} />}</Field>
            <Field id="p-city" label="City you're looking in">{(a) => <select {...a} className="input" value={f.city} onChange={(e) => set("city", e.target.value as City)}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
          </div>
          <ChoiceGroup name="p-gender" label="Gender" value={f.gender} onChange={(v) => set("gender", v)} options={[["woman", "Woman"], ["man", "Man"], ["other", "Non-binary / other"]]} />
          <p className="-mt-3 text-sm text-muted">Used only to hide girls-only or boys-only rooms you can't live in.</p>
        </section>

        <section className="card grid gap-5 p-5 sm:p-7" aria-labelledby="lifestyle">
          <h2 id="lifestyle" className="text-lg font-bold">Lifestyle</h2>
          <ChoiceGroup name="p-diet" label="What you eat" value={f.diet} onChange={(v) => set("diet", v)} options={Object.entries(DIETS) as Array<[Profile["diet"], string]>} />
          <ChoiceGroup name="p-guests" label="How often you'd have guests over" value={f.guests} onChange={(v) => set("guests", v)} options={Object.entries(GUESTS) as Array<[Profile["guests"], string]>} />
          <ChoiceGroup name="p-shift" label="Work hours" value={f.shift} onChange={(v) => set("shift", v)} options={Object.entries(SHIFTS) as Array<[Profile["shift"], string]>} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle id="p-smokes" label="I smoke" checked={f.smokes} onChange={(v) => set("smokes", v)} />
            <Toggle id="p-drinks" label="I drink" checked={f.drinks} onChange={(v) => set("drinks", v)} />
          </div>
          <Field id="p-budget" label="Monthly rent budget (₹)" error={errors.budget}>{(a) => <input {...a} inputMode="numeric" className="input font-mono sm:max-w-xs" value={f.budget} onChange={(e) => set("budget", e.target.value.replace(/\D/g, "").slice(0, 6))} />}</Field>
          <Field id="p-about" label="A line about you (optional)" hint={`${f.about.length}/600`} error={errors.about}>{(a) => <textarea {...a} rows={3} maxLength={600} className="input" value={f.about} onChange={(e) => set("about", e.target.value)} />}</Field>
          <Toggle id="p-looking" label="Show me in Flatmates so listers can find me" checked={f.lookingForRoom} onChange={(v) => set("lookingForRoom", v)} />
        </section>

        <section className="card grid gap-3 p-5 sm:p-7" aria-labelledby="verify">
          <h2 id="verify" className="text-lg font-bold">Verification</h2>
          <p className="text-sm text-muted">Verified profiles get replies faster. Verification with DigiLocker and a work email is part of the full launch; in this demo edition it isn't connected yet.</p>
          <ul className="grid gap-2 text-sm">
            {["Government ID (DigiLocker)", "Work email", "Previous landlord reference"].map((x) => (
              <li key={x} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5"><span className="flex items-center gap-2"><LuBadgeCheck aria-hidden className="text-muted" />{x}</span><span className="tag">Coming soon</span></li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="submit" className="btn-primary px-6">{existing ? "Save profile" : "Create profile"}</button>
          {existing && <button type="button" className="btn-ghost text-warn" onClick={() => setConfirmReset(true)}><LuRotateCcw aria-hidden />Delete my data</button>}
        </div>
      </form>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Delete everything?">
        <p>This removes your profile, listings, messages, saved rooms and visits from this browser. It can't be undone.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setConfirmReset(false)}>Keep my data</button>
          <button type="button" className="btn-danger" onClick={() => { resetAll(); setConfirmReset(false); setF(DEFAULTS); toast("All your data was deleted."); navigate("/"); }}>Delete everything</button>
        </div>
      </Dialog>
    </div>
  );
}
