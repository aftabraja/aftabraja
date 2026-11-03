<p align="center"><img src="docs/brand/sportsiq-logo.svg" alt="SPORTSIQ" height="56"></p>

# SPORTSIQ: The League Operating System

SportsIQ is a SaaS platform that runs a sports league end to end. League owners follow a 66-step guided playbook. Vendors, sponsors, team owners, players and the management team each get their own portal. Everything (vendors, sponsorships, finance and P&L, decks and contracts) lives in one place.

The full product spec, playbook and vendor categories are in [`docs/PRODUCT_BLUEPRINT.md`](docs/PRODUCT_BLUEPRINT.md). The architecture is described in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Tech stack
- **Web:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router (`apps/web`)
- **API:** Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT auth, Zod validation (`apps/api`)
- npm workspaces monorepo

## Run locally

Requirements: Node 20+ and PostgreSQL 14+. You can start PostgreSQL with `docker compose up -d db`.

```bash
npm install
```

```bash
cp apps/api/.env.example apps/api/.env
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

The web app runs at http://localhost:5173 and the API at http://localhost:4000. Vite proxies `/api`.

### Demo accounts (seeded)
| Role | Email | Password |
|---|---|---|
| Super Admin | admin@sportsiq.in | `SUPERADMIN_PASSWORD` from `.env` (default `ChangeMe@123`) |
| League Owner (CLT10) | owner@demo.sportsiq.in | Demo@1234 |
| League Management | ops@demo.sportsiq.in | Demo@1234 |
| Team Owner | teamowner@demo.sportsiq.in | Demo@1234 |
| Vendor | vendor1@demo.sportsiq.in … vendor14 | Demo@1234 |
| Sponsor | sponsor1@demo.sportsiq.in … sponsor4 | Demo@1234 |
| Player | player1@demo.sportsiq.in … player12 | Demo@1234 |
| Agency / Manager | agent1@demo.sportsiq.in, agent2@demo.sportsiq.in | Demo@1234 |

Set `SEED_DEMO=false` to seed only the Super Admin and the vendor categories (for production).

To fill the demo league with a full season (trials, auction, schedule, scored matches, hotels, travel, tickets, accreditation, finance, talent enquiries), start the API and then run:

```bash
node apps/api/scripts/demo-season.mjs
```

### Payments
Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `apps/api/.env` to take real payments. Without them, payments run in a clearly labelled **test mode** that charges nothing. Set `PAYMENTS_TEST_MODE=false` in production so test mode cannot be used.

## Repository layout
```
apps/
  api/
    prisma/            schema, migrations, seed
    src/data/          playbook, vendor categories, contract and deck templates
    src/routes/        auth, leagues, fixtures (scoring), auction, trials, logistics, ticketing, payments, accreditation,
                       finance, reports, talent, vendors, sponsors, players, messages, notifications, studio, public, admin
    src/reports/       31 report definitions + Excel / PDF / CSV exporters
    scripts/           demo-season.mjs (end-to-end demo + integration check)
    src/lib/           auth, access control, notifications, audit
  web/
    src/components/    AppShell, VendorPanel (3-pane search), AI Logo Studio, Slide, Logo, ui kit
    src/pages/         Landing, Auth, Leagues, league/*, Portals (vendor/sponsor/player), admin/*
docs/                  blueprint, architecture, brand assets
```

## Brand
The monogram is a hexagonal sports crest containing a bold **S** whose end becomes an amber "IQ" spark. Assets are in `docs/brand/` and the component is `apps/web/src/components/Logo.tsx`.

## Legal note
Contract templates in SportsIQ are generic reference material, not legal advice. The product requires users to acknowledge this and recommends a lawyer review before any export.
