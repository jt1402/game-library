// RAWG (rawg.io) game database, used to auto-fill the editor. Needs the RAWG_API_KEY secret.
const BASE = "https://api.rawg.io/api";

export async function rawg(env, path, params = {}) {
  if (!env.RAWG_API_KEY) throw Object.assign(new Error("Game lookup isn't set up (missing RAWG_API_KEY)"), { status: 503 });
  const url = new URL(BASE + path);
  url.search = new URLSearchParams({ key: env.RAWG_API_KEY, ...params });
  const res = await fetch(url, { cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!res.ok) throw Object.assign(new Error(`Game lookup failed (RAWG ${res.status})`), { status: 502 });
  return res.json();
}

/** RAWG serves resized copies of its images under /media/resize/<width>/-/. */
export const resized = (src, width) =>
  src ? src.replace(/\/media\/(games|screenshots)\//, `/media/resize/${width}/-/$1/`) : null;
