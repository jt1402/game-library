# Game Library

My personal log of every game I've played. Static frontend + Cloudflare Pages Functions,
with games in **D1** (SQLite) and cover images in **R2**. Adding/editing is protected by
**Cloudflare Access**.

```
public/              site (index.html, app.js, styles.css)
functions/api/       GET /api/games (public)
functions/api/admin/ create / update / delete / cover upload (Access-protected)
functions/covers/    serves cover images from R2
lib/games.js         validation + helpers
schema.sql           D1 table
scripts/import.mjs   one-time import of data/games.json + data/covers (Notion export)
```

## Local development

```bash
npm install
npm run db:init:local
npm run import:local      # loads the Notion export into the local DB/bucket
npm run dev               # http://localhost:8788  (admin enabled via .dev.vars)
```

## Deploy (first time)

```bash
npx wrangler login
npx wrangler d1 create game-library          # paste database_id into wrangler.toml
npx wrangler r2 bucket create game-library-covers
npm run db:init:remote
npm run import:remote
npx wrangler pages project create game-library --production-branch main
npm run deploy
```

Then protect admin with Cloudflare Access (Zero Trust dashboard → Access → Applications →
Add → Self-hosted):

- Domain: `game-library.pages.dev`, paths `admin` and `api/admin/*` (one app, two destinations)
- Policy: Allow → Emails → your email
- Copy the app's **Audience (AUD) tag** and your **team domain** (`<team>.cloudflareaccess.com`)
  into `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` in `wrangler.toml`, then `npm run deploy` again.

To add games: open `/admin`, sign in, and you'll be sent back to the library with an
**+ Add game** button. Covers can be dropped, pasted, picked, or given as a URL.

## Backup

The **Export** button downloads every game as JSON. Covers live in R2.
