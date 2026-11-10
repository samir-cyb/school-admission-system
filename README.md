# School Admission System

Online, first-come-first-served school admission. A guardian applies for a class (one class per shift),
the seat is **held** for the student for a limited time, and paying the admission fee **confirms** it.
Unpaid holds expire by themselves and the seat goes back to the pool.

The core guarantee: **`held + confirmed` never exceeds `totalSeats`**, no matter how many requests arrive at
once — even with two backend processes on one database.

| Part | Stack |
|---|---|
| Backend | .NET 8 Minimal API, Npgsql + Dapper (plain SQL), PostgreSQL 16 |
| Frontend | React 19 + TypeScript + Vite, TanStack Query, Motion |
| Run | Docker Compose |

## Run it

Only Docker is needed.

```bash
docker compose up --build
```

| What | URL |
|---|---|
| **Frontend** | **http://localhost:5173** |
| Backend API | http://localhost:8080 (e.g. `GET /classes`) |
| Database | PostgreSQL 16, inside the compose network only (not exposed to the host) |

First start takes a few minutes while images build. Data is kept in the `pgdata` volume, so
`docker compose down` followed by `docker compose up` keeps every class and application.
(`docker compose down -v` wipes it.)

### Using the app

1. **Create a class** — open "নতুন class", enter e.g. `Class 6 – Morning Shift` and `120` seats.
2. **Identify the student** — type the 17-digit birth registration number in the box at the top
   (Bangla or English digits). It is remembered across refresh and browser restarts.
3. **Apply** — on "Class তালিকা" press **আবেদন করুন**. The seat is held and a countdown starts.
4. **Pay** — press **ভর্তি ফি দিন** before the countdown ends (treated as a successful payment), or
   **বাতিল** to release the seat.
5. **আমার আবেদন** lists every application of this student and its live status.

Language (বাংলা / English) and theme (system / light / dark) toggles are in the top bar.

## Tests

**97 automated tests** in two layers.

| Layer | Command | Count | What it proves |
|---|---|---|---|
| Backend unit + integration (xUnit, real PostgreSQL) | `docker compose --profile test run --rm --build tests` | 75 | Rules, validation, concurrency, expiry, contract |
| Frontend components (Vitest + Testing Library) | `cd frontend && npm ci && npm test` | 22 | Screens, errors, countdown, forms |

### Backend (required by the brief: ≥ 3 tests including a concurrency test)

```bash
docker compose --profile test run --rm --build tests
```

Integration tests boot the real API against the compose PostgreSQL (each run creates and drops its own
throw-away database, so app data is untouched); unit tests cover the pure rules. Highlights:

| Test | Shows |
|---|---|
| `Many_parallel_applications_never_hold_more_seats_than_exist` | 150 students apply at the same instant to a 10-seat class → exactly 10 × `201`, 140 × `409`, 10 rows in the DB |
| `Two_app_instances_on_one_database_never_oversell` | Bonus §1.6: two independent app hosts, one DB, 120 parallel requests → exactly 10 holds |
| `Same_student_applying_in_parallel_gets_exactly_one_hold` | one active application per student per class, under concurrency |
| `Confirming_the_same_hold_many_times_counts_once` | 5 parallel confirms → all `200`, `confirmedSeats` = 1 |
| `Hold_expires_by_itself_and_the_seat_comes_back` | `HOLD_DURATION_SECONDS=2`: EXPIRED with no API call, seat reusable, confirm → `409` |
| `All_eight_endpoints_return_the_documented_shapes` | exact field names of the contract |
| `Create_class_rejects_bad_input_with_400` and friends | malformed JSON, wrong types, bad header, unknown ids → 4xx, never 500 |
| `UnitTests.cs` | 17-digit id rules and log masking, id format, config parsing (bad `HOLD_DURATION_SECONDS` fails fast), body validation, error mapping never leaks internals |

### Frontend (bonus)

```bash
cd frontend
npm ci
npm test
```

Vitest + Testing Library: student-id normalisation (Bangla digits), Bangla/English error messages,
class list rendering and apply flow (`X-Student-Id` header, 409 message), the countdown flipping to
EXPIRED and disabling **ভর্তি ফি দিন** without a reload, the create-class form, my applications
(grouping, empty state, server down) and the identity box.

### Bonus: two backend processes, same database

```bash
docker compose --profile bonus up --build
```

Starts a second backend on **http://localhost:8081** next to the one on 8080, both on the same PostgreSQL.
Fire requests at both ports; the seat limit still holds (see `ASSUMPTIONS.md` for why).

## Configuration

Every value has a working default; override in a `.env` file next to `docker-compose.yml`
(see `.env.example`).

