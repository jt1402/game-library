import { cleanGame, error, rowToGame } from "../../../../lib/games.js";

export async function onRequestPut({ request, env, params }) {
  const { game, error: msg } = cleanGame(await request.json().catch(() => null));
  if (msg) return error(msg);
  const row = await env.DB.prepare(
    `UPDATE games SET name = ?, status = ?, rating = ?, developer = ?, released = ?, genres = ?, notes = ?, updated = ?
     WHERE id = ? RETURNING *`
  ).bind(game.name, game.status, game.rating, game.developer, game.released,
         JSON.stringify(game.genres), game.notes, new Date().toISOString(), params.id).first();
  return row ? Response.json(rowToGame(row)) : error("Not found", 404);
}

export async function onRequestDelete({ env, params }) {
  const row = await env.DB.prepare("DELETE FROM games WHERE id = ? RETURNING cover").bind(params.id).first();
  if (!row) return error("Not found", 404);
  if (row.cover) await env.COVERS.delete(row.cover);
  return new Response(null, { status: 204 });
}
