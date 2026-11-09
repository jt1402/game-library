import { rowToGame } from "../../lib/games.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT * FROM games ORDER BY added DESC, name").all();
  return Response.json(results.map(rowToGame), { headers: { "cache-control": "no-store" } });
}
