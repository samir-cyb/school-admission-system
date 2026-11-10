# Assumptions

Where the brief was silent, this is what I decided and why.

## Seats and applications

- **Seat counts are derived, never stored.** `heldSeats`/`confirmedSeats`/`availableSeats` are counted
  from the `holds` table on every read. A counter could drift; a count cannot. It also makes
  "confirming twice counts once" automatic, because a row is either CONFIRMED or not.
- **Active = HELD (not yet expired) or CONFIRMED.** After a hold expires or is cancelled, the student can
  apply to that class again. Applying to *different* classes (e.g. Morning and Day shift) is allowed.
- **Class names need not be unique.** Ids keep classes apart, and automated tests may reuse a name.
  Name: 1–100 characters. Seats: a whole JSON number from 1 to 10 000 (`"120"` or `1.5` → `400`).
- Classes cannot be edited or deleted (only creation is asked for).

## Holds

- Confirm/cancel need the owner's `X-Student-Id`; anyone else gets **403**.
- Confirming a CONFIRMED hold again → **200** (idempotent). Cancelling a CANCELLED hold again → **204**.
- Expired → confirm **409** `HOLD_EXPIRED`; cancelled → confirm **409** `HOLD_NOT_ACTIVE`.
- **A CONFIRMED admission cannot be cancelled** (**409**): the fee is paid and refunds are out of scope.
- `GET /holds/{id}` needs no header, as in the contract. Its response therefore never includes the
  `studentId`, and hold ids are 100-bit random (`h_` + 20 base32 chars) so they cannot be guessed.
- **Expiry needs no API call.** Every read treats a HELD row past `expiresAt` as EXPIRED and does not count
  it, so the seat is free exactly at `expiresAt`. A background service also writes `EXPIRED` to the table
  every few seconds.
- **All time decisions use the database clock** (`now()`), so two backend processes agree even if their
  own clocks differ. `expiresAt` is whole seconds in UTC, like the example.

## Identity

- No login (as the brief says). `X-Student-Id` must be exactly 17 ASCII digits, otherwise **400**. The UI
  converts Bangla digits (০-৯) and strips spaces before sending, and keeps the number in `localStorage`
  so applications survive a refresh or browser restart.
- Because the header is not a secret, anyone who knows a student's number can act as that student. That is
  inherent to the brief; everything else that can be hardened without breaking the contract is.

## How `held + confirmed ≤ totalSeats` is guaranteed (incl. bonus §1.6)

Creating a hold is one transaction that starts with
`SELECT … FROM classes WHERE id = @classId FOR UPDATE`. Every other request for the **same class** waits
on that row lock until we commit, then counts again and sees our hold; then it checks
`held + confirmed < totalSeats` and inserts or answers **409**. Different classes don't wait for each other.

The lock lives **in PostgreSQL**, not in the backend's memory, so two backend processes on different ports
take the same lock and are serialised exactly like two requests in one process. (A C# `lock` would only
cover one process.) A partial unique index on `(class_id, student_id)` for active holds backs up the
one-application rule. Confirm and cancel are single conditional `UPDATE`s that never increase
`held + confirmed`. Migrations run under an advisory lock so two processes can start together.

Proof: `ConcurrencyTests` (150 simultaneous applicants on 10 seats; two app instances on one database).
Try it live with `docker compose --profile bonus up` (second backend on port 8081).

## UI

- **Polling, not WebSockets:** classes every 3 s, an open application every 3 s, my applications every 5 s;
  paused while the tab is hidden. Meets "updates every few seconds without reload" with less machinery.
- **The countdown uses the server's clock** (from the HTTP `Date` header), so a wrong phone clock still
  shows the real time left. At zero the page shows EXPIRED and disables **ভর্তি ফি দিন** immediately.
- Bangla first, English optional; button labels are exactly the brief's.
- The admin screen is open like the rest (no login in the brief), labelled "School admin".
- The backend URL can change without rebuilding: the frontend container writes `/config.js` from `API_URL`
  at start (Vite would otherwise bake the URL in at build time).

Security measures are listed in the README.
