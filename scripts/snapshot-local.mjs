// Snapshot the local dev DB + covers into data/ so they can be imported remotely.
// Usage: node scripts/snapshot-local.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const wrangler = (...args) =>
  execFileSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const out = wrangler("d1", "execute", "game-library", "--local", "--json", "--command", "SELECT * FROM games ORDER BY name");
const rows = JSON.parse(out)[0].results;
const games = rows.map((r) => ({ ...r, genres: JSON.parse(r.genres || "[]") }));

let fetched = 0;
for (const g of games) {
  if (!g.cover || existsSync(`data/${g.cover}`)) continue;
  mkdirSync(dirname(`data/${g.cover}`), { recursive: true });
  wrangler("r2", "object", "get", `game-library-covers/${g.cover}`, "--file", `data/${g.cover}`, "--local");
  fetched++;
}

writeFileSync("data/games.json", JSON.stringify(games, null, 2));
console.log(`Saved ${games.length} games to data/games.json; fetched ${fetched} new covers.`);
