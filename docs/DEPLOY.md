# Deploying SportsIQ on Render

The repository contains a **Render Blueprint** (`render.yaml`) and a `Dockerfile`. One web service serves the API and the
web app on the same address; a managed PostgreSQL database holds the data.

## First deploy (about 10 minutes)
1. Sign in at https://dashboard.render.com (sign in with GitHub).
2. **New → Blueprint**. Connect the `aftabraja/aftabraja` repository and choose the branch that holds this file.
3. Render shows the `sportsiq` web service and the `sportsiq-db` database. Fill in:
   - `SUPERADMIN_PASSWORD` — the Super Admin password (keep it private).
   - `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — leave empty for labelled test payments.
4. Click **Apply**. The first build takes 5–8 minutes. On first boot the service creates the tables, the Super Admin
   and — because `SEED_DEMO=true` — the full demo league (takes ~1 more minute after the site is up).
5. Open the service's URL (e.g. `https://sportsiq-xxxx.onrender.com`).

## Settings you may change later (service → Environment)
| Variable | Purpose |
|---|---|
| `SEED_DEMO` | `true` loads demo data on an empty database. Use `false` for a clean launch. |
| `APP_URL` | Your custom domain, e.g. `https://app.sportsiq.in` (used in email links). Defaults to the Render URL. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Real email delivery. Until set, emails appear in Super Admin → Email Outbox. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `PAYMENTS_TEST_MODE=false` | Live payments. |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_PUBLIC_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Permanent file storage (S3, Cloudflare R2, Spaces). |
| `PLATFORM_*` | Your GSTIN and legal entity for invoices. |

## Free plan limits (fine for a demo, not for launch)
- The free web service sleeps after 15 minutes without visitors; the next visit takes ~1 minute to wake.
- The free database expires after 30 days. Upgrade it (Basic plan) before real data goes in.
- Uploaded files are stored on the service's disk and are lost on each redeploy. Set the `S3_*` variables for permanent storage.

## Starting the demo again from scratch
Render dashboard → `sportsiq-db` → delete and recreate it (or create a new Blueprint). The next boot reloads the demo.
