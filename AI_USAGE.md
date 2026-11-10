# AI usage

I built this project with **Claude (Anthropic)** as my coding assistant, through the Claude desktop app
with access to this folder. To be clear about the split: Claude wrote most of the code and the first
drafts of the documentation. I set the direction, made the design and scope decisions, ran and checked
everything on my own machine, found bugs by testing, and made every commit.

## How I worked

- **Plan before code.** Before any code, I had the brief turned into six planning documents
  (requirements, screen flow, UI spec, technical spec, database schema, step-by-step plan) plus an
  instruction file for the assistant. The rule was to read them before each task and tick off the plan
  after each step. They restate the confidential brief, so I kept them out of this public repo.
- **Small, checkable steps.** Backend, then tests, then frontend, then Docker. Each step had to build and
  pass before the next.
- **Nothing counts until it runs on my machine.** The assistant's sandbox could not download .NET
  packages, so it could only compile against stand-in types. I treated that as a hint, not proof. The real
  builds and test runs happened on my machine with Docker.

## Decisions I made

| Decision | Why |
|---|---|
| Keep the API contract exactly as given: no login, identity only from `X-Student-Id`, hardening inside that | Adding auth would break the evaluator's automated API tests |
| Bangla first, with an English toggle | Guardians are Bangla speakers; English helps reviewers |
| "Calm institutional" look (navy + teal), then frosted glass with soft 3D depth | A school office should feel trustworthy, and I wanted it to feel premium |
| "It must not feel laggy" as a hard requirement | Led to measuring frame times. Real blur on every panel dropped to ~12 fps on a slow CPU, so the glass was redesigned to hold 60 fps |
| A full security pass after the UI | Led to a CSP with no `unsafe-inline`, Trusted Types, dropped container capabilities, no secrets in config |
| Re-audit everything against the brief, line by line | Found smaller issues: log flooding on 409s, a tight rate limit, a too-long ASSUMPTIONS.md |
| Drop an end-to-end test suite I could not verify | I would rather submit 97 tests I have run than 135 with 38 I have not |
| Make each commit myself | So the history reflects how the work actually progressed |

## What I verified on my machine

- Docker Desktop, .NET 8 SDK, Node and Git set up; `docker compose up --build` builds and runs the stack.
- Backend tests: `docker compose --profile test run --rm --build tests` passes, including the concurrency
  tests.
- Frontend tests: `npm test` in `frontend/` → 22 passed.
- **Bonus (§1.6) with two real backend processes** on ports 8080 and 8081: 60 simultaneous applications
  for a 5-seat class gave exactly 5 × `201` and 55 × `409`.
- The UI by hand: creating classes, applying, paying. This is how I found the create-form bug below.

## Where the AI was wrong, and how it was caught

**Found by me**

1. **The first Docker build failed.** The test project never imported the `Xunit` namespace. Behind that
   was a second bug: a helper class named `Api` was resolved by C# as the namespace `Admission.Api`. I
   brought the build log back; both were fixed and the tests then passed.
2. **"Create class" went dead after the first class.** Manual testing: after one class, changing only the
   name left the button disabled with no explanation (the cleared seat field was invalid but its message
   was hidden). Fixed: the button is never silently disabled, and the seat count is kept between
   creates. A regression test covers it.
3. **A fix did not reach my disk.** After that fix, the frontend tests failed on my machine. The output
   showed the old form code was still there: one file update had not been written. The assistant then
   compared every project file on my disk with its copy, re-sent the one stale file and verified it.

**Caught by the assistant's own checks** (compiling, screenshots, frame-time measurement, a strict-CSP
browser run)

4. Migration resource names that would break for files starting with a digit; pinned in the `.csproj`.
5. Header test cases that behave differently in the in-memory test server and real Kestrel; replaced.
6. A highlight effect that re-mounted the student-ID box and lost the cursor; replaced with a CSS flash.
7. A test helper with the router inside the toast provider; reordered.
8. An invisible logo in dark mode, a too-tall header on phones, and the expired-state buttons split
   across two rows; all fixed from screenshots.
9. The first glass design dropped to ~12 fps on a throttled CPU; redesigned to hold 60 fps.
10. One animation injected a `<style>` tag that the strict CSP blocks; switched to a mode that injects
    nothing.
