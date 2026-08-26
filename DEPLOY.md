# Deploying to Hostinger

This app is a standard Node.js Next.js app with a local SQLite database (via Prisma). It is
**not** deployable to plain shared/PHP hosting — it needs a plan that runs a persistent Node.js
process.

There are two different Hostinger products this can run on. **Check which one you actually
have before following either section** — they work completely differently.

## Option A: Hostinger "Web Apps" (GitHub auto-deploy) — what this project actually uses

This is a Vercel/Render-style PaaS: hPanel → **Websites → Web Apps**, connected directly to
the `mShareeda/Research-Analysis` GitHub repo. There is **no shell access to the running app**
— the SSH account hPanel gives you (Advanced → SSH Access) is for the general hosting account's
filesystem, not the app's actual build/run container, so `node`/`npm`/`npx` won't be found
there and that's expected, not a misconfiguration.

Instead, everything is driven by:

- **Git pushes to `main`** — every push triggers an automatic build + deploy (see
  **Deployments** in the sidebar for build logs and history).
- **`package.json`'s `build` script** — this is exactly what Hostinger runs (install command:
  `npm install`, build command: whatever `scripts.build` is, currently
  `prisma generate && prisma migrate deploy && next build`). Since there's no way to run a
  one-off command against the live app, **any setup step that needs to happen on deploy must
  live in this build script** — that's why `prisma migrate deploy` is baked in here instead of
  being a separate manual step. It's idempotent (a no-op if nothing's pending), so it's safe to
  leave in permanently.
- **Environment variables panel** (sidebar → **Environment variables**) — set `DATABASE_URL`,
  `AI_PROVIDER`, `OPENROUTER_API_KEY`, etc. here (or via its "Import .env" button). These are
  injected as real process env vars for both the build and the running app — no `.env`/
  `.env.local` files needed or used on this hosting type.

**To deploy a change**: just `git push origin main` (as covered elsewhere in this session) —
that's it. Watch **Deployments** in hPanel for the build log if something goes wrong.

**If a future schema change needs a new migration**: run `npx prisma migrate dev --name X`
locally (as usual), commit the new file under `prisma/migrations/`, and push — the build
script's `prisma migrate deploy` picks it up automatically on that deploy.

**Database persistence**: SQLite lives at `DATABASE_URL` (`file:./dev.db`, resolved relative to
`prisma/schema.prisma` → `prisma/dev.db`) on whatever persistent storage this Web App's
container mounts. Back this file up periodically (via hPanel's File Manager or a scheduled
export of the coding data — see `GET /api/coding/export` for a CSV of the research dataset)
since there's no separate managed database service here to fall back on.

## Option B: a plain Hostinger VPS (manual setup)

If you're instead on a VPS with real root SSH access (not the Web Apps product above), you own
the whole box and set up Node yourself:

### 1. One-time server setup

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

### 2. Get the code onto the server

```bash
git clone https://github.com/mShareeda/Research-Analysis.git research-analysis
cd research-analysis
npm ci
```

### 3. Configure environment

```bash
# .env — Prisma CLI specifically only auto-loads this file, not .env.local
DATABASE_URL="file:./prisma/dev.db"
```

```bash
# .env.local — everything else, read by the Next.js app itself
AI_PROVIDER="openrouter"
OPENROUTER_API_KEY="sk-or-v1-..."      # rotate the key if it was ever pasted in chat
OPENROUTER_MODEL="openrouter/auto"
OPENROUTER_SITE_URL="https://your-subdomain.example.com"
OPENROUTER_APP_NAME="Research Analysis"
UPLOAD_DIR="./uploads"
MAX_SOURCE_CHARS="60000"
```

### 4. Build

`npm run build` now already runs `prisma generate && prisma migrate deploy` first (see
Option A above) — no separate migration step needed:

```bash
npm run build   # output: "standalone" in next.config.ts keeps this lean
```

### 5. Run it

```bash
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cd .next/standalone
pm2 start server.js --name research-analysis
pm2 save
pm2 startup
```

Listens on port 3000 by default (`PORT=xxxx` to override).

**Persisting the database and uploads across rebuilds**: keep `prisma/dev.db` and `uploads/` in
the original `research-analysis/` checkout (not inside `.next/standalone`), and symlink them in
or point `DATABASE_URL`/`UPLOAD_DIR` at absolute paths outside the build output.

### 6. Point the subdomain at it

In hPanel: **DNS Zone Editor** → add an `A` record for the subdomain pointing at the VPS's IP.
On the VPS, put Nginx in front as a reverse proxy + TLS terminator:

```nginx
server {
    listen 80;
    server_name research.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/research-analysis /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d research.yourdomain.com
```

### 7. Redeploying after changes

```bash
git pull
npm ci
npm run build     # migrations run automatically, see step 4
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
pm2 restart research-analysis
```

## Notes

- This is a **single-user, local-first** app (SQLite, no auth). On Option B, put it behind
  Nginx's own HTTP Basic Auth (`auth_basic`) if it shouldn't be publicly reachable — there's no
  login screen in the app itself. Option A (Web Apps) has no equivalent built-in gate; rely on
  the subdomain being unlisted/unguessable, or ask Hostinger support about access restrictions
  for that product.
- The `OPENROUTER_API_KEY` was pasted in a chat during setup — treat it as semi-exposed and
  rotate it at https://openrouter.ai/keys if you haven't already.
