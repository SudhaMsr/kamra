import type { City } from "./types";

export type LandmarkKind = "tech-park" | "metro" | "business-district";
export type Landmark = { id: string; name: string; short: string; kind: LandmarkKind; city: City; lat: number; lng: number; localities: string[] };

/** Approximate centre points of major work hubs and transit stops. */
export const LANDMARKS: Landmark[] = [
  { id: "blr-itpl", name: "ITPL, Whitefield", short: "ITPL", kind: "tech-park", city: "Bengaluru", lat: 12.9857, lng: 77.7350, localities: ["Whitefield", "Brookefield", "Kundalahalli", "Hoodi"] },
  { id: "blr-manyata", name: "Manyata Tech Park", short: "Manyata", kind: "tech-park", city: "Bengaluru", lat: 13.0475, lng: 77.6206, localities: ["Nagawara", "Hebbal", "Thanisandra", "HBR Layout"] },
  { id: "blr-ecity", name: "Electronic City Phase 1", short: "Electronic City", kind: "tech-park", city: "Bengaluru", lat: 12.8452, lng: 77.6602, localities: ["Electronic City", "Neeladri Nagar", "Doddathoguru", "Hosa Road"] },
  { id: "blr-ecospace", name: "Ecospace, Bellandur", short: "ORR Bellandur", kind: "tech-park", city: "Bengaluru", lat: 12.9262, lng: 77.6822, localities: ["Bellandur", "HSR Layout", "Kadubeesanahalli", "Sarjapur Road"] },
  { id: "blr-indiranagar", name: "Indiranagar Metro", short: "Indiranagar", kind: "metro", city: "Bengaluru", lat: 12.9784, lng: 77.6408, localities: ["Indiranagar", "Domlur", "HAL 2nd Stage", "Jeevan Bima Nagar"] },
  { id: "blr-koramangala", name: "Koramangala", short: "Koramangala", kind: "business-district", city: "Bengaluru", lat: 12.9352, lng: 77.6245, localities: ["Koramangala 5th Block", "Ejipura", "BTM Layout", "Adugodi"] },

  { id: "hyd-hitec", name: "HITEC City", short: "HITEC City", kind: "tech-park", city: "Hyderabad", lat: 17.4504, lng: 78.3812, localities: ["Madhapur", "Kondapur", "Kavuri Hills", "Jubilee Hills"] },
  { id: "hyd-fd", name: "Financial District", short: "Financial District", kind: "tech-park", city: "Hyderabad", lat: 17.4146, lng: 78.3444, localities: ["Nanakramguda", "Gachibowli", "Manikonda", "Puppalaguda"] },
  { id: "hyd-ameerpet", name: "Ameerpet Metro", short: "Ameerpet", kind: "metro", city: "Hyderabad", lat: 17.4375, lng: 78.4482, localities: ["Ameerpet", "SR Nagar", "Begumpet", "Punjagutta"] },

  { id: "pun-hinjewadi", name: "Rajiv Gandhi Infotech Park, Hinjewadi", short: "Hinjewadi", kind: "tech-park", city: "Pune", lat: 18.5913, lng: 73.7389, localities: ["Hinjewadi Phase 1", "Wakad", "Maan", "Marunji"] },
  { id: "pun-kharadi", name: "EON IT Park, Kharadi", short: "Kharadi", kind: "tech-park", city: "Pune", lat: 18.5515, lng: 73.9497, localities: ["Kharadi", "Viman Nagar", "Wagholi", "Chandan Nagar"] },
  { id: "pun-baner", name: "Baner", short: "Baner", kind: "business-district", city: "Pune", lat: 18.5590, lng: 73.7868, localities: ["Baner", "Balewadi", "Aundh", "Pashan"] },

  { id: "mum-bkc", name: "Bandra Kurla Complex", short: "BKC", kind: "business-district", city: "Mumbai", lat: 19.0660, lng: 72.8650, localities: ["Kalina", "Bandra East", "Kurla West", "Santacruz East"] },
  { id: "mum-powai", name: "Powai, Hiranandani", short: "Powai", kind: "business-district", city: "Mumbai", lat: 19.1197, lng: 72.9081, localities: ["Powai", "Chandivali", "Kanjurmarg West", "Saki Vihar Road"] },
  { id: "mum-andheri", name: "Andheri Metro", short: "Andheri", kind: "metro", city: "Mumbai", lat: 19.1197, lng: 72.8464, localities: ["Andheri East", "Andheri West", "Marol", "JB Nagar"] },

  { id: "ggn-cyber", name: "DLF Cyber City", short: "Cyber City", kind: "tech-park", city: "Gurugram", lat: 28.4950, lng: 77.0895, localities: ["DLF Phase 2", "DLF Phase 3", "Sikanderpur", "Nathupur"] },
  { id: "ggn-golf", name: "Golf Course Road", short: "Golf Course Rd", kind: "business-district", city: "Gurugram", lat: 28.4446, lng: 77.1007, localities: ["Sector 54", "Sector 56", "Sector 43", "DLF Phase 5"] },

  { id: "che-tidel", name: "Tidel Park", short: "Tidel Park", kind: "tech-park", city: "Chennai", lat: 12.9893, lng: 80.2486, localities: ["Taramani", "Thiruvanmiyur", "Kottivakkam", "Velachery"] },
  { id: "che-elcot", name: "ELCOT SEZ, Sholinganallur", short: "Sholinganallur", kind: "tech-park", city: "Chennai", lat: 12.9010, lng: 80.2279, localities: ["Sholinganallur", "Perungudi", "Karapakkam", "Thoraipakkam"] },

  { id: "noi-62", name: "Sector 62 IT hub", short: "Sector 62", kind: "tech-park", city: "Noida", lat: 28.6270, lng: 77.3720, localities: ["Sector 62", "Sector 63", "Indirapuram", "Sector 71"] },
];

export const landmarkById = (id: string | null | undefined) => LANDMARKS.find((l) => l.id === id);
export const landmarksIn = (city: City) => LANDMARKS.filter((l) => l.city === city);
export const KIND_LABEL: Record<LandmarkKind, string> = { "tech-park": "Tech park", metro: "Metro", "business-district": "Business district" };
