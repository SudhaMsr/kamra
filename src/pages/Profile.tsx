import { useState, type FormEvent } from "react";
import { LuBadgeCheck, LuLogOut, LuTrash2, LuUser } from "react-icons/lu";
import { ChoiceGroup, Dialog, Empty, Field, Toggle, useToast } from "../components/ui";
import { ROLES, deleteAccount, isPersistent, logOut, saveProfile, setRole, useStore, type Role } from "../data/store";
import { CITIES, DIETS, GUESTS, Profile as ProfileZ, SHIFTS, fieldErrors, type City, type Profile } from "../domain/types";
import { errorMessage } from "../lib/errors";
import { Link, navigate, useTitle } from "../lib/router";

type Form = Omit<Profile, "budget" | "age"> & { budget: string; age: string };

export function ProfilePage() {
  const account = useStore((s) => s.account);
  const profile = useStore((s) => s.profile);
  useTitle(account ? "Your profile" : "Your account");
  if (!account || !profile) {
    return (
      <div className="wrap grid max-w-2xl py-10">
        <Empty page icon={<LuUser size={26} />} title="Sign up to get fit scores"
          body="Tell us how you live once, and every room shows how well its household fits you. It takes about two minutes."
          action={<div className="flex flex-wrap justify-center gap-2"><Link to="/signup" className="btn-primary">Create an account</Link><Link to="/login" className="btn-secondary">Log in</Link></div>} />
      </div>
    );
  }
  return <ProfileForm key={account.id} existing={profile} email={account.email} role={account.role} />;
}

function ProfileForm({ existing, email, role }: { existing: Profile; email: string; role: Role }) {
  const toast = useToast();
  const [f, setF] = useState<Form>({ ...existing, budget: String(existing.budget), age: String(existing.age) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => { const { [k as string]: _, ...rest } = e; return rest; }); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = ProfileZ.safeParse(f);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      setErrors(errs);
      document.getElementById(`p-${Object.keys(errs)[0]}`)?.focus();
      toast("Some details need fixing.", "error");
      return;
    }
    try { saveProfile(r.data); toast("Profile updated. Fit scores are refreshed."); }
    catch (x) { toast(errorMessage(x), "error"); }
  };

  return (
    <div className="wrap grid max-w-3xl gap-6 py-8">
      <div className="anim-rise grid gap-2">
        <p className="eyebrow">Profile</p>
        <h1 className="text-3xl font-extrabold">Hi, {existing.name.split(" ")[0]}</h1>
        <p className="text-muted">Signed in as <b className="text-ink">{email}</b>. Listers see your profile when you message them, and every room gets a fit score from it.</p>
      </div>
      {!isPersistent() && <p role="alert" className="rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn">Your browser is blocking storage (private mode?). Your account will be lost when you close this tab.</p>}

      <section className="card grid gap-3 p-5 sm:p-7" aria-labelledby="role-h">
        <h2 id="role-h" className="text-lg font-bold">How you use Kamra</h2>
        <ChoiceGroup name="p-role" label="I'm here because I'm…" value={role}
          onChange={(v) => { try { setRole(v); toast(`Switched to “${ROLES[v]}”. Your menu has been updated.`); } catch (x) { toast(errorMessage(x), "error"); } }}
          options={Object.entries(ROLES) as Array<[Role, string]>} />
      </section>

      <form onSubmit={submit} noValidate className="grid gap-6">
        <section className="card grid gap-5 p-5 sm:p-7" aria-labelledby="about-you">
          <h2 id="about-you" className="text-lg font-bold">About you</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="p-name" label="Name" error={errors.name}>{(a) => <input {...a} autoComplete="name" maxLength={40} className="input" value={f.name} onChange={(e) => set("name", e.target.value)} />}</Field>
            <Field id="p-age" label="Age" error={errors.age}>{(a) => <input {...a} inputMode="numeric" className="input" value={f.age} onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 2))} />}</Field>
            <Field id="p-work" label="What you do" hint="e.g. Software engineer at a fintech" error={errors.work}>{(a) => <input {...a} maxLength={60} className="input" value={f.work} onChange={(e) => set("work", e.target.value)} />}</Field>
            <Field id="p-city" label="City">{(a) => <select {...a} className="input" value={f.city} onChange={(e) => set("city", e.target.value as City)}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
          </div>
          <ChoiceGroup name="p-gender" label="Gender" value={f.gender} onChange={(v) => set("gender", v)} options={[["woman", "Woman"], ["man", "Man"], ["other", "Non-binary / other"]]} />
          <p className="-mt-3 text-sm text-muted">Used only to hide girls-only or boys-only rooms you can't live in.</p>
        </section>

        <section className="card grid gap-5 p-5 sm:p-7" aria-labelledby="lifestyle">
          <h2 id="lifestyle" className="text-lg font-bold">Lifestyle</h2>
          <ChoiceGroup name="p-diet" label="What you eat" value={f.diet} onChange={(v) => set("diet", v)} options={Object.entries(DIETS) as Array<[Profile["diet"], string]>} />
          <ChoiceGroup name="p-guests" label="Guests over" value={f.guests} onChange={(v) => set("guests", v)} options={Object.entries(GUESTS) as Array<[Profile["guests"], string]>} />
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
          <button type="submit" className="btn-primary px-6">Save profile</button>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => { logOut(); toast("You're logged out."); navigate("/"); }}><LuLogOut aria-hidden />Log out</button>
            <button type="button" className="btn-ghost text-warn" onClick={() => setConfirmDelete(true)}><LuTrash2 aria-hidden />Delete account</button>
          </div>
        </div>
      </form>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete your account?">
        <p>This permanently removes your account, profile, listings, messages, saved rooms and visits from this browser.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>Keep my account</button>
          <button type="button" className="btn-danger" onClick={() => { try { deleteAccount(); setConfirmDelete(false); toast("Your account was deleted."); navigate("/"); } catch (x) { toast(errorMessage(x), "error"); } }}>Delete account</button>
        </div>
      </Dialog>
    </div>
  );
}
