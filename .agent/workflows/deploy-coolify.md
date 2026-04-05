---
description: How to deploy the KNGO SEO Platform on Coolify using Docker Compose
---

# Deploy KNGO SEO Platform on Coolify

This guide deploys the platform on your Vultr VPS using Coolify's Docker Compose support.

## Prerequisites

- Coolify installed and running on your Vultr VPS
- A domain pointing to your VPS (e.g., `seo.kangomedia.com`)
- Access to the Coolify web dashboard (usually `http://your-server-ip:8000`)
- The GitHub repo: `kangomedia/kngo-seo-platform` (private)

---

## Step 1: Connect GitHub to Coolify

1. Open Coolify Dashboard → **Sources** (left sidebar)
2. Click **+ Add** → **GitHub App**
3. Follow the OAuth flow to authorize Coolify
4. Once connected, you'll see your GitHub account listed

> If you've already connected GitHub, skip this step.

---

## Step 2: Create the Application

1. Go to **Projects** → Select your project (or create one)
2. Click **+ New Resource**
3. Choose **Docker Compose**
4. Select **GitHub** as the source
5. Pick the repository: `kangomedia/kngo-seo-platform`
6. Branch: `main`
7. Click **Continue**

Coolify will detect the `docker-compose.yml` automatically.

---

## Step 3: Configure Environment Variables

In Coolify's **Environment Variables** tab for the application, add:

```env
# Database (internal — Coolify handles networking)
POSTGRES_PASSWORD=<generate a strong password>
DATABASE_URL=postgresql://kngo:<same-password>@postgres:5432/kngo_seo

# NextAuth
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=https://seo.kangomedia.com

# DataForSEO (optional — add when ready)
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=

# Anthropic Claude AI (optional — add when ready)
ANTHROPIC_API_KEY=

# GoHighLevel (optional — add when ready)
GHL_API_KEY=
GHL_LOCATION_ID=
```

### Generate the secrets:

```bash
# On your Mac or any terminal:
openssl rand -base64 32    # → use for NEXTAUTH_SECRET
openssl rand -base64 24    # → use for POSTGRES_PASSWORD
```

---

## Step 4: Configure Domain & SSL

1. In Coolify, go to the **app** service settings
2. Under **Domains**, add: `seo.kangomedia.com` (or your chosen domain)
3. Set the **exposed port** to `3000`
4. Enable **HTTPS** — Coolify auto-provisions Let's Encrypt SSL
5. Make sure the Postgres service does NOT have a public domain (internal only)

---

## Step 5: Deploy

1. Click **Deploy** in Coolify
2. Coolify will:
   - Pull the repo from GitHub
   - Build the Docker image (multi-stage, ~3-5 min first time)
   - Start PostgreSQL and wait for health check
   - Start the Next.js app
3. Watch the build logs for any errors

---

## Step 6: Run Database Migration & Seed

After the first successful deploy, you need to set up the database schema and seed data.

### Option A: Via Coolify Terminal

1. In Coolify, click on the **app** service
2. Open the **Terminal** tab
3. Run:

```bash
npx prisma migrate deploy
npx prisma db seed
```

### Option B: Via SSH

```bash
# SSH into your VPS
ssh root@your-server-ip

# Find the running container
docker ps | grep kngo

# Execute inside the container
docker exec -it <container-id> sh

# Run migrations
npx prisma migrate deploy
npx prisma db seed
```

After seeding, you'll see output like:

```
🌱 Seeding database...
  ✅ Admin user: freddy@kangomedia.com
  ✅ Clients: Mission AC & Heating, Strong Contractors, Eclypse Auto, LX Construction

  📎 Client Portal Links:
     Mission AC & Heating: /client/a1b2c3d4-e5f6-...
     Strong Contractors: /client/g7h8i9j0-k1l2-...
     ...

🎉 Seeding complete!
```

**Save those client portal links** — you'll text/email them to your clients.

---

## Step 7: Verify

1. Visit `https://seo.kangomedia.com` → Landing page
2. Visit `https://seo.kangomedia.com/login` → Agency login
3. Login: `freddy@kangomedia.com` / `admin123` (change this after first login!)
4. Visit a client portal link → Dashboard loads without login ✅

---

## Ongoing: Auto-Deploy on Push

Coolify auto-deploys when you push to `main` on GitHub. The workflow:

```
You push code → GitHub webhook → Coolify rebuilds → Zero-downtime deploy
```

To enable:
1. In Coolify, go to the app settings
2. Enable **Auto Deploy** (Webhook)
3. Coolify will create a webhook in your GitHub repo automatically

---

## Troubleshooting

### Build fails
- Check Coolify build logs for errors
- Most common: missing environment variables

### Database connection refused
- Make sure Postgres health check passes before app starts
- Verify `DATABASE_URL` matches the docker-compose postgres credentials

### "Link Not Found" on client portal
- The client access token UUID must match a real client in the database
- Run `npx prisma db seed` if you haven't yet

### Reset everything
```bash
# SSH into VPS
docker compose down -v  # WARNING: deletes all data
docker compose up -d    # Rebuild from scratch
# Then re-run migrations and seed
```
