import { error } from "../../../../lib/games.js";

export async function onRequestDelete({ env, params }) {
  const row = await env.DB.prepare("DELETE FROM suggestions WHERE id = ? RETURNING id").bind(Number(params.id)).first();
  return row ? new Response(null, { status: 204 }) : error("Not found", 404);
}
