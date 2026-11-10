import { error } from "../../../lib/games.js";
import { rawg, resized } from "../../../lib/rawg.js";

// GET ?q=<text>  → up to 8 matches for the editor's name field
// GET ?id=<rawg id> → details used to fill in the form
export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const q = (params.get("q") || "").trim().slice(0, 100);
  try {
    if (id) {
      if (!/^\d+$/.test(id)) return error("Bad id");
      const g = await rawg(env, `/games/${id}`);
      return Response.json({
        name: g.name,
        released: /^\d{4}-\d{2}-\d{2}$/.test(g.released || "") ? g.released : null,
        developer: (g.developers || []).slice(0, 2).map((d) => d.name).join(", ") || null,
        genres: (g.genres || []).map((x) => x.name),
        cover: resized(g.background_image, 1280),
      });
    }
    if (q.length < 2) return Response.json([]);
    const { results = [] } = await rawg(env, "/games", { search: q, page_size: "8", search_precise: "true" });
    return Response.json(results.map((g) => ({
      id: g.id, name: g.name, year: (g.released || "").slice(0, 4), thumb: resized(g.background_image, 420),
    })));
  } catch (e) {
    return error(e.message, e.status || 502);
  }
}
