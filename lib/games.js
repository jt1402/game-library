export const STATUSES = ["Completed", "Playing", "Paused", "Dropped", "Wishlist", "Legacy"];

export function rowToGame(r) {
  return { ...r, genres: JSON.parse(r.genres || "[]") };
}

export function slugify(s) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const str = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Validate an incoming game payload. Returns { game } or { error }. */
export function cleanGame(input) {
  if (!input || typeof input !== "object") return { error: "Invalid body" };
  const name = str(input.name, 200);
  if (!name) return { error: "Name is required" };
  const status = STATUSES.includes(input.status) ? input.status : null;
  if (!status) return { error: `Status must be one of: ${STATUSES.join(", ")}` };
  const rating = input.rating == null || input.rating === "" ? null : Number(input.rating);
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 10))
    return { error: "Rating must be a whole number from 1 to 10" };
  const released = str(input.released, 10);
  if (released && !/^\d{4}-\d{2}-\d{2}$/.test(released)) return { error: "Release date must be YYYY-MM-DD" };
  const genres = Array.isArray(input.genres)
    ? [...new Set(input.genres.map((g) => str(g, 40)).filter(Boolean))].slice(0, 20)
    : [];
  return {
    game: {
      name, status, rating, released, genres,
      developer: str(input.developer, 200),
      notes: typeof input.notes === "string" ? input.notes.slice(0, 5000) : "",
    },
  };
}

export const today = () => new Date().toISOString().slice(0, 10);
export const error = (message, status = 400) => Response.json({ error: message }, { status });
