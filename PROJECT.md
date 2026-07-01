# Project: Nairobi Waste Collection Coordination System

**Single source of truth — keep this file current across all build steps.**

---

## System Overview

A web-based platform that coordinates **public and private solid waste collection** in Nairobi.
Three distinct user roles share one interface:

| Role | Primary concerns |
|---|---|
| **County Officials** | Zone management, schedule oversight, complaint resolution, reporting |
| **Private Collectors** | Viewing assigned zones & schedules, logging pickups, updating status |
| **Residents** | Checking collection schedules, filing complaints, tracking pickup status |

---

## Locked Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **View** | React.js (Vite) + React Router | Component-based SPA |
| **Controller** | Node.js + Express.js | REST API, ES modules |
| **Model** | PostgreSQL + `pg` driver | Parameterized queries only — no ORM |
| **Auth** | JWT + bcrypt + RBAC | Added in Step 3 |

**This stack is locked. Do not introduce ORMs, GraphQL, or alternative runtimes.**

---

## Seven Core Entities

```
User          — id, name, email, password_hash, role (official|collector|resident), created_at
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

---

## Development Conventions

- **ES modules** throughout the backend (`"type": "module"` in package.json).
- `pg` imported as default: `import pg from 'pg'; const { Pool } = pg;`
- `dotenv/config` imported at the very top of `server.js` before any other import.
- All SQL uses **parameterized queries** — never string-interpolate user input into SQL.
- Route files only wire URLs to controllers. Business logic lives in controllers; data access lives in models.
- JWT secret and all credentials live in `.env` — never committed.
