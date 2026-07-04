# Project: Nairobi Waste Collection Coordination System

**Single source of truth — keep this file current across all build steps.**

---

## System Overview

A web-based platform that coordinates **public and private solid waste collection** in Nairobi.
Three distinct user roles share one interface:

| Role | Primary concerns |
|---|---|
| **County Officials** | Zone management, schedule oversight, complaint resolution, reporting |
| **Private Collectors** | Viewing assigned zones & schedules, logging pickups, updating status, viewing residents in their zones |
| **Residents** | Checking collection schedules, filing complaints, tracking pickup status |

---

## Locked Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **View** | React.js (Vite) + React Router | Component-based SPA |
| **Controller** | Node.js + Express.js | REST API, ES modules |
| **Model** | PostgreSQL + `pg` driver | Parameterized queries only — no ORM |
| **Auth** | JWT + bcrypt + RBAC + email-OTP 2FA | 2FA added as an add-on |
| **Email** | Nodemailer (SMTP) | Optional SMTP; console fallback in dev |

**This stack is locked. Do not introduce ORMs, GraphQL, or alternative runtimes.**
(Nodemailer added for transactional email — a library, not a new runtime.)

---

## Seven Core Entities

```
User          — id, name, email, password_hash, role (official|collector|resident), zone_id (FK), collector_id (FK, resident's chosen collector), contact_phone, created_at
ZoneCollector — zone_id (FK), collector_id (FK) — join table of collectors APPROVED for a zone (PK: zone_id+collector_id)
Collector     — id, user_id (FK), company_name, license_no, license_expiry, contact_phone, active
Zone          — id, name, description, boundary_geojson, assigned_collector_id (FK)
Schedule      — id, zone_id (FK), collector_id (FK), day_of_week, start_time, frequency
Pickup        — id, schedule_id (FK), zone_id (FK), collector_id (FK), status, completed_at, notes
Complaint     — id, resident_id (FK), zone_id (FK), category, description, status, created_at
Report        — id, generated_by (FK), period_start, period_end, summary_json, created_at
```

---

## Architecture — MVC Mapping

```
frontend/src/pages/         →  View layer (React components / pages)
frontend/src/api/           →  View-to-Controller bridge (axios client)
backend/src/routes/         →  Route definitions (URL → controller)
backend/src/controllers/    →  Controller layer (request handling, response shaping)
backend/src/models/         →  Model layer (SQL queries, data access)
backend/src/config/db.js    →  Database connection pool
```

---

## Build Order

| Step | Scope | Status |
|---|---|---|
| **1 — Foundation** | Monorepo scaffold, pg pool, health endpoint, StatusPage, design tokens | ✅ Complete |
| **2 — Schema & Models** | All 7 tables (migrations), model files with parameterized queries | ✅ Complete |
| **3 — Auth** | Registration, login, JWT middleware, RBAC guards | ✅ Complete |
| **4 — Collectors & Zones** | CRUD for collectors and zones (Official role) | ✅ Complete |
| **5 — Scheduling & Tracking** | Schedule creation, pickup logging, status updates | ✅ Complete |
| **6 — Complaints** | Resident complaint submission, official resolution workflow | ✅ Complete |
| **7 — Reporting** | Aggregated reports, PDF/CSV export | ✅ Complete |
| **8 — Hardening** | Input validation, rate limiting, security headers, error handling audit | ✅ Complete |
| **Add-on — Profile & Self-Service Edit** | Profile avatar/dropdown in shared header; PATCH /api/users/me (name/email); PATCH /api/users/me/password (bcrypt verify → update); collector contact_phone self-edit; GET /api/collectors/me; live avatar/greeting update via AuthContext.updateUser | ✅ Complete |
| **Add-on — Collector "My Residents" view** | Read-only view letting a collector see residents in their assigned zones, derived through `zones.assigned_collector_id` (no direct collector↔resident link). `GET /api/collectors/me/residents` (collector-only, ownership resolved from JWT — never a request param); returns name + zone only (no email/role/PII); `MyResidentsPage` grouped by zone with loading/empty/error states | ✅ Complete |
| **Add-on — Resident zone & contact at registration** | Residents choose their collection zone and enter a contact phone during registration; the dashboard shows the zone **read-only** (editable only from the Profile modal). New nullable `users.contact_phone` column (migration 011); public `GET /api/zones/public` (unauthenticated, id + name only) feeds the registration dropdown; `POST /api/auth/register` accepts+validates `zone_id`/`contact_phone` (role still hardcoded `'resident'`); `PATCH /api/users/me` persists resident zone_id + contact_phone on the users row; `PATCH /api/users/me/zone` left intact | ✅ Complete |
| **Add-on — Licence expiry tracking & renewal reminders** | Delivers the proposal's FR-03 licence-renewal promise via **in-app surfacing** (no email/SMS). One source of truth in `utils/dates.js`: `licenceStatus(license_expiry)` → `{ status, days_to_expiry }` (`none`/`valid`/`expiring_soon`/`expired`, threshold `LICENCE_EXPIRY_WARN_DAYS = 30`, date-only UTC), unit-tested. Official-facing + own-facing collector responses (`list`/`getOne`/`getMyProfile`) are enriched additively with `license_status` + `days_to_expiry`; public projections still omit all licence data. Officials get a status **badge** column on the Collectors register (sorted expired→expiring→valid→not-set) and a dashboard alert ("N expired · M expiring soon" → /collectors, active-only); collectors see a renewal **banner** on their dashboard + expiry/status in their profile. No email/SMS (noted as future work) | ✅ Complete |
| **Add-on — Multiple approved collectors per zone + resident choice** | A zone can have several **approved** collectors (`zone_collectors` join table, migration 013) and each resident picks one (`users.collector_id`). `zones.assigned_collector_id` stays as the zone **default/fallback**; the default is always also an approved pair. **THE INVARIANT** (enforced server-side on every mutation): a resident's `collector_id`, when set, must be approved for their zone AND active — validated via `zoneCollector.model.isApprovedActive` at registration and in profile; ownership always resolved from the JWT. Zone change clears `collector_id` (fresh choice, same tx); removing a collector from a zone nulls affected residents' choice in one transaction and refuses to remove the zone default. Official-only approvals (`GET/POST /api/zones/:id/collectors`, `DELETE …/:collectorId`); unauthenticated `GET /api/zones/:id/collectors/public` returns **id + company_name only** (no PII) for the registration/profile picker. Complaint routing is server-side only: resident's choice (own zone, still approved+active) → zone default → null. "My Residents" now scoped to `users.collector_id` (a collector sees only their own customers). UI: official Zones "Manage approved" modal (add/remove/set-default), optional collector picker on registration + profile (resets on zone change), resident dashboard shows chosen collector + that collector's schedule. Negative-case integration tests cover every attack path | ✅ Complete |
| **Add-on — Email notifications & 2FA** | **(a) Email-OTP two-factor auth:** login is now two-step — `POST /api/auth/login` verifies the password then emails a 6-digit code (no token yet); `POST /api/auth/verify-otp` checks it (sha256-hashed, single-use, 10-min expiry, 5-attempt cap, timing-safe compare) and issues the JWT; `POST /api/auth/resend-otp`. Codes stored hashed in `login_codes` (migration 012). Gated by `MFA_ENABLED` (default true; off in test env). Two-step LoginPage UI with resend / use-different-account. **(b) Scoped email notifications** (only people an event concerns): complaint filed → resident (confirmation) + assigned collector + officials; complaint status change → the resident; schedule assigned → the collector; resident registration → welcome. Nodemailer SMTP with a console-logging dev fallback (`SMTP_HOST` optional); all sends fire-and-forget so mail never breaks the request. `services/notifications.js` + `utils/mailer.js`; `UserModel.findByRole` for official fan-out | ✅ Complete |
| **Code Review — Security & Quality** | External code review fixes + improvements (see below) | ✅ Complete |

