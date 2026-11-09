import { createRemoteJWKSet, jwtVerify } from "jose";
import { error } from "../../../lib/games.js";

let jwks, jwksDomain;

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
  if (!token) return error("Unauthorized", 401);
  if (jwksDomain !== env.ACCESS_TEAM_DOMAIN) {
    jwks = createRemoteJWKSet(new URL(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`));
    jwksDomain = env.ACCESS_TEAM_DOMAIN;
  }
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
      audience: env.ACCESS_AUD,
    });
    context.data.user = payload.email;
  } catch {
    return error("Unauthorized", 401);
  }
  return context.next();
}
