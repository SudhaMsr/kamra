import type { GuestRule, Listing, Profile, Seeker } from "./types";
import { SHIFTS } from "./types";

export type FitRow = { key: string; label: string; ok: boolean; detail: string };
export type Fit = { pct: number; rows: FitRow[] };

const GUEST_RANK: Record<GuestRule, number> = { none: 0, day: 1, overnight: 2 };
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

/** Hard rule: can this person live here at all? */
export function genderEligible(rule: Listing["gender"], g: Profile["gender"]): boolean {
  if (rule === "girls") return g === "woman";
  if (rule === "boys") return g === "man";
  return true;
}

const score = (rows: FitRow[]) => Math.round((rows.filter((r) => r.ok).length / rows.length) * 100);

export function fitListing(l: Listing, p: Profile): Fit {
  const shifts = [...new Set(l.household.map((h) => h.shift))];
  const shiftOk = p.shift === "wfh" || shifts.length === 0 || shifts.includes(p.shift) || (p.shift === "day" && shifts.includes("wfh"));
  const rows: FitRow[] = [
    { key: "diet", label: "Kitchen", ok: l.diet === "veg-nonveg" || p.diet === "pure-veg",
      detail: l.diet === "pure-veg" ? `Pure veg kitchen. You eat ${p.diet === "pure-veg" ? "pure veg" : "non-veg too"}.` : "Veg and non-veg both cooked here." },
    { key: "smoking", label: "Smoking", ok: l.smoking || !p.smokes, detail: `${l.smoking ? "Smoking allowed" : "No smoking"}. You ${p.smokes ? "smoke" : "don't smoke"}.` },
    { key: "drinking", label: "Drinking", ok: l.drinking || !p.drinks, detail: `${l.drinking ? "Drinking is fine" : "No drinking"}. You ${p.drinks ? "drink" : "don't drink"}.` },
    { key: "guests", label: "Guests", ok: GUEST_RANK[p.guests] <= GUEST_RANK[l.guests], detail: `House rule: ${guestText(l.guests)}. You want: ${guestText(p.guests)}.` },
    { key: "shift", label: "Work hours", ok: shiftOk, detail: `Flatmates: ${shifts.map((s) => SHIFTS[s].toLowerCase()).join(", ") || "not listed"}. You: ${SHIFTS[p.shift].toLowerCase()}.` },
    { key: "budget", label: "Budget", ok: l.rent <= p.budget, detail: `Rent ${inr(l.rent)} against your budget of ${inr(p.budget)}.` },
  ];
  return { pct: score(rows), rows };
}

export function fitPeople(a: Profile, b: Seeker): Fit {
  const rows: FitRow[] = [
    { key: "diet", label: "Food", ok: a.diet === b.diet, detail: `${dietText(a.diet)} and ${dietText(b.diet)}` },
    { key: "smoking", label: "Smoking", ok: a.smokes === b.smokes, detail: `${a.smokes ? "Smokes" : "Doesn't smoke"} and ${b.smokes ? "smokes" : "doesn't smoke"}` },
    { key: "drinking", label: "Drinking", ok: a.drinks === b.drinks, detail: `${a.drinks ? "Drinks" : "Doesn't drink"} and ${b.drinks ? "drinks" : "doesn't drink"}` },
    { key: "guests", label: "Guests", ok: Math.abs(GUEST_RANK[a.guests] - GUEST_RANK[b.guests]) <= 1, detail: `${guestText(a.guests)} and ${guestText(b.guests)}` },
    { key: "shift", label: "Work hours", ok: a.shift === b.shift || a.shift === "wfh" || b.shift === "wfh", detail: `${SHIFTS[a.shift]} and ${SHIFTS[b.shift].toLowerCase()}` },
  ];
  return { pct: score(rows), rows };
}

const guestText = (g: GuestRule) => ({ none: "no guests", day: "day guests only", overnight: "overnight guests" })[g];
const dietText = (d: Profile["diet"]) => (d === "pure-veg" ? "Pure veg" : "Veg & non-veg");
