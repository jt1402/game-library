# Game Library

My personal log of every game I've played. Static frontend + Cloudflare Pages Functions,
with games in **D1** (SQLite) and cover images in **R2**. Adding/editing is owner-only,
behind a password login at `/admin`.

```
public/              site (index.html, app.js, styles.css)
functions/api/       GET /api/games, POST /api/suggest (public)
functions/api/admin/ create / update / delete / cover upload / RAWG lookup / suggestion inbox (owner-only)
functions/game/      /game/<id> share links (page + Open Graph tags for link previews)
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
npx wrangler pages secret put ADMIN_PASSWORD --project-name jt-games
npx wrangler pages secret put SESSION_SECRET --project-name jt-games   # any long random string
```

Secrets take effect on the next deploy. To add games, open `/admin`, sign in, and you'll be sent
back to the library with an **+ Add game** button. Changing `SESSION_SECRET` signs out every
session; changing `ADMIN_PASSWORD` changes the password.

Pushing to `main` deploys automatically (Cloudflare Pages Git integration).

## Auto-fill (RAWG)

Typing a name in the editor searches [RAWG](https://rawg.io/apidocs) and fills in release date,
developer, genres and cover. Get a free API key there, then:

```bash
npx wrangler pages secret put RAWG_API_KEY --project-name jt-games
```

Locally, add `RAWG_API_KEY=...` to `.dev.vars`. Without a key the editor just works as before.

## Suggestions

Visitors can suggest games with **Suggest a game** (max 5 per hour per visitor). They land in the
owner-only inbox, where **Add to wishlist** opens the editor pre-filled. After pulling this change,
create the table once: `npm run db:init:remote` (safe to re-run).

## Backup

The **Export** button downloads every game as JSON. Covers live in R2.
