import { error, rowToGame } from "../../../../lib/games.js";

const TYPES = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/avif": "avif", "image/gif": "gif" };
const MAX_BYTES = 8 * 1024 * 1024;

// PUT an image body, or JSON { url } to have the server download it.
export async function onRequestPut({ request, env, params }) {
  const game = await env.DB.prepare("SELECT cover FROM games WHERE id = ?").bind(params.id).first();
  if (!game) return error("Not found", 404);

  let source = request;
  if ((request.headers.get("content-type") || "").includes("application/json")) {
    const { url } = await request.json().catch(() => ({}));
    if (!/^https?:\/\//i.test(url || "")) return error("A valid http(s) image URL is required");
    source = await fetch(url, { headers: { accept: "image/*" } }).catch(() => null);
    if (!source?.ok) return error("Could not download that image");
  }
  const type = (source.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = TYPES[type];
  if (!ext) return error("Unsupported image type (use webp, jpeg, png, avif or gif)");
  const bytes = await source.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return error("Image is larger than 8 MB");

  const key = `covers/${params.id}-${Date.now().toString(36)}.${ext}`;
  await env.COVERS.put(key, bytes, { httpMetadata: { contentType: type } });
  const row = await env.DB.prepare("UPDATE games SET cover = ?, updated = ? WHERE id = ? RETURNING *")
    .bind(key, new Date().toISOString(), params.id).first();
  if (game.cover) await env.COVERS.delete(game.cover);
  return Response.json(rowToGame(row));
}
