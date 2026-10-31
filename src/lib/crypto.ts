/** Password hashing with the browser's WebCrypto: PBKDF2-SHA256, 210,000 iterations (OWASP 2023 guidance). */
const ITERATIONS = 210_000;
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

export function randomSalt(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return hex(a.buffer);
}

/** Needs a secure context (https or localhost). GitHub Pages is https. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("This browser can't protect your password here. Open the site over https.");
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: ITERATIONS }, key, 256);
  return `pbkdf2$${ITERATIONS}$${hex(bits)}`;
}

/** Constant-time comparison so timing doesn't reveal how much of a hash matched. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
