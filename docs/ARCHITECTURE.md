# SportsIQ Architecture

## Overview
```
React SPA (apps/web)  ──/api──▶  Express API (apps/api)  ──Prisma──▶  PostgreSQL
```
- **Multi-tenant by league.** Every league-scoped record carries `leagueId`. `lib/access.ts` works out each user's access level for a league: `admin` (owner or Super Admin), `staff` (management member) or `team` (team owner). Every league route checks it with `assertLeague(user, leagueId, minLevel)`.
- **Roles** are stored on `User.role`. `SUPER_ADMIN` passes every role and league check, so it can see all data.
- **The playbook and vendor categories live in code** (`src/data/*`) so every league follows the same versioned process. Each league's progress is stored in `LeagueStepProgress`. Vendor categories are seeded into the database so vendors can link services to them.
- **Notifications** are written in-app by `lib/notify.ts`. Email, SMS and WhatsApp can be added later at the same point.
- **Every critical action is written to the audit log** (`AuditLog`).
- **Files** (logos, attachments) are stored as data URLs for the MVP. Next step: S3-compatible object storage with signed URLs.

## Data model (main entities)
User · Subscription · League · LeagueMember · LeagueStepProgress · Team · TeamOwner · PlayerProfile · PlayerRegistration · VendorCategory · VendorProfile · VendorService · SponsorProfile · SponsorshipOpportunity · BudgetLine · Expense · Income · Deck · Contract · Conversation · ConversationParticipant · Message · Notification · AuditLog

## Scaling path
1. Object storage for files, plus a CDN.
2. Background jobs (BullMQ and Redis) for notifications, reminders and expiry alerts.
3. WebSockets (Socket.IO with a Redis adapter) for the live auction and ball-by-ball scoring.
4. Payments (Razorpay) and GST invoicing.
5. Split services as load grows: scoring and auction first.
6. Multi-sport: `League.sport` already exists. Sport-specific playbooks and scoring would be keyed by sport.
