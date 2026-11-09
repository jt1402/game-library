# Game Library

My personal log of every game I've played. Static frontend + Cloudflare Pages Functions,
with games in **D1** (SQLite) and cover images in **R2**. Adding/editing is owner-only,
behind a password login at `/admin`.

```
public/              site (index.html, app.js, styles.css)
functions/api/       GET /api/games (public)
functions/api/admin/ create / update / delete / cover upload (owner-only)
functions/api/login  sign in / sign out (lib/auth.js)
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
npm run dev               # http://localhost:8788  (owner mode via DEV_BYPASS_AUTH in .dev.vars)
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

Then set the owner password and session key (Pages secrets, encrypted):

```bash
npx wrangler pages secret put ADMIN_PASSWORD --project-name game-library
npx wrangler pages secret put SESSION_SECRET --project-name game-library   # any long random string
```

Secrets take effect on the next deploy. To add games, open `/admin`, sign in, and you'll be sent
back to the library with an **+ Add game** button. Changing `SESSION_SECRET` signs out every
session; changing `ADMIN_PASSWORD` changes the password.

Pushing to `main` deploys automatically (Cloudflare Pages Git integration).

## Backup

The **Export** button downloads every game as JSON. Covers live in R2.
