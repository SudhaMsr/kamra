const R = 6_371_008.8; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point at a distance (m) and bearing (deg) from an origin. */
export function offset(lat: number, lng: number, metres: number, bearingDeg: number): { lat: number; lng: number } {
  const d = metres / R, b = rad(bearingDeg), p1 = rad(lat), l1 = rad(lng);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: (p2 * 180) / Math.PI, lng: (((l2 * 180) / Math.PI + 540) % 360) - 180 };
}

/** Local east/north metres from an origin (equirectangular; accurate within tens of km). */
export function toLocalXY(oLat: number, oLng: number, lat: number, lng: number): { x: number; y: number } {
  return { x: rad(lng - oLng) * Math.cos(rad(oLat)) * R, y: rad(lat - oLat) * R };
}

export function formatDistance(m: number): string {
  if (m < 950) return `${Math.max(50, Math.round(m / 50) * 50)} m`;
  return `${(m / 1000).toFixed(m < 9950 ? 1 : 0)} km`;
}

/** Rough door-to-door commute in Indian city traffic: ~18 km/h average plus 5 min. */
export const commuteMinutes = (m: number) => Math.round(5 + (m / 1000 / 18) * 60);

export const formatCoord = (lat: number, lng: number) =>
  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`;
