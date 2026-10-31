import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { LuArrowLeft, LuArrowRight, LuEye, LuEyeOff, LuHouse, LuLock, LuSearch, LuUsers } from "react-icons/lu";
import { Avatar, ChoiceGroup, Field, Toggle, useToast } from "../components/ui";
import { ROLES, SignUpInput, emailTaken, getState, homeFor, logIn, signUp, useStore, type Role } from "../data/store";
import { CITIES, DIETS, GUESTS, Profile, SHIFTS, fieldErrors, type City } from "../domain/types";
import { errorMessage } from "../lib/errors";
import { inr } from "../lib/format";
import { prefersReducedMotion, shake as shakeEl } from "../lib/motion";
import { Link, navigate, useLocation, useTitle } from "../lib/router";

/* ---------------------------------------------------------------- shared ---------------------------------------------------------------- */

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : null);

function PasswordInput({ id, value, onChange, autoComplete, invalid, describedBy }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} value={value} maxLength={128}
        aria-invalid={invalid} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} className="input pr-12" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink">
        {show ? <LuEyeOff aria-hidden /> : <LuEye aria-hidden />}
      </button>
    </div>
  );
}

/** 0–4 score from length and character variety. Only guides the person; the real rule is SignUpInput. */
export function passwordScore(p: string): number {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.max(1, s);
}
const STRENGTH = ["", "Weak", "Fair", "Good", "Strong"];

function StrengthMeter({ password }: { password: string }) {
  const score = passwordScore(password);
  const tone = score <= 1 ? "bg-warn" : score === 2 ? "bg-marigold" : "bg-ok";
  return (
    <div className="grid gap-1" aria-live="polite">
      <div className="grid grid-cols-4 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className="h-1.5 overflow-hidden rounded-full bg-raised">
            <span className={`block h-full origin-left rounded-full transition-transform duration-[var(--t-med)] ease-[var(--ease)] ${tone}`} style={{ transform: `scaleX(${i <= score ? 1 : 0})` }} />
          </span>
        ))}
      </div>
      {password && <span className="hint">Password strength: <b className="text-ink">{STRENGTH[score]}</b></span>}
    </div>
  );
}

/* ---------------------------------------------------------------- sign up ---------------------------------------------------------------- */

type Draft = {
  role: Role | null; name: string; email: string; password: string;
  age: string; work: string; gender: Profile["gender"]; city: City;
  diet: Profile["diet"]; smokes: boolean; drinks: boolean; guests: Profile["guests"]; shift: Profile["shift"];
  budget: string; about: string;
};

const STEPS = [
  { key: "role", title: "What brings you to Kamra?", sub: "You can change this any time from your profile." },
  { key: "account", title: "Create your login", sub: "We'll use this to keep your rooms, chats and visits together." },
  { key: "about", title: "A little about you", sub: "Listers see this when you message them." },
  { key: "food", title: "Food and habits", sub: "The things that decide whether a flat feels like home." },
  { key: "routine", title: "Guests and work hours", sub: "Matching routines avoids most flatmate friction." },
  { key: "budget", title: "Your budget", sub: "Rooms above it still show, but we'll flag them." },
] as const;

const ROLE_CARDS: Array<{ value: Role; icon: typeof LuSearch; title: string; body: string }> = [
  { value: "seeker", icon: LuSearch, title: ROLES.seeker, body: "Find a room near work, ranked by how well each household fits you." },
  { value: "lister", icon: LuHouse, title: ROLES.lister, body: "List your spare room and find a flatmate who fits your home." },
  { value: "both", icon: LuUsers, title: ROLES.both, body: "Look for a place and list one too. You'll get both menus." },
];

export function SignUpPage() {
  const account = useStore((s) => s.account);
  const profile = useStore((s) => s.profile);
  const { query } = useLocation();
  const next = safeNext(query.get("next"));
  // "form" → "creating" → "done". Only an already signed-in visitor arriving at the form is redirected away.
  const [stage, setStage] = useState<"form" | "creating" | "done">("form");
  useTitle("Create your account");
  useEffect(() => { if (account && stage === "form") navigate(next ?? "/profile", { replace: true }); }, [account, stage, next]);
  if (stage === "done" && account) return <Welcome name={profile?.name ?? ""} role={account.role} next={next ?? homeFor(account, profile)} />;
  return <SignUpWizard onStart={() => setStage("creating")} onDone={() => setStage("done")} onFail={() => setStage("form")} next={next} />;
}

