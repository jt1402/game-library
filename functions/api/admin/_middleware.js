import { error } from "../../../lib/games.js";

// Verifies the Cloudflare Access JWT with WebCrypto (no dependencies).
// Access signs tokens with RS256; public keys are published at /cdn-cgi/access/certs.

const b64urlBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

let keyCache = { domain: null, keys: new Map(), fetched: 0 };

async function getKey(domain, kid) {
  const stale = keyCache.domain !== domain || Date.now() - keyCache.fetched > 3600_000;
  if (stale || !keyCache.keys.has(kid)) {
    const res = await fetch(`https://${domain}/cdn-cgi/access/certs`);
    if (!res.ok) throw new Error("certs unavailable");
    const { keys = [] } = await res.json();
    const imported = new Map();
    for (const jwk of keys) {
      if (jwk.kty !== "RSA" || !jwk.kid) continue;
      imported.set(jwk.kid, await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
    }
    keyCache = { domain, keys: imported, fetched: Date.now() };
  }
  return keyCache.keys.get(kid);
}

/** Returns the token payload if valid, otherwise null. */
export async function verifyAccessJwt(token, domain, aud) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = b64urlJson(parts[0]);
    const payload = b64urlJson(parts[1]);
    if (header.alg !== "RS256") return null;
    const key = await getKey(domain, header.kid);
    if (!key) return null;
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const now = Date.now() / 1000;
    const auds = [].concat(payload.aud);
    if (payload.iss !== `https://${domain}` || !auds.includes(aud)) return null;
    if (typeof payload.exp !== "number" || payload.exp < now) return null;
    if (payload.nbf && payload.nbf > now + 60) return null;
    return payload;
  } catch {
    return null;
  }
}

function getToken(request) {
  const header = request.headers.get("cf-access-jwt-assertion");
  if (header) return header;
  const m = (request.headers.get("cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return m ? m[1] : null;
}

// Every /api/admin/* request must carry a valid Cloudflare Access JWT.
export async function onRequest(context) {
  const { request, env } = context;
  if (env.DEV_BYPASS_AUTH === "1") {
    context.data.user = "dev@localhost";
    return context.next();
  }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return error("Admin is not configured", 503);
  const token = getToken(request);
  const payload = token && (await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD));
  if (!payload) return error("Unauthorized", 401);
  context.data.user = payload.email;
  return context.next();
}
