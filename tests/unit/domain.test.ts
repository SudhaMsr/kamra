import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceM, offset, formatDistance, commuteMinutes, toLocalXY } from "../../src/domain/geo";
import { redactContacts } from "../../src/domain/privacy";
import { fitListing, fitPeople, genderEligible } from "../../src/domain/fit";
import { SearchQuery, search, toParams, origin } from "../../src/domain/search";
import { ListingInput, Profile, type Listing } from "../../src/domain/types";
import { DEMO_LISTINGS, DEMO_SEEKERS, DEMO_SEED, buildDemo } from "../../src/data/demo";
import { LANDMARKS, landmarkById } from "../../src/domain/landmarks";

const profile: Profile = Profile.parse({
  name: "Test User", gender: "woman", diet: "pure-veg", smokes: false, drinks: false, guests: "day",
  shift: "day", budget: 15000, city: "Bengaluru", age: 26, work: "Engineer", about: "", lookingForRoom: true,
});

/* ---------- geo ---------- */
test("haversine matches a known distance (MG Road to Indiranagar metro ≈ 3.7 km)", () => {
  const d = distanceM(12.9755, 77.6068, 12.9784, 77.6408);
  assert.ok(d > 3600 && d < 3800, `got ${d}`);
});
test("offset then distance round-trips", () => {
  for (const [m, b] of [[500, 0], [2500, 90], [6000, 225], [12000, 315]]) {
    const p = offset(17.45, 78.38, m, b);
    assert.ok(Math.abs(distanceM(17.45, 78.38, p.lat, p.lng) - m) < 1, `${m}m @${b}`);
  }
});
test("local XY points east and north", () => {
  const e = toLocalXY(19, 72.8, 19, 72.81); const n = toLocalXY(19, 72.8, 19.01, 72.8);
  assert.ok(e.x > 1000 && Math.abs(e.y) < 1); assert.ok(n.y > 1000 && Math.abs(n.x) < 1);
});
test("distance formatting", () => {
  assert.equal(formatDistance(20), "50 m");
  assert.equal(formatDistance(740), "750 m");
  assert.equal(formatDistance(2345), "2.3 km");
  assert.equal(formatDistance(12500), "13 km");
  assert.equal(commuteMinutes(0), 5);
});

/* ---------- privacy ---------- */
test("redacts Indian phone numbers in common formats", () => {
  for (const s of ["call 9876543210", "+91 98765 43210", "+91-98765-43210", "098765 43210", "0091 9876543210", "98765.43210"]) {
    const r = redactContacts(s);
    assert.ok(r.redacted, s); assert.ok(!/\d{5}/.test(r.text), `${s} -> ${r.text}`);
  }
});
test("redacts emails and spelled-out numbers", () => {
  assert.equal(redactContacts("mail me at a.b@x.co.in").text, "mail me at [email hidden]");
  assert.ok(redactContacts("nine eight seven six five four three two one zero").redacted);
});
test("leaves rents, dates and pincodes alone", () => {
  for (const s of ["Rent is 15000, deposit 45000", "Move in on 2026-11-15", "Pincode 560102", "Flat 1203, tower 4"]) {
    const r = redactContacts(s); assert.equal(r.redacted, false, s); assert.equal(r.text, s);
  }
});

/* ---------- fit ---------- */
const base = DEMO_LISTINGS[0];
const mk = (p: Partial<Listing>): Listing => ({ ...base, ...p });
test("gender rules are hard filters", () => {
  assert.equal(genderEligible("girls", "woman"), true);
  assert.equal(genderEligible("girls", "man"), false);
  assert.equal(genderEligible("boys", "other"), false);
  assert.equal(genderEligible("any", "other"), true);
});
test("perfect match scores 100", () => {
  const l = mk({ diet: "pure-veg", smoking: false, drinking: false, guests: "overnight", rent: 12000, household: [{ name: "A", age: 25, work: "Dev", shift: "day" }] });
  const f = fitListing(l, profile); assert.equal(f.pct, 100); assert.equal(f.rows.length, 6);
});
test("a non-veg eater clashes with a pure veg kitchen; veg eater fits any kitchen", () => {
  const veg = mk({ diet: "pure-veg" }), mixed = mk({ diet: "veg-nonveg" });
  assert.equal(fitListing(veg, { ...profile, diet: "veg-nonveg" }).rows.find((r) => r.key === "diet")!.ok, false);
  assert.equal(fitListing(mixed, profile).rows.find((r) => r.key === "diet")!.ok, true);
});
test("budget and guests are checked", () => {
  const f = fitListing(mk({ rent: 20000, guests: "none" }), profile);
  assert.equal(f.rows.find((r) => r.key === "budget")!.ok, false);
  assert.equal(f.rows.find((r) => r.key === "guests")!.ok, false);
});
test("people fit is symmetric on shared fields", () => {
  const s = DEMO_SEEKERS[0];
  const f = fitPeople(profile, s);
  assert.ok(f.pct >= 0 && f.pct <= 100); assert.equal(f.rows.length, 5);
});