function SignUpWizard({ onStart, onDone, onFail, next }: { onStart: () => void; onDone: () => void; onFail: () => void; next: string | null }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Which way the step panel slides in. Errors shake the panel in place (no remount, so focus is kept).
  const [dir, setDir] = useState<"right" | "left">("right");
  const panelRef = useRef<HTMLDivElement>(null);
  const shake = () => shakeEl(panelRef.current);
  const [d, setD] = useState<Draft>({
    role: null, name: "", email: "", password: "", age: "", work: "", gender: "woman", city: "Bengaluru",
    diet: "veg-nonveg", smokes: false, drinks: false, guests: "day", shift: "day", budget: "15000", about: "",
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrors((e) => { const { [k as string]: _, ...rest } = e; return rest; });
  };

  const profileInput = () => ({
    name: d.name, gender: d.gender, diet: d.diet, smokes: d.smokes, drinks: d.drinks, guests: d.guests, shift: d.shift,
    budget: d.budget, city: d.city, age: d.age, work: d.work, about: d.about, lookingForRoom: d.role !== "lister",
  });

  /** Returns field errors for the current step, or {} when it's complete. */
  const validate = (i: number): Record<string, string> => {
    if (i === 0) return d.role ? {} : { role: "Choose how you'll use Kamra" };
    if (i === 1) {
      const r = SignUpInput.safeParse({ email: d.email, password: d.password, role: d.role ?? "seeker" });
      const e: Record<string, string> = r.success ? {} : fieldErrors(r.error);
      const n = Profile.shape.name.safeParse(d.name);
      if (!n.success) e.name = n.error.issues[0].message;
      if (!e.email && emailTaken(d.email)) e.email = "An account with this email already exists. Log in instead.";
      return e;
    }
    const r = Profile.safeParse(profileInput());
    if (r.success) return {};
    const all = fieldErrors(r.error);
    const fields: Record<number, string[]> = { 2: ["age", "work", "gender", "city"], 3: ["diet", "smokes", "drinks"], 4: ["guests", "shift"], 5: ["budget", "about"] };
    return Object.fromEntries(Object.entries(all).filter(([k]) => fields[i]?.includes(k)));
  };

  const go = (to: number) => {
    setDir(to > step ? "right" : "left");
    setStep(to);
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(step);
    if (Object.keys(errs).length) {
      setErrors(errs);
      shake();
      // Focus the first field with a problem in on-screen order, not the order errors were found.
      requestAnimationFrame(() => {
        const ids = Object.keys(errs).map((k) => `su-${k}`);
        const el = [...(panelRef.current?.querySelectorAll<HTMLElement>("[id^='su-']") ?? [])].find((n) => ids.includes(n.id));
        (el ?? document.getElementById(ids[0]))?.focus();
      });
      return;
    }
    if (step < STEPS.length - 1) { go(step + 1); return; }
    setBusy(true);
    onStart();
    try {
      await signUp({ email: d.email, password: d.password, role: d.role }, profileInput());
      onDone();
    } catch (x) {
      onFail();
      toast(errorMessage(x), "error");
      shake();
    } finally { setBusy(false); }
  };

  const err = (k: string) => errors[k];
  const s = STEPS[step];
  const pct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="wrap grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:py-12">
      <div className="grid min-w-0 gap-6">
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="eyebrow">Step {step + 1} of {STEPS.length}</span>
            <span className="text-muted">Already have an account? <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand underline-offset-2 hover:underline">Log in</Link></span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-label="Sign-up progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
            <div className="h-full origin-left rounded-full bg-brand transition-transform duration-[var(--t-slow)] ease-[var(--ease)]" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
        </div>

        <form onSubmit={submit} noValidate className="card overflow-hidden">
          <div key={step} ref={panelRef} className={`grid gap-6 p-5 sm:p-8 ${dir === "right" ? "anim-in-right" : "anim-in-left"}`}>
            <div className="grid gap-1.5">
              <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold outline-none sm:text-3xl">{s.title}</h1>
              <p className="text-muted">{s.sub}</p>
            </div>

            {step === 0 && (
              <fieldset className="grid gap-3">
                <legend className="sr-only">How you'll use Kamra</legend>
                <div role="radiogroup" aria-label="How you'll use Kamra" aria-describedby={err("role") ? "su-role-err" : undefined} className="grid gap-3 sm:grid-cols-3">
                  {ROLE_CARDS.map((c, i) => {
                    const on = d.role === c.value;
                    return (
                      <button key={c.value} id={i === 0 ? "su-role" : undefined} type="button" role="radio" aria-checked={on}
                        onClick={() => set("role", c.value)}
                        style={{ "--i": i } as CSSProperties}
                        className={`anim-rise stagger group relative grid content-start gap-3 rounded-2xl border-2 p-4 text-left transition-[transform,box-shadow,border-color,background-color] duration-[var(--t-fast)] ease-[var(--ease)] hover:-translate-y-1 hover:shadow-lg ${on ? "border-brand bg-brand-soft shadow-md" : "border-field-line bg-field"}`}>
                        <span className={`grid h-11 w-11 place-items-center rounded-xl transition-colors ${on ? "bg-brand text-brand-ink" : "bg-raised text-brand"}`}><c.icon aria-hidden size={22} /></span>
                        <span className="font-display text-lg font-bold leading-tight">{c.title}</span>
                        <span className="text-sm text-muted">{c.body}</span>
                        {on && <span aria-hidden className="anim-pop absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-brand text-sm font-black text-brand-ink">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {err("role") && <p id="su-role-err" className="error">{err("role")}</p>}
              </fieldset>
            )}

            {step === 1 && (
              <div className="grid gap-4">
                <Field id="su-name" label="Your name" error={err("name")}>{(a) => <input {...a} autoComplete="name" maxLength={40} className="input" value={d.name} onChange={(e) => set("name", e.target.value)} />}</Field>
                <Field id="su-email" label="Email" error={err("email")}>{(a) => <input {...a} type="email" autoComplete="email" maxLength={120} className="input" value={d.email} onChange={(e) => set("email", e.target.value)} />}</Field>
                <Field id="su-password" label="Password" hint="At least 8 characters, with a letter and a number." error={err("password")}>
                  {(a) => <PasswordInput id={a.id} invalid={a["aria-invalid"]} describedBy={a["aria-describedby"]} autoComplete="new-password" value={d.password} onChange={(v) => set("password", v)} />}
                </Field>
                <StrengthMeter password={d.password} />
                <p className="flex items-start gap-2 rounded-xl bg-raised p-3 text-sm text-muted"><LuLock aria-hidden className="mt-0.5 shrink-0" />Your password is scrambled with PBKDF2 before it's stored, and never leaves your device in this demo edition.</p>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
                  <Field id="su-age" label="Age" error={err("age")}>{(a) => <input {...a} inputMode="numeric" className="input" value={d.age} onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 2))} />}</Field>
                  <Field id="su-work" label="What you do" hint="e.g. Software engineer at a fintech" error={err("work")}>{(a) => <input {...a} maxLength={60} className="input" value={d.work} onChange={(e) => set("work", e.target.value)} />}</Field>
                </div>
                <ChoiceGroup name="su-gender" label="Gender" value={d.gender} onChange={(v) => set("gender", v)} options={[["woman", "Woman"], ["man", "Man"], ["other", "Non-binary / other"]]} />
                <p className="-mt-2 hint">Only used to hide girls-only or boys-only rooms you can't live in.</p>
                <Field id="su-city" label="City">{(a) => <select {...a} className="input" value={d.city} onChange={(e) => set("city", e.target.value as City)}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-5">
                <ChoiceGroup name="su-diet" label="What you eat" value={d.diet} onChange={(v) => set("diet", v)} options={Object.entries(DIETS) as Array<[Profile["diet"], string]>} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Toggle id="su-smokes" label="I smoke" checked={d.smokes} onChange={(v) => set("smokes", v)} />
                  <Toggle id="su-drinks" label="I drink" checked={d.drinks} onChange={(v) => set("drinks", v)} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="grid gap-5">
                <ChoiceGroup name="su-guests" label="Guests over" value={d.guests} onChange={(v) => set("guests", v)} options={Object.entries(GUESTS) as Array<[Profile["guests"], string]>} />
                <ChoiceGroup name="su-shift" label="Work hours" value={d.shift} onChange={(v) => set("shift", v)} options={Object.entries(SHIFTS) as Array<[Profile["shift"], string]>} />
              </div>
            )}

            {step === 5 && (
              <div className="grid gap-4">
                <Field id="su-budget" label="Monthly rent budget (₹)" error={err("budget")}>{(a) => <input {...a} inputMode="numeric" className="input font-mono sm:max-w-xs" value={d.budget} onChange={(e) => set("budget", e.target.value.replace(/\D/g, "").slice(0, 6))} />}</Field>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Quick budgets">
                  {[8000, 12000, 15000, 20000, 25000].map((b) => (
                    <button key={b} type="button" className="chip" aria-pressed={d.budget === String(b)} onClick={() => set("budget", String(b))}>{inr(b)}</button>
                  ))}
                </div>
                <Field id="su-about" label="A line about you (optional)" hint={`${d.about.length}/600`} error={err("about")}>{(a) => <textarea {...a} rows={3} maxLength={600} className="input" value={d.about} onChange={(e) => set("about", e.target.value)} />}</Field>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-8">
            {step > 0 ? <button type="button" className="btn-ghost" onClick={() => go(step - 1)}><LuArrowLeft aria-hidden />Back</button> : <span />}
            <button type="submit" className="btn-primary px-6" disabled={busy}>
              {busy ? <><span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Creating account…</>
                : step === STEPS.length - 1 ? "Create account" : <>Continue<LuArrowRight aria-hidden /></>}
            </button>
          </div>
        </form>
      </div>

      <aside aria-label="Preview of your flatmate card" className="lg:sticky lg:top-24">
        <p className="eyebrow mb-3">How flatmates will see you</p>
        <FlatmateCard d={d} />
      </aside>
    </div>
  );
}

/** Live preview that fills in as the person answers. Each chip pops in when its value appears or changes. */
function FlatmateCard({ d }: { d: Draft }) {
  const chip = (key: string, text: ReactNode, show = true) =>
    show ? <span key={`${key}:${String(text)}`} className="tag anim-pop py-1 text-[0.8rem]">{text}</span> : null;
  const name = d.name.trim() || "Your name";
  return (
    <div className="card grid gap-4 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span key={name.slice(0, 2)} className="anim-pop"><Avatar name={d.name.trim() || "?"} size={52} /></span>
        <div className="min-w-0">
          <p className={`truncate font-display text-lg font-bold ${d.name.trim() ? "" : "text-muted"}`}>{name}{d.age ? `, ${d.age}` : ""}</p>
          <p className="truncate text-sm text-muted">{d.work.trim() || "What you do"}</p>
        </div>
      </div>
      {d.role && <span key={d.role} className="tag tag-brand anim-pop w-fit">{ROLES[d.role]}</span>}
      <div className="flex min-h-8 flex-wrap gap-1.5">
        {chip("city", d.city)}
        {chip("diet", DIETS[d.diet])}
        {chip("smoke", d.smokes ? "Smokes" : "No smoking")}
        {chip("drink", d.drinks ? "Drinks" : "No drinking")}
        {chip("guests", GUESTS[d.guests])}
        {chip("shift", SHIFTS[d.shift])}
        {chip("budget", `Budget ${inr(Number(d.budget) || 0)}`, Number(d.budget) > 0)}
      </div>
      {d.about.trim() && <p className="anim-fade text-sm">{d.about.trim()}</p>}
    </div>
  );
}

function Welcome({ name, role, next }: { name: string; role: Role; next: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const actions = role === "lister"
    ? [["List your room", "/post"], ["See who's looking", "/flatmates"]]
    : role === "seeker"
      ? [["See rooms that fit you", next], ["Edit your profile", "/profile"]]
      : [["See rooms that fit you", next], ["List your room", "/post"]];
  return (
    <div className="wrap grid max-w-xl justify-items-center gap-5 py-16 text-center">
      <svg viewBox="0 0 80 80" width="96" height="96" aria-hidden className="anim-pop">
        <circle cx="40" cy="40" r="36" fill="var(--ok-soft)" />
        <circle cx="40" cy="40" r="36" fill="none" stroke="var(--ok)" strokeWidth="4" className="anim-draw" style={{ "--len": 227 } as CSSProperties} />
        <path d="M24 41l11 11 22-24" fill="none" stroke="var(--ok)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="anim-draw" style={{ "--len": 60, animationDelay: "360ms" } as CSSProperties} />
      </svg>
      <h1 ref={headingRef} tabIndex={-1} className="anim-rise text-3xl font-extrabold outline-none">Welcome to Kamra{name ? `, ${name.split(" ")[0]}` : ""}</h1>
      <p className="anim-rise stagger text-muted" style={{ "--i": 2 } as CSSProperties}>
        {role === "lister" ? "List your room and we'll show you how well people looking nearby fit your household." : "Every room now shows how well its household fits the way you live."}
      </p>
      <div className="anim-rise stagger flex flex-wrap justify-center gap-2" style={{ "--i": 4 } as CSSProperties}>
        <Link to={actions[0][1]} className="btn-primary px-6">{actions[0][0]}<LuArrowRight aria-hidden /></Link>
        <Link to={actions[1][1]} className="btn-secondary">{actions[1][0]}</Link>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- log in ---------------------------------------------------------------- */

export function LogInPage() {
  const account = useStore((s) => s.account);
  const { query } = useLocation();
  const next = safeNext(query.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const fieldsRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  useTitle("Log in");
  useEffect(() => { if (account && !opening) navigate(next ?? "/profile", { replace: true }); }, [account, opening, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(undefined);
    try {
      setOpening(true);
      const acc = await logIn(email, password);
      // Let the door finish opening, then go where the person was heading.
      window.setTimeout(() => navigate(next ?? homeFor(acc, getState().profile)), prefersReducedMotion() ? 0 : 650);
    } catch (x) {
      setOpening(false);
      setError(errorMessage(x));
      shakeEl(fieldsRef.current);
      document.getElementById("li-password")?.focus();
    } finally { setBusy(false); }
  };

  return (
    <div className="wrap grid max-w-4xl py-8 lg:py-14">
      <div className="card grid overflow-hidden md:grid-cols-[1fr_1.1fr]">
        <div aria-hidden className="relative hidden place-items-center bg-brand-soft p-10 md:grid">
          <Door open={opening} />
          <p className="absolute bottom-6 left-0 right-0 text-center font-display text-lg font-bold text-ink">Your next home is a door away.</p>
        </div>
        <form onSubmit={submit} noValidate className="grid content-center gap-5 p-6 sm:p-10">
          <div className="grid gap-1.5">
            <h1 className="text-3xl font-extrabold">Welcome back</h1>
            <p className="text-muted">Log in to message listers, book visits and manage your rooms.</p>
          </div>
          <div ref={fieldsRef} className="grid gap-4">
            <Field id="li-email" label="Email">{(a) => <input {...a} type="email" autoComplete="email" maxLength={120} className="input" value={email} onChange={(e) => { setEmail(e.target.value); setError(undefined); }} />}</Field>
            <Field id="li-password" label="Password">
              {(a) => <PasswordInput id={a.id} invalid={!!error} describedBy={error ? "li-error" : undefined} autoComplete="current-password" value={password} onChange={(v) => { setPassword(v); setError(undefined); }} />}
            </Field>
          </div>
          {error && <p id="li-error" role="alert" className="anim-rise rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm font-semibold text-warn">{error}</p>}
          <button type="submit" className="btn-primary h-12" disabled={busy || opening}>
            {busy || opening ? <><span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Logging in…</> : "Log in"}
          </button>
          <p className="text-sm text-muted">New to Kamra? <Link to={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand underline-offset-2 hover:underline">Create an account</Link></p>
          <p className="hint">Forgot your password? In this demo edition accounts live only in this browser, so create a new account.</p>
        </form>
      </div>
    </div>
  );
}

/** A door that swings open on successful login. */
function Door({ open }: { open: boolean }) {
  const reduce = useMemo(prefersReducedMotion, []);
  return (
    <div className="relative h-60 w-44 [perspective:700px]">
      <div className="absolute inset-0 rounded-t-[5rem] bg-ink/90" />
      <div className="absolute inset-3 top-4 overflow-hidden rounded-t-[4.5rem] bg-marigold">
        <div className="absolute bottom-0 left-1/2 h-24 w-24 -translate-x-1/2 translate-y-10 rounded-full bg-marigold-soft opacity-80 blur-xl" />
      </div>
      <div
        className="absolute inset-3 top-4 rounded-t-[4.5rem] border-4 border-ink/30 bg-brand shadow-2xl [transform-origin:left_center] [transform-style:preserve-3d]"
        style={{ transform: open ? "rotateY(-72deg)" : "rotateY(0deg)", transition: reduce ? "none" : "transform 620ms var(--ease)" }}
      >
        <span className="absolute left-1/2 top-10 h-16 w-20 -translate-x-1/2 rounded-t-[3rem] border-4 border-brand-ink/30" />
        <span className="absolute bottom-20 left-1/2 h-14 w-20 -translate-x-1/2 rounded-md border-4 border-brand-ink/30" />
        <span className="absolute right-4 top-1/2 h-3 w-3 rounded-full bg-marigold shadow" />
      </div>
    </div>
  );
}