| Variable | Default | Meaning |
|---|---|---|
| `HOLD_DURATION_SECONDS` | `600` | How long a hold lasts |
| `ConnectionStrings__Default` | set by compose | Backend database connection (built from the `POSTGRES_*` values) |
| `API_URL` | `http://localhost:8080` | Backend URL used by the browser; applied when the frontend container starts (no rebuild) |
| `FRONTEND_PORT` | `5173` | Host port of the frontend |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000` | Origins allowed to call the API |
| `EXPIRY_SWEEP_SECONDS` | `5` | How often expired holds are written as EXPIRED |
| `RATE_LIMIT_PER_MINUTE` | `20000` | Per-IP request limit (`0` = off); high so load tests are never throttled |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `admission` / `admission_local_pw` / `admission` | Local database credentials |

If you change `FRONTEND_PORT`, add the new origin to `CORS_ORIGINS`.

### Local development without Docker (optional)

```bash
# backend (needs a PostgreSQL; the connection string is never stored in the repo)
cd backend
ConnectionStrings__Default="Host=localhost;Database=admission;Username=admission;Password=admission_local_pw" \
  dotnet run --project src/Admission.Api

# frontend
cd frontend
npm ci
VITE_API_URL=http://localhost:8080 npm run dev
```

## API

Base URL `http://localhost:8080`, JSON in and out, student identity in the `X-Student-Id` header
(17-digit birth registration number).

| # | Endpoint | Success |
|---|---|---|
| 1 | `POST /classes` `{ "name", "totalSeats" }` | `201 { id, name, totalSeats }` |
| 2 | `GET /classes` | `200 [{ id, name, totalSeats, heldSeats, confirmedSeats, availableSeats }]` |
| 3 | `GET /classes/{classId}` | `200 { …same… }` |
| 4 | `POST /classes/{classId}/holds` + header | `201 { holdId, classId, studentId, status: "HELD", expiresAt }` · no seat → `409` |
| 5 | `GET /holds/{holdId}` | `200 { holdId, classId, status, expiresAt }` |
| 6 | `POST /holds/{holdId}/confirm` + header | `200 { holdId, status: "CONFIRMED" }` |
| 7 | `DELETE /holds/{holdId}` + header | `204` |
| 8 | `GET /me/holds` + header | `200 [{ holdId, classId, className, status, expiresAt }]` |

Errors always look like `{ "error": { "code": "NO_SEATS_AVAILABLE", "message": "…" } }`.
Status codes: `400` bad input or header, `403` someone else's hold, `404` unknown id, `409` no seat /
already applied / expired / not active, `429` rate limit, `503` database down.

Quick check with curl:

```bash
curl -s -X POST localhost:8080/classes -H "Content-Type: application/json" \
     -d '{"name":"Class 6 - Morning Shift","totalSeats":2}'
curl -s -X POST localhost:8080/classes/<id>/holds -H "X-Student-Id: 20152691234567890"
```

## Security

There is no login (the brief says so); identity is the `X-Student-Id` header. Within that contract:

| Area | What is done |
|---|---|
| Input | Strict hand-parsed JSON (exact types, 1–100 char names, 1–10 000 seats), 17-digit header check, malformed ids → 404. Bad input is always 4xx, never 500. |
| Database | Every SQL statement is parameterised. PostgreSQL is not published to the host. No connection string or password in the code; compose passes it by environment. |
| Errors | One JSON error shape; no stack traces, SQL or exception text in responses; DB outage → 503. |
| Abuse | 16 KB body limit, 30 s request timeout, per-IP rate limit, hold ids with 100 random bits. |
| Browser | CORS allow-list (no `*`, no credentials). Frontend CSP: `script-src 'self'`, `style-src 'self'` (no `unsafe-inline`), Trusted Types required, `connect-src` limited to the API, `frame-ancestors 'none'`; plus `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`. Fonts are self-hosted, so the page makes no third-party requests. `API_URL` is validated before it is written into `/config.js`. |
| API headers | `nosniff`, `DENY`, deny-all CSP, `Cache-Control: no-store`, no `Server` banner. |
| Containers | Non-root users, all Linux capabilities dropped, `no-new-privileges`, read-only backend filesystem. |
| Privacy | The 17-digit number is the only personal data stored, and it is masked in logs (`2015*********7890`). |

Not done because it is outside a local take-home: real authentication, TLS, separate database roles for
migrations and runtime, secret management. The default database password in `docker-compose.yml` is for
local use and can be overridden in `.env`.

## Repository map

```
.
├── docker-compose.yml        db + backend + frontend (+ "test" and "bonus" profiles)
├── .env.example              every setting with its default (copy to .env to override)
├── backend/
│   ├── Dockerfile            build → test → non-root runtime
│   ├── src/Admission.Api/    endpoints, services, SQL migration, security middleware
│   └── tests/                xUnit integration tests against real PostgreSQL
├── frontend/
│   ├── Dockerfile            node build → non-root nginx
│   ├── nginx/                runtime API_URL (/config.js) + Content-Security-Policy
│   └── src/                  React app, design tokens, glass styles, Vitest tests
├── ASSUMPTIONS.md            decisions where the brief was silent
└── AI_USAGE.md               how AI tools were used
```