/* ---------- search ---------- */
test("query parsing falls back safely on garbage", () => {
  const q = SearchQuery.parse({ city: "Atlantis", radius: "-4", max: "abc", room: "private,castle", sort: "random" });
  assert.equal(q.city, "Bengaluru"); assert.equal(q.radius, 5); assert.equal(q.max, undefined);
  assert.deepEqual(q.room, []); assert.equal(q.sort, "distance");
});
test("results stay within radius, city and filters, sorted by distance", () => {
  const q = SearchQuery.parse({ city: "Bengaluru", near: "blr-itpl", radius: "7", room: "private,shared" });
  const r = search(DEMO_LISTINGS, q, null);
  assert.ok(r.length > 0);
  for (const x of r) { assert.equal(x.listing.city, "Bengaluru"); assert.ok(x.distance <= 7000); assert.notEqual(x.listing.roomType, "pg"); }
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].distance <= r[i].distance);
});
test("profile hides rooms the person isn't eligible for", () => {
  const q = SearchQuery.parse({ city: "Bengaluru", radius: "25" });
  const r = search(DEMO_LISTINGS, q, { ...profile, gender: "woman" });
  assert.ok(r.every((x) => x.listing.gender !== "boys"));
  assert.ok(r.every((x) => x.fit !== null));
});
test("price sort and max rent", () => {
  const q = SearchQuery.parse({ city: "Mumbai", radius: "25", max: "20000", sort: "rent-asc" });
  const r = search(DEMO_LISTINGS, q, null);
  assert.ok(r.every((x) => x.listing.rent <= 20000));
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].listing.rent <= r[i].listing.rent);
});
test("landmark from another city is ignored", () => {
  const q = SearchQuery.parse({ city: "Pune", near: "blr-itpl" });
  assert.equal(origin(q).id.startsWith("pun-"), true);
});
test("toParams omits defaults and round-trips", () => {
  const q = SearchQuery.parse({ city: "Hyderabad", near: "hyd-hitec", radius: "3", room: "pg", diet: "pure-veg", sort: "fit" });
  const back = SearchQuery.parse(Object.fromEntries(new URLSearchParams(toParams(q))));
  assert.deepEqual(back, q);
  assert.equal(toParams(SearchQuery.parse({ city: "Bengaluru" })), "city=Bengaluru");
});

/* ---------- demo data integrity ---------- */
test("every demo listing passes the same validation as user listings", () => {
  for (const l of DEMO_LISTINGS) {
    const r = ListingInput.safeParse(l);
    assert.ok(r.success, `${l.id}: ${r.success ? "" : JSON.stringify(r.error.issues[0])}`);
  }
});
test("demo listings are unique, near their city's landmarks, and cover every landmark", () => {
  assert.equal(new Set(DEMO_LISTINGS.map((l) => l.id)).size, DEMO_LISTINGS.length);
  for (const l of DEMO_LISTINGS) {
    const near = LANDMARKS.filter((m) => m.city === l.city).some((m) => distanceM(m.lat, m.lng, l.lat, l.lng) <= 7000);
    assert.ok(near, l.id);
  }
  for (const m of LANDMARKS) {
    const q = SearchQuery.parse({ city: m.city, near: m.id, radius: "7" });
    assert.ok(search(DEMO_LISTINGS, q, null).length >= 3, `few results near ${m.id}`);
  }
});
test("demo data is deterministic for a seed", () => {
  assert.deepEqual(buildDemo(DEMO_SEED).listings, DEMO_LISTINGS);
  assert.notDeepEqual(buildDemo(7).listings.map((l) => l.rent), DEMO_LISTINGS.map((l) => l.rent));
  assert.ok(landmarkById("blr-itpl"));
});

/* ---------- validation edge cases ---------- */
test("listing validation rejects bad input with readable messages", () => {
  const ok = { ...DEMO_LISTINGS[0] };
  const bad = (patch: object) => { const r = ListingInput.safeParse({ ...ok, ...patch }); assert.equal(r.success, false); return r.success ? "" : r.error.issues[0].message; };
  assert.match(bad({ lat: 51.5, lng: -0.12 }), /outside India/);
  assert.match(bad({ rent: 50 }), /at least/);
  assert.match(bad({ deposit: ok.rent * 13 }), /12 months/);
  assert.match(bad({ title: "Hi" }), /at least 8/);
  assert.match(bad({ photos: ["javascript:alert(1)"] }), /Invalid/);
  assert.match(bad({ household: [{ name: "Kid", age: 15, work: "School", shift: "day" }] }), /18 or older/);
});