### Code Review Fixes Applied

| # | Issue | Fix |
|---|---|---|
| **#1** | Privilege escalation — `role` self-selectable on public register | `role` hardcoded to `'resident'` in controller; role selector removed from frontend; `POST /api/users/officials` added (official-only) |
| **#2** | CORS fail-open when `CORS_ORIGIN` env var is missing | Added `CORS_ORIGIN` to `validateEnv` REQUIRED list |
| **#3** | No global rate limiting | Global limiter (300 req/15 min) added in `app.js`; `trust proxy` set |
| **#4** | `biweekly` schedule behaved like `weekly` | Week-parity check added: `weeksBetween(anchor, date) % 2 === 0` |
| **#5** | `/generate` accepted arbitrary date ranges | `generateRules` added — ISO dates required, `to ≥ from`, max 90 days |
| **#6** | Collector `license_no`/`contact_phone` visible to all roles | Role-gated projection: officials get full row, others get public view |
| **#7** | Schedule PUT required all fields, COALESCE dead code | Split `scheduleRules` (POST, strict) / `scheduleUpdateRules` (PUT, optional) |
| **#8** | Ownership checks duplicated per-controller | Centralized in `middleware/ownership.js`; `error.middleware` maps to 403 |
| **#9** | No automated tests | Vitest + supertest suite: unit tests for `utils/dates.js`; integration tests for all review boundaries |
| **#12** | Duplicate week-range logic (UTC vs local) | Extracted to `src/utils/dates.js`; seed now uses UTC consistently |
| Nitpick | JWT catch swallowed error type | `catch (err)` + `console.warn` added; generic 401 still returned to client |

**Known tradeoffs (not bugs):**
- JWT stored in `localStorage` (not httpOnly cookies) — deliberate simplicity tradeoff; adds CSRF complexity without meaningful security gain at this scale.
- Migrations are forward-only — no `down.sql` convention; rollbacks are manual (write the reverse SQL by hand).
- 2FA depends on email delivery: if SMTP is unconfigured/unreachable, users can't receive codes. Mitigated by the console dev-fallback and the `MFA_ENABLED` toggle. Set real SMTP creds in `.env` for production.
- Registration auto-logs-in the new resident **without** an OTP round-trip (account is created in person); every subsequent login for an existing account still requires the second factor.
- Email OTP is emailed in plaintext (stored hashed at rest); acceptable for this scale, weaker than a TOTP authenticator app.

---

## Development Conventions

- **ES modules** throughout the backend (`"type": "module"` in package.json).
- `pg` imported as default: `import pg from 'pg'; const { Pool } = pg;`
- `dotenv/config` imported at the very top of `server.js` before any other import.
- All SQL uses **parameterized queries** — never string-interpolate user input into SQL.
- Route files only wire URLs to controllers. Business logic lives in controllers; data access lives in models.
- JWT secret and all credentials live in `.env` — never committed.
