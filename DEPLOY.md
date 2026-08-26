# Deploying to Hostinger (VPS / Node.js hosting)

This app is a standard Node.js Next.js app with a local SQLite database (via Prisma). It is
**not** deployable to plain shared/PHP hosting — it needs a plan that runs a persistent Node.js
process (a Hostinger VPS, or Hostinger's Node.js App Manager on Cloud/Business hosting).

The simplest and most reliable approach is to **clone and build the app directly on the
server**, rather than copying a build from Windows — this avoids native binary mismatches
(Prisma's query engine, in particular, is platform-specific).

## 1. One-time server setup

SSH into the VPS, then:

```bash
# Node.js 20+ (via NodeSource, or Hostinger's own Node.js app manager if using that instead)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Process manager
sudo npm install -g pm2
```

## 2. Get the code onto the server

Push this project to a private Git repo (GitHub/GitLab) and clone it on the VPS — do **not**
commit `.env.local`, `dev.db`, or `uploads/` (already git-ignored).

```bash
git clone <your-repo-url> research-analysis
cd research-analysis
npm ci
```

## 3. Configure environment

Create `.env` and `.env.local` on the server (never commit these):

```bash
# .env
DATABASE_URL="file:./prisma/dev.db"
```

```bash
# .env.local
AI_PROVIDER="openrouter"
OPENROUTER_API_KEY="sk-or-v1-..."      # rotate the key if it was ever pasted in chat
OPENROUTER_MODEL="openrouter/auto"
OPENROUTER_SITE_URL="https://your-subdomain.example.com"
OPENROUTER_APP_NAME="Research Analysis"
UPLOAD_DIR="./uploads"
MAX_SOURCE_CHARS="60000"
```

## 4. Database + build

```bash
npx prisma migrate deploy   # applies existing migrations, creates prisma/dev.db
npx prisma generate         # builds the Linux-native Prisma client on this machine
npm run build               # output: "standalone" in next.config.ts keeps this lean
```

## 5. Run it

The standalone build needs `public/` and `.next/static/` copied alongside its server bundle
(a one-time step after each build):

```bash
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
```

Then run it with PM2 so it survives reboots/crashes:

```bash
cd .next/standalone
pm2 start server.js --name research-analysis
pm2 save
pm2 startup   # follow the printed instructions to enable on boot
```

By default this listens on port 3000 (override with `PORT=xxxx` before `pm2 start`).

**Persisting the database and uploads across rebuilds**: the standalone bundle above is a
throwaway copy — keep `prisma/dev.db` and `uploads/` in the original `research-analysis/`
checkout (not inside `.next/standalone`), and either symlink them in or point `DATABASE_URL`
/`UPLOAD_DIR` at absolute paths outside the build output, so a future `npm run build` doesn't
wipe your data.

## 6. Point the subdomain at it

In Hostinger's hPanel:
1. **DNS Zone Editor** → add an `A` record for the subdomain (e.g. `research`) pointing at the
   VPS's IP address.
2. On the VPS, put Nginx in front of the Node process as a reverse proxy + TLS terminator:

```nginx
# /etc/nginx/sites-available/research-analysis
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
sudo certbot --nginx -d research.yourdomain.com   # free HTTPS
```

If your Hostinger plan instead offers a **Node.js App Manager** (common on Cloud/Business
plans, cPanel-based), you can skip the manual Nginx/PM2 setup and use that panel directly:
point it at this repo, set the same environment variables there, set the startup file to
`.next/standalone/server.js` (after running `npm run build`), and let the panel handle the
subdomain/SSL/process management for you.

## 7. Redeploying after changes

```bash
git pull
npm ci
npx prisma migrate deploy   # only if the schema changed
npm run build
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
pm2 restart research-analysis
```

## Notes

- This is a **single-user, local-first** app (SQLite, no auth) — put it behind Nginx's own
  HTTP Basic Auth (`auth_basic` directive) if the subdomain shouldn't be publicly reachable,
  since there is no login screen in the app itself.
- The `OPENROUTER_API_KEY` shown above was pasted in a chat during setup — treat it as
  semi-exposed and rotate it at https://openrouter.ai/keys before or shortly after going live.
