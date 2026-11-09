import { cleanGame, error, rowToGame, slugify, today } from "../../../lib/games.js";

export async function onRequestPost({ request, env }) {
  const { game, error: msg } = cleanGame(await request.json().catch(() => null));
  if (msg) return error(msg);

  const base = slugify(game.name) || "game";
  let id = base;
  for (let n = 2; await env.DB.prepare("SELECT 1 FROM games WHERE id = ?").bind(id).first(); n++) id = `${base}-${n}`;

  const row = await env.DB.prepare(
    `INSERT INTO games (id, name, status, rating, developer, released, genres, added, notes, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  ).bind(id, game.name, game.status, game.rating, game.developer, game.released,
         JSON.stringify(game.genres), today(), game.notes, new Date().toISOString()).first();
  return Response.json(rowToGame(row), { status: 201 });
}
