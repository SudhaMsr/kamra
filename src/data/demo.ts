import { offset } from "../domain/geo";
import { LANDMARKS } from "../domain/landmarks";
import type { Amenity, City, HouseholdMember, Listing, RoomType, Seeker } from "../domain/types";

/** Deterministic PRNG so every visitor sees the same demo city. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = mulberry32(1);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => a + rnd() * (b - a);

const BASE_RENT: Record<City, number> = { Mumbai: 21000, Bengaluru: 14500, Gurugram: 15500, Hyderabad: 11500, Pune: 10500, Chennai: 10500, Noida: 9500 };
const TYPE_FACTOR: Record<RoomType, number> = { private: 1, shared: 0.55, pg: 0.75 };

const WOMEN = ["Ananya", "Divya", "Meera", "Priya", "Sneha", "Kavya", "Fatima", "Riya", "Ishita", "Lavanya", "Pooja", "Sanya", "Nikita", "Aditi", "Shreya", "Harini"];
const MEN = ["Arjun", "Rahul", "Karthik", "Rohan", "Sai", "Vikram", "Imran", "Aditya", "Nikhil", "Varun", "Siddharth", "Kabir", "Arun", "Manish", "Tenzin", "Joel"];
const JOBS = ["Software engineer", "Data analyst", "Product designer", "QA engineer", "Consultant", "Chartered accountant", "Marketing manager", "Backend developer", "HR executive", "Support engineer", "Business analyst", "DevOps engineer"];
const SURNAME = ["R.", "S.", "K.", "M.", "N.", "P.", "D.", "I.", "V.", "A."];

const TITLES: Record<RoomType, string[]> = {
  private: ["Private room in a calm flat", "Bright private room with balcony", "Private room with attached bathroom", "Furnished room in a quiet flat", "Spacious room in a friendly flat"],
  shared: ["Budget-friendly shared room", "Twin-sharing room near the office", "Shared room with study desk", "Shared room in a sociable flat"],
  pg: ["PG with meals and housekeeping", "Single-occupancy PG room", "Managed PG with Wi-Fi and laundry", "PG room with three meals a day"],
};

const VIBES = [
  "Weekdays are quiet; on Sundays we usually cook together.",
  "Everyone keeps to themselves but we're friendly in the common area.",
  "We share a weekly grocery run and split the cook's salary.",
  "The building has 24x7 security and a lift.",
  "Good natural light and cross ventilation in the room.",
  "The society is bachelor-friendly and the owner lives nearby.",
];

function household(n: number, gender: Listing["gender"]): HouseholdMember[] {
  return Array.from({ length: n }, () => {
    const woman = gender === "girls" ? true : gender === "boys" ? false : rnd() < 0.5;
    return { name: pick(woman ? WOMEN : MEN), age: Math.round(between(22, 33)), work: pick(JOBS), shift: rnd() < 0.15 ? "night" : rnd() < 0.3 ? "wfh" : "day" };
  });
}

function makeListings(): Listing[] {
  const out: Listing[] = [];
  const now = Date.UTC(2026, 9, 30);
  let n = 0;
  for (const lm of LANDMARKS) {
    const count = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < count; i++) {
      n++;
      const roomType: RoomType = rnd() < 0.6 ? "private" : rnd() < 0.55 ? "shared" : "pg";
      const gender: Listing["gender"] = roomType === "pg" ? (rnd() < 0.5 ? "girls" : "boys") : rnd() < 0.6 ? "any" : rnd() < 0.55 ? "girls" : "boys";
      const diet: Listing["diet"] = rnd() < 0.3 ? "pure-veg" : "veg-nonveg";
      const pt = offset(lm.lat, lm.lng, between(250, 5200), between(0, 360));
      const rent = Math.round((BASE_RENT[lm.city] * TYPE_FACTOR[roomType] * between(0.8, 1.35)) / 500) * 500;
      const locality = pick(lm.localities);
      const members = roomType === "pg" ? [] : household(1 + Math.floor(rnd() * 3), gender);
      const amenities: Amenity[] = (["Wi-Fi", "Power backup", "Maid", "Washing machine", "Fridge", "Geyser", "AC", "Cook", "Gated society", "Lift", "Parking", "Attached bathroom", "Gym"] as const)
        .filter(() => rnd() < 0.45);
      if (roomType === "pg") amenities.push("Meals included");
      const ownerName = members[0] ? `${members[0].name} ${pick(SURNAME)}` : `${pick([...WOMEN, ...MEN])} ${pick(SURNAME)}`;
      const strict = diet === "pure-veg" || gender !== "any" && rnd() < 0.5;
      out.push({
        id: `d${String(n).padStart(3, "0")}`,
        title: TITLES[roomType][n % TITLES[roomType].length],
        description: [
          roomType === "pg"
            ? `Managed PG in ${locality}, about ${Math.round(between(8, 25))} minutes from ${lm.short}. Rent covers meals, housekeeping and electricity up to a fair-use limit.`
            : `Looking for a flatmate for a ${pick(["2BHK", "3BHK", "3BHK", "4BHK"])} in ${locality}, close to ${lm.short}.`,
          pick(VIBES),
          diet === "pure-veg" ? "The kitchen is strictly vegetarian, including eggs." : "Both veg and non-veg are cooked at home.",
        ].join(" "),
        city: lm.city, locality, lat: Number(pt.lat.toFixed(6)), lng: Number(pt.lng.toFixed(6)),
        rent, deposit: rent * (lm.city === "Bengaluru" ? pick([3, 4, 6]) : pick([1, 2, 2, 3])),
        roomType, diet, gender,
        guests: strict ? pick(["none", "day"] as const) : pick(["day", "overnight", "overnight"] as const),
        furnishing: roomType === "pg" ? "furnished" : pick(["furnished", "furnished", "semi"] as const),
        smoking: !strict && rnd() < 0.25, drinking: !strict && rnd() < 0.55,
        amenities: [...new Set(amenities)],
        availableFrom: new Date(now + Math.floor(between(1, 40)) * 86_400_000).toISOString().slice(0, 10),
        household: members, photos: [],
        ownerId: `owner-${n}`, ownerName,
        verified: { id: rnd() < 0.85, property: rnd() < 0.6, visited: rnd() < 0.35 },
        createdAt: now - Math.floor(between(1, 30 * 24)) * 3_600_000,
        status: "active", demo: true,
      });
    }
  }
  return out;
}

function makeSeekers(): Seeker[] {
  const cities = [...new Set(LANDMARKS.map((l) => l.city))];
  return Array.from({ length: 18 }, (_, i) => {
    const woman = rnd() < 0.5;
    const city = cities[i % cities.length];
    const lms = LANDMARKS.filter((l) => l.city === city);
    return {
      id: `s${String(i + 1).padStart(3, "0")}`,
      name: `${pick(woman ? WOMEN : MEN)} ${pick(SURNAME)}`, gender: woman ? "woman" : "man",
      age: Math.round(between(21, 32)), work: pick(JOBS), city,
      diet: rnd() < 0.35 ? "pure-veg" : "veg-nonveg", smokes: rnd() < 0.15, drinks: rnd() < 0.5,
      guests: pick(["none", "day", "overnight"] as const), shift: rnd() < 0.15 ? "night" : rnd() < 0.3 ? "wfh" : "day",
      budget: Math.round((BASE_RENT[city] * between(0.7, 1.3)) / 500) * 500,
      about: pick([
        "Moving for a new job. Tidy, quiet on weekdays and happy to share chores.",
        "Relocating from my hometown. I cook most days and like a clean kitchen.",
        "Travel for work twice a month, so the room is often empty. Very low maintenance.",
        "Early riser, go to the gym before work. Looking for a calm flat.",
        "Into board games and weekend treks. Friendly but respect privacy.",
      ]),
      lookingForRoom: true,
      areas: lms.slice(0, 2).map((l) => l.localities[0]).join(", "),
      moveIn: new Date(Date.UTC(2026, 10, 1) + Math.floor(between(0, 45)) * 86_400_000).toISOString().slice(0, 10),
      demo: true, createdAt: Date.UTC(2026, 9, 30) - i * 7_200_000,
    };
  });
}

export function buildDemo(seed: number): { listings: Listing[]; seekers: Seeker[] } {
  rnd = mulberry32(seed);
  return { listings: makeListings(), seekers: makeSeekers() };
}
export const DEMO_SEED = 20261031;
const demo = buildDemo(DEMO_SEED);
export const DEMO_LISTINGS: Listing[] = demo.listings;
export const DEMO_SEEKERS: Seeker[] = demo.seekers;
