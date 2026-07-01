# WasteCoord — Nairobi Waste Collection Coordination System

A web-based platform for coordinating municipal solid waste collection across Nairobi County.  
County officials manage zones, schedules, collectors, and NEMA reports; collectors log pickups and handle citizen complaints; residents track schedules and file complaints.

---

## Prerequisites

| Tool | Version tested |
|------|---------------|
| Node.js | 20 LTS |
| npm | 10+ |
| PostgreSQL | 15 or 18 |

---

## Installation

```bash
# 1 — Clone / navigate to the project root
cd waste-collection-system

# 2 — Install backend dependencies
cd backend && npm install

# 3 — Install frontend dependencies
cd ../frontend && npm install
```

---

## Environment Variables

Copy the example file and fill in your PostgreSQL credentials:

```bash
cd backend
cp .env.example .env
```

`.env` must contain:

```
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=waste_collection
JWT_SECRET=change_me_to_a_long_random_string
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

---

## Database Setup

```bash
# Create the database (run once)
psql -U postgres -c "CREATE DATABASE waste_collection;"

# Run all migrations (from the backend directory)
cd backend
npm run migrate
```

---

## Demo Seed

Populates one official, three collectors, four zones, schedules, pickups for the current week, six complaints, and one report.  
**Safe to run multiple times** — all inserts are idempotent.

```bash
cd backend
node --env-file=.env src/config/seed.js
```

### Demo credentials

| Role | Email | Password |
|------|-------|----------|
| County Official | official@demo.ke | Official1! |
| Collector (EcoClean) | ecoclean@demo.ke | Collector1! |
| Collector (GreenPick) | greenpick@demo.ke | Collector2! |
| Collector (NairobiWaste) | naiwaste@demo.ke | Collector3! |
| Resident | resident@demo.ke | Resident1! |

---

## Running the Application

Open two terminals:

**Backend** (port 5000):
```bash
cd backend
npm run dev
```

**Frontend** (port 5173):
```bash
cd frontend
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## API — Postman Collection

Import both files from the `docs/` directory into Postman:

1. `docs/WasteCoord.postman_collection.json`
2. `docs/WasteCoord.postman_environment.json`

Select the **WasteCoord – Local** environment.  
Run any **Login** request first — the test script captures the JWT and stores it in the `token` variable automatically.  
All other requests send `Authorization: Bearer {{token}}`.

---

## Project Structure

```
waste-collection-system/
├── backend/
│   ├── migrations/          # PostgreSQL migration files (run in order)
│   ├── tests/
│   │   ├── helpers.js       # Shared token factories + DB helpers
│   │   ├── unit/            # Pure function tests (no DB)
│   │   └── integration/     # Supertest tests against the Express app
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js        # pg Pool + withTransaction helper
│   │   │   ├── migrate.js   # Migration runner
│   │   │   ├── seed.js      # Idempotent demo data seeder
│   │   │   └── validateEnv.js
│   │   ├── controllers/
│   │   ├── middleware/      # auth, validate, error, ownership
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   │   └── dates.js     # Shared UTC date/week utilities
│   │   ├── app.js
│   │   └── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # axios client + per-resource helpers
│   │   ├── components/      # Layout, Modal, ErrorBoundary, ProfileMenu
│   │   ├── context/         # AuthContext (JWT + localStorage)
│   │   ├── pages/
│   │   │   ├── official/    # Collectors, Zones, Schedules, Tracking, Complaints, Reports
│   │   │   ├── collector/   # MyPickups
│   │   │   └── DashboardPage.jsx (role-branching)
│   │   └── styles/
│   └── package.json
├── docs/
│   ├── WasteCoord.postman_collection.json
│   └── WasteCoord.postman_environment.json
└── README.md
```

---

## Role Summary

| Role | Capabilities |
|------|-------------|
| **Official** | Manage collectors, zones, schedules; view pickup tracking; manage complaints; generate NEMA reports |
| **Collector** | View own schedules; log pickups as completed or missed; manage assigned complaints |
| **Resident** | Select home zone; view collection schedules; submit and track complaints |

---

## Running the Tests

The backend has a Vitest test suite (unit tests for date utilities + integration
tests against a real PostgreSQL test database).

**One-time setup:**

```bash
# 1 — Create a separate test database (never use your dev DB — tests truncate tables)
psql -U postgres -c "CREATE DATABASE waste_collection_test;"

# 2 — Copy the test env file and fill in your credentials
cd backend
cp .env.test.example .env.test

# 3 — Run migrations against the test DB
node --env-file=.env.test src/config/migrate.js
```

**Run the tests:**

```bash
cd backend
npm test              # run once and exit
npm run test:watch    # interactive watch mode
```

---

## Security Notes

**JWT in `localStorage`** — Auth tokens are stored in `localStorage` rather than
`httpOnly` cookies.  This is a deliberate simplicity tradeoff for a demo/portfolio
project: `httpOnly` cookies require CSRF protection (double-submit tokens or
SameSite cookies) which adds meaningful complexity without a proportionate security
benefit at this scale.  For a production deployment handling sensitive data, the
cookie + CSRF approach would be preferred.

**Forward-only migrations** — The `backend/migrations/*.sql` files are all
forward-only; the migration runner never reverts.  If you need to undo a
migration, write the reverse SQL by hand and apply it directly.

---

## Tech Stack

- **Frontend:** React 18, Vite 5, React Router 6, axios, react-hot-toast
- **Backend:** Node.js 20, Express 4, PostgreSQL 18, jsonwebtoken, bcrypt
- **Security:** helmet, cors, express-rate-limit (300 req/15 min global + 10 req/15 min on auth routes), express-validator, express-async-errors
- **Testing:** Vitest, supertest
