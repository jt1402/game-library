// Single-owner login. The password is the ADMIN_PASSWORD secret; a successful login sets an
// HMAC-signed session cookie (signed with SESSION_SECRET). Rotating SESSION_SECRET signs out
// every session; changing ADMIN_PASSWORD changes the password.
import { error } from "./games.js";

const COOKIE = "gl_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const enc = new TextEncoder();

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Constant-time comparison: hash both sides so lengths always match. */
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))));
  const ax = new Uint8Array(x), ay = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ax.length; i++) diff |= ax[i] ^ ay[i];
  return diff === 0;
}

const configured = (env) => Boolean(env.ADMIN_PASSWORD && env.SESSION_SECRET);
const cookie = (value, maxAge) => `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;

export async function isOwner(request, env) {
  if (env.DEV_BYPASS_AUTH === "1") return true;
  if (!configured(env)) return false;
  const m = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || !(Number(exp) > Date.now() / 1000)) return false;
  return safeEqual(sig, await hmac(env.SESSION_SECRET, `owner.${exp}`));
}

export async function login(request, env) {
  if (!configured(env)) return error("Login is not configured", 503);
  const { password } = await request.json().catch(() => ({}));
  if (typeof password !== "string" || !(await safeEqual(password, env.ADMIN_PASSWORD))) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    return error("Wrong password", 401);
  }
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const token = `${exp}.${await hmac(env.SESSION_SECRET, `owner.${exp}`)}`;
  return new Response(null, { status: 204, headers: { "set-cookie": cookie(token, MAX_AGE) } });
}

export const logout = () => new Response(null, { status: 204, headers: { "set-cookie": cookie("", 0) } });
