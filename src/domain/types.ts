import { z } from "zod";

/* ---------- Indian flatshare vocabulary ---------- */

export const CITIES = ["Bengaluru", "Hyderabad", "Pune", "Mumbai", "Gurugram", "Chennai", "Noida"] as const;
export type City = (typeof CITIES)[number];

export const ROOM_TYPES = { private: "Private room", shared: "Shared room", pg: "PG / Hostel" } as const;
export const DIETS = { "pure-veg": "Pure veg", "veg-nonveg": "Veg & non-veg" } as const;
export const GENDERS = { girls: "Girls only", boys: "Boys only", any: "No restriction" } as const;
export const GUESTS = { none: "No guests", day: "Day guests only", overnight: "Overnight guests OK" } as const;
export const FURNISHING = { furnished: "Fully furnished", semi: "Semi-furnished", unfurnished: "Unfurnished" } as const;
export const SHIFTS = { day: "Day job", night: "Night shift", wfh: "Works from home" } as const;
export const AMENITIES = [
  "Wi-Fi", "AC", "Power backup", "Maid", "Cook", "Washing machine", "Fridge", "Attached bathroom",
  "Geyser", "Gated society", "Lift", "Parking", "Gym", "Meals included",
] as const;

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
export const RoomType = z.enum(keys(ROOM_TYPES));
export const Diet = z.enum(keys(DIETS));
export const GenderRule = z.enum(keys(GENDERS));
export const GuestRule = z.enum(keys(GUESTS));
export const Furnishing = z.enum(keys(FURNISHING));
export const Shift = z.enum(keys(SHIFTS));
export const Amenity = z.enum(AMENITIES);
export const CityZ = z.enum(CITIES);

export type RoomType = z.infer<typeof RoomType>;
export type Diet = z.infer<typeof Diet>;
export type GenderRule = z.infer<typeof GenderRule>;
export type GuestRule = z.infer<typeof GuestRule>;
export type Shift = z.infer<typeof Shift>;
export type Amenity = z.infer<typeof Amenity>;

/* India bounding box: rejects coordinates outside the country. */
export const INDIA = { minLat: 6.5, maxLat: 37.2, minLng: 68.0, maxLng: 97.5 } as const;
export const Lat = z.coerce.number({ invalid_type_error: "Latitude must be a number" })
  .min(INDIA.minLat, "That location is outside India").max(INDIA.maxLat, "That location is outside India");
export const Lng = z.coerce.number({ invalid_type_error: "Longitude must be a number" })
  .min(INDIA.minLng, "That location is outside India").max(INDIA.maxLng, "That location is outside India");

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} needs at least ${min} characters`).max(max, `${label} can be at most ${max} characters`);
const rupees = (label: string, min = 1000) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number` }).int(`${label} must be a whole number of rupees`)
    .min(min, `${label} must be at least ₹${min.toLocaleString("en-IN")}`).max(300000, `${label} must be under ₹3,00,000`);

export const HouseholdMember = z.object({
  name: text(1, 30, "Name"),
  age: z.coerce.number().int().min(18, "Flatmates must be 18 or older").max(80),
  work: text(2, 40, "Work"),
  shift: Shift,
});
export type HouseholdMember = z.infer<typeof HouseholdMember>;

export const ListingInput = z.object({
  title: text(8, 80, "Title"),
  description: text(30, 1500, "Description"),
  city: CityZ,
  locality: text(3, 60, "Locality"),
  lat: Lat, lng: Lng,
  rent: rupees("Rent"),
  deposit: z.coerce.number().int().min(0, "Deposit can't be negative").max(1000000, "Deposit looks too high"),
  roomType: RoomType, diet: Diet, gender: GenderRule, guests: GuestRule, furnishing: Furnishing,
  smoking: z.boolean(), drinking: z.boolean(),
  amenities: z.array(Amenity).max(AMENITIES.length),
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a move-in date"),
  household: z.array(HouseholdMember).max(10, "Add up to 10 flatmates"),
  photos: z.array(z.string().startsWith("data:image/")).max(6, "Add up to 6 photos"),
}).superRefine((v, ctx) => {
  if (v.deposit > v.rent * 12) ctx.addIssue({ code: "custom", path: ["deposit"], message: "Deposit can be at most 12 months of rent" });
});
export type ListingInput = z.infer<typeof ListingInput>;

export type Listing = Omit<ListingInput, "photos"> & {
  id: string;
  ownerId: string;
  ownerName: string;
  photos: string[];
  verified: { id: boolean; property: boolean; visited: boolean };
  createdAt: number;
  updatedAt?: number;
  status: "active" | "paused" | "let";
  demo: boolean;
};

export const Profile = z.object({
  name: text(2, 40, "Name"),
  gender: z.enum(["woman", "man", "other"]),
  diet: Diet,
  smokes: z.boolean(),
  drinks: z.boolean(),
  guests: GuestRule,
  shift: Shift,
  budget: rupees("Budget"),
  city: CityZ,
  age: z.coerce.number().int().min(18, "You must be 18 or older").max(80),
  work: text(2, 60, "Work"),
  about: z.string().trim().max(600, "Keep this under 600 characters").default(""),
  lookingForRoom: z.boolean().default(false),
});
export type Profile = z.infer<typeof Profile>;

export type Seeker = Profile & { id: string; moveIn: string; areas: string; demo: boolean; createdAt: number };

export const MessageText = text(1, 1000, "Message");

export type Thread = { id: string; listingId: string | null; seekerId: string | null; withName: string; withId: string; createdAt: number; lastAt: number; readAt: number };
export type Message = { id: string; threadId: string; from: "me" | "them"; text: string; at: number; redacted: boolean };
export type Visit = { id: string; listingId: string; slot: string; note: string; status: "requested" | "confirmed" | "cancelled"; createdAt: number };
export type Report = { id: string; listingId: string; reason: string; detail: string; at: number };

export function fieldErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) { const k = i.path.join("."); if (!(k in out)) out[k] = i.message; }
  return out;
}
