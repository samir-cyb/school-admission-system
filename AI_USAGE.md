# AI usage

## Tool

**Claude (Anthropic)**, used as a pair programmer through the Claude desktop app, with access to this
project folder. I made the decisions, reviewed every file, ran the app and tests on my own machine, and
made every commit myself.

## What it was used for

| Area | How AI helped | What I did |
|---|---|---|
| Reading the brief | Turned the brief into private planning docs (requirements, API contract, schema, step-by-step plan). They restate the confidential brief, so they are kept out of this public repo | Checked each one line by line against the brief |
| Concurrency design | Proposed the `SELECT … FOR UPDATE` per-class lock, derived seat counts, DB-clock expiry, partial unique index | Asked for the reasoning; verified the lock with 100 parallel `psql` sessions before any C# existed |
| Backend code | Drafted endpoints, services, SQL, migration runner, error handling, security middleware | Reviewed, built and ran it in Docker |
| Tests | Drafted the xUnit integration tests (concurrency, two app instances, expiry, idempotent confirm, validation, contract) and the Vitest tests | Ran them; read every assertion against the PDF rules |
| UI | Design tokens, Bangla/English copy, React components, motion | Reviewed screenshots in light/dark/mobile, tested flows in the browser |
| Docs | Drafts of README, ASSUMPTIONS | Edited to match what the code really does |

## Where the AI was wrong, and how it was caught

1. **Embedded SQL resource names.** Its migration loader guessed the manifest resource name from the
   file path, which breaks for file names that start with a digit (`0001_init.sql`). Caught in review;
   fixed by pinning `LogicalName="migrations/%(Filename)%(Extension)"` in the `.csproj`.
2. **Flaky header tests.** It added test cases for a header with Bangla digits and with a leading space.
   In-memory `TestServer` and real Kestrel treat those differently (Kestrel trims the space, so a real
   request would succeed), so the tests would have asserted the wrong thing. Removed and replaced with a
   dash-separated number that fails the same way everywhere.
3. **Highlight that destroyed input state.** To flash the student-id box it re-mounted the whole section
   with a changing React `key`, which reset the input and lost focus. Caught while testing the
   "apply without an id" flow; replaced with a CSS-only flash overlay.
4. **Test wrapper order.** The test helper put the router inside the toast provider, but toasts render
   router `<Link>`s. Caught when reading the helper; reordered so the router is outermost.
5. **Invisible logo in dark mode.** Logo colours came from theme tokens that were identical in dark mode.
   Caught in the dark-mode screenshot; the logo now uses fixed colours.
6. **Mobile header too tall.** The sticky header plus the student-id strip took about a third of a phone
   screen. Caught in the 390 px screenshot; the header now scrolls away on phones.
7. **Awkward expired-state actions.** The disabled "ভর্তি ফি দিন" button and "আবার আবেদন করুন" ended up in
   two separate rows. Caught in a screenshot; merged into one action row.
8. **Glass that made the UI laggy.** The first version of the glass design put a real `backdrop-filter`
   blur on every panel. It looked right, but a frame-time measurement with the CPU throttled 4× showed
   scrolling and page changes dropping to about 12 fps. The panels now use translucent surfaces over a
   static soft background (same look), with real blur only on the sticky header and small overlays;
   the same measurement holds 60 fps.
9. **An animation broke the strict CSP.** One animation mode (`AnimatePresence mode="popLayout"` on the
   status chip) injects a `<style>` tag, which the `style-src 'self'` policy blocks. Caught by running every
   flow in a browser under the production CSP and checking the console; switched to a mode that injects
   nothing, and the run is now violation-free.
10. **Package registry not reachable from the AI's sandbox.** It could not download NuGet packages, so it
   could not run the .NET build itself. It compiled the code against minimal stand-in types to catch
   syntax/type errors, and the real build and test run happened on my machine with Docker. I did not
   trust "it compiles in the sandbox" as proof; the Docker run is the proof.

## What I checked myself

- Every endpoint's field names and status codes against the PDF table.
- `docker compose up` from a clean clone; `docker compose down` + `up` keeps data.
- `docker compose --profile test run --rm tests` passes, including the concurrency tests.
- The UI flows: create class → apply → countdown → pay; apply → let it expire → EXPIRED without reload;
  refresh and browser restart keep "my applications"; stopping the backend shows a readable message.
