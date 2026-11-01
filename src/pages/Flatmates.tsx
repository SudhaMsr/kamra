import { useMemo, useRef, useState } from "react";
import { LuMessageCircle, LuRotateCcw, LuSparkles, LuUsers } from "react-icons/lu";
import { Avatar, Dialog, Empty, FitBadge, FitBreakdown, useToast } from "../components/ui";
import { allSeekers, findSeeker, openThread, sendMessage, useStore } from "../data/store";
import { fitPeople, type Fit } from "../domain/fit";
import { CITIES, DIETS, GUESTS, SHIFTS, type City, type Seeker } from "../domain/types";
import { errorMessage } from "../lib/errors";
import { inr, niceDate } from "../lib/format";
import { Link, navigate, useLocation, useTitle } from "../lib/router";

export function Flatmates() {
  useTitle("Flatmates looking for a room");
  const profile = useStore((s) => s.profile);
  const { query } = useLocation();
  const city = (CITIES as readonly string[]).includes(query.get("city") ?? "") ? (query.get("city") as City) : profile?.city ?? "Bengaluru";
  const [open, setOpen] = useState<string | null>(null);
  const toast = useToast();

  const people = useMemo(() => allSeekers()
    .filter((s) => s.city === city)
    .map((s) => ({ s, fit: profile ? fitPeople(profile, s) : null }))
    .sort((a, b) => (b.fit?.pct ?? 0) - (a.fit?.pct ?? 0) || b.s.createdAt - a.s.createdAt), [city, profile]);
  const sel = open ? findSeeker(open) : undefined;
  const selFit = sel && profile ? fitPeople(profile, sel) : null;

  const message = () => {
    if (!sel) return;
    if (!profile) { navigate("/signup?next=" + encodeURIComponent("/flatmates")); return; }
    try {
      const t = openThread({ seeker: sel });
      sendMessage(t.id, `Hi ${sel.name.split(" ")[0]}, I saw you're looking for a room in ${sel.city}. I have a place you might like. Want to chat?`);
      setOpen(null);
      navigate(`/messages/${t.id}`);
    } catch (e) { toast(errorMessage(e), "error"); }
  };

  return (
    <div className="wrap grid gap-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <p className="eyebrow">For people with a room to fill</p>
          <h1 className="text-3xl font-extrabold">People looking in {city}</h1>
          <p className="text-muted">{profile ? "Sorted by how well they'd fit with you." : "Add your lifestyle to see who you'd get along with."}</p>
        </div>
        <div className="field">
          <label htmlFor="fm-city" className="label">City</label>
          <select id="fm-city" className="input w-auto" value={city} onChange={(e) => navigate(`/flatmates?city=${encodeURIComponent(e.target.value)}`, { replace: true })}>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {people.length === 0 ? (
        <Empty icon={<LuUsers size={26} />} title={`No one listed in ${city} yet`} body="List your room and people searching nearby will find you."
          action={<Link to="/post" className="btn-primary">List a room</Link>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map(({ s, fit }) => (
            <FlipCard key={s.id} s={s} fit={fit} signedIn={!!profile} onView={() => setOpen(s.id)} />
          ))}
        </ul>
      )}

      <Dialog open={!!sel} onClose={() => setOpen(null)} title={sel ? `${sel.name}, ${sel.age}` : ""}>
        {sel && (
          <div className="grid gap-4">
            <p>{sel.about}</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[["Works as", sel.work], ["Budget", inr(sel.budget)], ["Food", DIETS[sel.diet]], ["Guests", GUESTS[sel.guests]], ["Hours", SHIFTS[sel.shift]], ["Smokes / drinks", `${sel.smokes ? "Smokes" : "No smoking"} · ${sel.drinks ? "Drinks" : "No drinking"}`]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-raised p-3"><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
            {selFit && <><h3 className="font-bold">How you'd get along</h3><FitBreakdown fit={selFit} /></>}
            <button type="button" className="btn-primary" onClick={message}><LuMessageCircle aria-hidden />{profile ? `Message ${sel.name.split(" ")[0]}` : "Sign up to message"}</button>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/**
 * A flatmate card that flips in 3D: profile on the front, "how you'd get along" on the back.
 * Only the visible face is reachable by keyboard and screen readers (the other is inert).
 */
function FlipCard({ s, fit, signedIn, onView }: { s: Seeker; fit: Fit | null; signedIn: boolean; onView: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const frontBtn = useRef<HTMLButtonElement>(null);
  const backBtn = useRef<HTMLButtonElement>(null);
  const flip = (to: boolean) => {
    setFlipped(to);
    // Keep focus on the matching control of the face that's now showing.
    requestAnimationFrame(() => (to ? backBtn : frontBtn).current?.focus({ preventScroll: true }));
  };
  const face = "card col-start-1 row-start-1 grid content-start gap-3 p-5 [backface-visibility:hidden]";
  return (
    <li className="[perspective:1200px]" data-testid="flatmate-card" data-flipped={flipped || undefined}>
      <div className="grid transition-transform duration-[var(--t-slow)] ease-[var(--ease)] [transform-style:preserve-3d]" style={{ transform: flipped ? "rotateY(180deg)" : "none" }}>
        <div className={face} inert={flipped || undefined} aria-hidden={flipped || undefined}>
          <div className="flex items-center gap-3">
            <Avatar name={s.name} size={48} />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">{s.name}, {s.age}</h2>
              <p className="truncate text-sm text-muted">{s.work}</p>
            </div>
          </div>
          <p className="text-sm">{s.about}</p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-muted">Budget</dt><dd className="font-mono font-semibold">{inr(s.budget)}</dd></div>
            <div><dt className="text-muted">Moving</dt><dd className="font-semibold">{niceDate(s.moveIn)}</dd></div>
            <div className="col-span-2"><dt className="text-muted">Areas</dt><dd className="font-semibold">{s.areas}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-1.5">
            {fit && <FitBadge fit={fit} />}
            <span className="tag">{DIETS[s.diet]}</span><span className="tag">{SHIFTS[s.shift]}</span>
          </div>
          <div className="mt-1 grid gap-2">
            <button ref={frontBtn} type="button" className="btn-ghost border border-line" onClick={() => flip(true)}><LuSparkles aria-hidden />How you'd get along</button>
            <button type="button" className="btn-secondary" onClick={onView} aria-haspopup="dialog">View profile</button>
          </div>
        </div>
        <div className={`${face} [transform:rotateY(180deg)]`} inert={!flipped || undefined} aria-hidden={!flipped || undefined}>
          <h2 className="text-lg font-bold">You and {s.name.split(" ")[0]}</h2>
          {fit ? (
            <><FitBadge fit={fit} /><FitBreakdown fit={fit} /></>
          ) : (
            <p className="text-muted">{signedIn ? "Add your lifestyle to compare." : "Sign up and tell us how you live to see how you'd get along."}</p>
          )}
          {!signedIn && <Link to="/signup?next=%2Fflatmates" className="btn-primary">Sign up free</Link>}
          <button ref={backBtn} type="button" className="btn-ghost justify-self-start" onClick={() => flip(false)}><LuRotateCcw aria-hidden />Back to profile</button>
        </div>
      </div>
    </li>
  );
}
