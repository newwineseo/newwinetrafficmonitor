// Signed session cookie using Web Crypto, so it works in middleware (edge) and in route handlers.
export const SESSION_COOKIE = "nw_session";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, in seconds

const enc = new TextEncoder();

async function hmacHex(data: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET is missing or too short");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  return `${exp}.${await hmacHex(`session.${exp}`)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now()) return false;
  try {
    return safeEqual(sig, await hmacHex(`session.${exp}`));
  } catch {
    return false;
  }
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Compare HMACs so the comparison time does not depend on the password.
  return safeEqual(await hmacHex(`pw.${input}`), await hmacHex(`pw.${expected}`));
}

// Login rate limit: 5 failed attempts per IP per 15 minutes. Kept in memory, so it is per server
// instance; combined with the delay on failure this makes guessing impractical for a shared password.
const attempts = new Map<string, { fails: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

export function isRateLimited(ip: string): boolean {
  const a = attempts.get(ip);
  return !!a && a.resetAt > Date.now() && a.fails >= MAX_FAILS;
}

export function recordFailure(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.resetAt <= now) attempts.set(ip, { fails: 1, resetAt: now + WINDOW_MS });
  else a.fails++;
}

export function clearFailures(ip: string) {
  attempts.delete(ip);
}
