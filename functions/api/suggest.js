import { error, str } from "../../lib/games.js";

const PER_HOUR = 5;      // per visitor
const MAX_OPEN = 500;    // total waiting in the inbox

async function hash(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Public: anyone can suggest a game. Only the owner can read them (/api/admin/suggestions).
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Invalid body");
  if (body.website) return new Response(null, { status: 204 }); // honeypot: bots fill every field
  const game = str(body.game, 120);
  if (!game) return error("Which game should I play?");
  const from = str(body.from, 60);
  const message = str(body.message, 1000) || "";

  const ipHash = await hash(`${request.headers.get("cf-connecting-ip") || ""}|${env.SESSION_SECRET || ""}`);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM suggestions WHERE ip_hash = ? AND created > ?")
    .bind(ipHash, since).first();
  if (recent.n >= PER_HOUR) return error("That's a lot of suggestions! Try again in an hour.", 429);
  const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM suggestions").first();
  if (open.n >= MAX_OPEN) return error("The suggestion box is full right now. Try again later.", 503);

  await env.DB.prepare("INSERT INTO suggestions (game, from_name, message, created, ip_hash) VALUES (?, ?, ?, ?, ?)")
    .bind(game, from, message, new Date().toISOString(), ipHash).run();
  return new Response(null, { status: 201 });
}
