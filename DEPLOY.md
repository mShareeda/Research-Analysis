# Deploying to Hostinger

This app is a standard Node.js Next.js app backed by Prisma. Locally it uses SQLite; in
production (on the hosting product this project actually uses) it uses MySQL — see "Why MySQL
in production" below before assuming SQLite would just work. It is **not** deployable to plain
shared/PHP hosting — it needs a plan that runs a persistent Node.js process.

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
  `prisma generate && prisma migrate deploy && next build`, which uses the default schema path
  `prisma/schema.prisma` — the MySQL one). Since there's no way to run a one-off command
  against the live app, **any setup step that needs to happen on deploy must live in this build
  script** — that's why `prisma migrate deploy` is baked in here instead of being a separate
  manual step. It's idempotent (a no-op if nothing's pending), so it's safe to leave in
  permanently.
- **Environment variables panel** (sidebar → **Environment variables**) — set `DATABASE_URL`,
  `AI_PROVIDER`, `OPENROUTER_API_KEY`, etc. here (or via its "Import .env" button). These are
  injected as real process env vars for both the build and the running app — no `.env`/
  `.env.local` files needed or used on this hosting type.

**To deploy a change**: just `git push origin main` — that's it. Watch **Deployments** in
hPanel for the build log if something goes wrong.

### Password-locking the app

`src/middleware.ts` gates every route behind HTTP Basic Auth, checked against
the `SITE_PASSWORD` environment variable — set it in hPanel's **Environment
variables** panel (same place as `DATABASE_URL`), never in a committed file.
The username is ignored; only the password after the colon is checked, so
visitors can type anything in the username field. Leaving `SITE_PASSWORD`
unset (the default) disables the gate entirely — nothing to compare against,
so a fresh clone or a forgotten env var never accidentally locks everyone
out. Changing the password later is just updating that one env var and
redeploying (or on this hosting type, the env var panel may apply without a
redeploy — check hPanel).

**If a future schema change needs a new migration**: since there's no reachable local MySQL to
run `prisma migrate dev` against, generate the migration SQL offline instead:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /dev/null   # sanity-check it still runs
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_your_change_name
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script --shadow-database-url "$DATABASE_URL" > prisma/migrations/<the_folder_above>/migration.sql
```

(The `--from-migrations`/`--shadow-database-url` variant needs a reachable MySQL — easiest to
run this from within the SSH account after temporarily allowlisting your IP under **Remote
MySQL**, or just hand-write the `ALTER TABLE` SQL for a small change.) Commit the new migration
folder and push — the build script's `prisma migrate deploy` applies it on that deploy.

## Why MySQL in production

This Web App gives **every deployment its own fresh, isolated build directory**
(`~/domains/<site>/hbuilds/versions/<uuid>/`) — confirmed by inspecting the account's file
listing (only `hbuilds`, `public_html`, and a file literally named `DO_NOT_UPLOAD_HERE` exist
at the account root; nothing meant as persistent app storage). A SQLite database is just a
local file — even though `prisma migrate deploy` successfully creates and migrates it during
the build, that file does not survive into whatever actually serves live traffic afterward: the
runtime logs showed the exact same "table does not exist" error immediately after a build that
had just proven the table existed. There is no persistent volume to point SQLite at on this
product. MySQL (Hostinger's own hosted MySQL, created via hPanel → **Databases → Management**)
is the fix — a real external database the app connects to over the network, unaffected by the
build directory being thrown away and recreated on every deploy.

**Connection string**: `mysql://<user>:<password>@localhost:3306/<database>` — try `localhost`
first (the Web App and MySQL server are on the same underlying host). If that gets a connection
error in the runtime logs, switch the host to the value shown on hPanel → **Databases → Remote
MySQL** (e.g. `srv2196.hstgr.io`) and add the Web App's outbound IP — or `%` for any host, since
the exact egress IP isn't predictable on this platform — to that page's allowlist.

## Option B: a plain Hostinger VPS (manual setup)

If you're instead on a VPS with real root SSH access (not the Web Apps product above), you own
the whole box and set up Node yourself. Unlike Option A, a VPS has genuine persistent disk, so
SQLite works fine here — use `prisma/local/schema.prisma` (pass `--schema=prisma/local/schema.prisma`
to every `prisma` command, and replace `npm run build` with
`npx prisma generate --schema=prisma/local/schema.prisma && npx prisma migrate deploy --schema=prisma/local/schema.prisma && next build`)
if you'd rather not run a MySQL server. Steps below assume you're keeping the same MySQL setup
as Option A for consistency, which needs no such overrides.

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
DATABASE_URL="mysql://user:password@host:3306/database"
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

**Persisting uploads across rebuilds**: keep `uploads/` in the original `research-analysis/`
checkout (not inside `.next/standalone`), and symlink it in or point `UPLOAD_DIR` at an
absolute path outside the build output. (The database itself is external — MySQL — so it isn't
affected by rebuilds the way a SQLite file would be.)

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
