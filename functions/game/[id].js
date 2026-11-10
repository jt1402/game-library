import { rowToGame } from "../../lib/games.js";

const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// /game/<id>: the normal library page, with title and Open Graph tags for that game so shared
// links get a proper preview. The page script sees the URL and opens the game's detail view.
export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(new URL("/", url));
  const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" };
  const row = await env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(params.id).first();
  if (!row) return new Response(page.body, { status: 404, headers });

  const g = rowToGame(row);
  const title = `${g.name} · Game Library`;
  const facts = [g.rating ? `${g.rating}/10` : null, g.status, g.developer, (g.released || "").slice(0, 4)]
    .filter(Boolean).join(" · ");
  const notes = (g.notes || "").replace(/\s+/g, " ").trim();
  const desc = notes ? `${facts}. ${notes.length > 180 ? notes.slice(0, 177) + "…" : notes}` : facts;
  const set = (content) => ({ element: (el) => el.setAttribute("content", content) });

  return new HTMLRewriter()
    .on("title", { element: (el) => el.setInnerContent(title) })
    .on('meta[name="description"]', set(desc))
    .on('meta[property="og:title"]', set(g.name))
    .on('meta[property="og:description"]', set(desc))
    .on("head", {
      element(el) {
        const tags = [`<meta property="og:url" content="${attr(url.origin + url.pathname)}">`];
        if (g.cover) tags.push(
          `<meta property="og:image" content="${attr(`${url.origin}/${g.cover}`)}">`,
          `<meta name="twitter:card" content="summary_large_image">`);
        el.append(tags.join(""), { html: true });
      },
    })
    .transform(new Response(page.body, { headers }));
}
