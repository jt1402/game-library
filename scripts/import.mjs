// Load data/games.json + data/covers into D1 and R2.
// Usage: node scripts/import.mjs --local | --remote
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const target = process.argv.includes("--remote") ? "--remote" : "--local";
const games = JSON.parse(readFileSync("data/games.json", "utf8"));

const TYPES = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", avif: "image/avif", gif: "image/gif" };
const typeOf = (key) => TYPES[key.split(".").pop().toLowerCase()] || "application/octet-stream";

const q = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const sql = games
  .map((g) =>
    "INSERT OR REPLACE INTO games (id, name, status, rating, developer, released, genres, added, cover, notes, updated) VALUES (" +
    [g.id, g.name, g.status, g.rating, g.developer, g.released, JSON.stringify(g.genres), g.added, g.cover, g.notes || "", g.updated]
      .map(q).join(", ") + ");")
  .join("\n");
mkdirSync(".wrangler", { recursive: true });
writeFileSync(".wrangler/seed.sql", sql);

const WRANGLER = "node_modules/wrangler/bin/wrangler.js";
const once = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [WRANGLER, ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code ? reject(new Error(err)) : resolve()));
  });
const run = async (args, tries = 3) => {
  for (let i = 1; ; i++) {
    try { return await once(args); } catch (e) { if (i >= tries) throw e; }
  }
};

console.log(`Seeding ${games.length} games (${target})...`);
await run(["d1", "execute", "game-library", target, "--file", ".wrangler/seed.sql", "--yes"]);

const queue = games.filter((g) => g.cover);
const total = queue.length;
let done = 0;
await Promise.all(
  // Local storage can't handle concurrent writers; remote uploads can run in parallel.
  Array.from({ length: target === "--remote" ? 6 : 1 }, async () => {
    for (let g; (g = queue.shift()); ) {
      await run(["r2", "object", "put", `game-library-covers/${g.cover}`, "--file", `data/${g.cover}`,
                 "--content-type", typeOf(g.cover), target]);
      process.stdout.write(`\rCovers: ${++done}/${total}`);
    }
  })
);
console.log("\nDone.");
