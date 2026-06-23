# Completed Tasks

Log of delivered backlog items. Newest first.

---

## 2026-06-23 — P1-6 Single Source of Truth (Phases A & B)

*Foundation phases of P1-6 (`specs/passenger-route-model.md`, plan `tasks/plan-P1-6-passenger-route-model.md`). Builder-authored; no UI/workflow wired yet (Phases C–F remain in `tasks/in-progress.md`). Ratified decisions: stopId = passengerId · statusEvents nested at `trips/{tripId}/statusEvents` · fixed 5-passenger roster · implement without waiting on rules deploy.*

### P1-6 Phase A — Rules Extension — ✅ Complete
- **Date:** 2026-06-23
- **Objective:** Secure the four new P1-6 collections in `firestore.rules` (+ tests) without altering the P0-3 `trips`/`locations` blocks, so the data layer has enforceable ownership before any writes land.
- **Files created:** none (extended existing files).
- **Files modified:**
  - `firestore.rules` (now 128 lines) — added `match` blocks for `trips/{tripId}/stops/{passengerId}` (L74), `trips/{tripId}/statusEvents/{eventId}` (L84), `passengers/{passengerId}` (L106), `routes/{routeId}` (L112). Ownership on stops/events resolved via the parent trip's `driverId` (same pattern as `locations`); `passengers`/`routes` are admin-write / signed-in-read. Existing `trips/{tripId}` (L53) and `locations/{tripId}/points` (L94) blocks left byte-identical to P0-3.
  - `tests/firestore.rules.test.mjs` (76 lines) — +18 P1-6 cases (stop/statusEvents/passengers/routes allow+deny, owner vs non-owner).
- **Validation results:** Rules structurally valid — all four new `match` blocks present and brace-balanced; P0-3 `trips`/`locations` blocks confirmed unchanged. Test suite authored and ready. **Emulator execution blocked by the PO sandbox network allowlist** — the suite is ready for the user to run (`firebase emulators:exec`).
- **Risks discovered:**
  - *R2 — over-strict rules → silent write failures:* a wrong condition makes stop/event writes fail quietly; needs the emulator run (above) + UI surfacing of write errors before relying on it live.
  - *Enforcement still pending deploy (OPS-1):* rules are authored/committed only; not live until `firebase deploy --only firestore:rules` to `movigo-adee1` with an admin identity provisioned.

### P1-6 Phase B — Data Layer Foundation — ✅ Complete
- **Date:** 2026-06-23
- **Objective:** Build the shared `src/data` single-source-of-truth layer + an idempotent demo seed, as importable foundation only — no component/workflow edits (those are Phases C–E).
- **Files created:**
  - `src/data/status.js` — canonical snake_case `StopStatus`/`TripStatus` enums + allowed-transition table + `statusEventType()`; mirrors the `firestore.rules` status set.
  - `src/data/passengersRepo.js` — passenger reads (`getPassenger`, `getPassengers`, `listActivePassengers`).
  - `src/data/routesRepo.js` — route reads + `getRouteWithPassengers()` join + `getAssignedRouteForDriver()`.
  - `src/data/tripService.js` — `startTripFromRoute()` (additive `{merge:true}` trip write + batch-seed `stops/{passengerId}`) and `setStopStatus()` (stop update + `statusEvents` append in one action).
  - `scripts/seed-demo.mjs` (84 lines) — idempotent Admin-SDK seed of the canonical 5-passenger roster (§3.6) + `route_matin_a`.
- **Files modified:** none of the route components — the layer is intentionally unimported (wired in Phase C). Tracking files `tasks/in-progress.md` and `tasks/plan-P1-6-passenger-route-model.md` updated.
- **Validation results:** All five files pass `node --check` (parse-clean). Data layer imports only from `firebase/firestore` (named imports resolve via the bundler). GPS path preserved (AC-6): `tripService` never writes `currentLocation` or `locations/{tripId}/points`, and trip writes are `{merge:true}` (no reshape). *Full `vite build` could not be run in the PO sandbox — native binding `@rolldown/binding-linux-x64-gnu` is absent here; the Builder's own log records a clean green build, and parse-checks pass.*
- **Risks discovered:**
  - *R4 — denormalization drift:* `passengerName`/`address` are snapshotted into stop docs; a mid-trip passenger rename goes stale (accepted as point-in-time).
  - *R9 — auth identity for writes:* `setStopStatus`/`startTripFromRoute` require `auth.currentUser.uid == trip.driverId`; depends on authenticated session and overlaps P1-5 route guards.
  - *Seed not yet run live:* `scripts/seed-demo.mjs` needs `firebase-admin` + a service account (or the emulator); until run, `passengers/*` and `routes/*` are empty, so Phase C reads return nothing.

---

## 2026-06-23 — Product Owner (planning & documentation)

### Regenerate authoritative backlog — ✅ Complete
- **Change:** `tasks/backlog.md` regenerated as the single source of truth for VOYO. Added a master priority-order table (#1–#12), and full detail blocks for every P1/P2/P3 item plus two operational items (OPS-1 deploy rules, OPS-2 Linux CI). Each item carries status (`Not Started`/`In Progress`/`Complete`), dependencies, acceptance criteria, and a spec filename. Includes a text dependency graph and the documented path from 64 → honest 80.
- **Verified:** re-opened post-write; 173 lines; terminating `END OF FILE` marker present; all 12 priority rows and P1/P2/P3 sections intact (no truncation). The bash-mount 0-byte reading was confirmed stale-mount lag, not data loss.

### Regenerate current-state with 7-category findings + score — ✅ Complete
- **Change:** `docs/current-state.md` restructured around completed / partial / mocked / technical-risk / security-risk / missing-demo-feature findings, with a weighted demo-readiness scorecard. (Subsequently revised by Reviewer hotfix to reflect Phase 0 + 64/100.)

### Full repository audit + roadmap — ✅ Complete
- **Change:** `docs/audit-2026-06-23.md` (complete read-only audit: product/business alignment, real-vs-mocked inventory, verified build-blockers, security findings, demo-readiness) and `docs/roadmap.md` (Phase 0→5 sequencing toward the family/caregiver portals). Two build-blockers and the missing Firestore rules were first identified here, feeding Phase 0.
- **Role boundary:** no production code written or modified; outputs are recommendations, backlog, and roadmap only.

---

## 2026-06-23 — Hotfix (Reviewer finding)

### Fix `firebase.json` truncation — ✅ Complete
- **Reported by:** Reviewer agent — `firebase.json` was truncated to 233 bytes, cut off mid-token at `"rewrite` (line 13), producing invalid JSON (`Unterminated string`). Root cause: a write-truncation artifact of the workspace mount (same failure mode that truncated `ActiveRoute.jsx`); the file-tool write path silently capped the file. Worked around by writing via the shell instead.
- **Scope:** `vite build` was never affected (vite does not read `firebase.json`), but the Firebase CLI could not parse the config, blocking the pending P0-3 rules deploy.
- **Change:** restored `firebase.json` to valid JSON, preserving both the `firestore` block (rules + indexes) and the original `hosting` block (`public`, `ignore`, `rewrites` -> SPA fallback to `/index.html`).
- **Verified:** size 328 bytes with terminating newline; JSON parses via both `python json.load` and `node JSON.parse`; Firebase CLI loads the config cleanly (no "Could not find config" / "Did not find a Cloud Firestore rules file" warnings); `vite build` still exits 0 (built in 596ms).
- **No code modified** beyond `firebase.json`. Demo readiness score unchanged (64/100).

---

## 2026-06-23 — Phase 0 (Make it build)

### P0-1 — Fix `await` in non-async `handleDropoff()` — ✅ Complete
- **Spec:** `specs/P0-1-handledropoff-async.md`
- **Change:** `src/driver/ActiveRoute.jsx` — declared `handleDropoff` as `async`; wrapped the trip-completion `setDoc` in `try/catch` (parity with the GPS write path) so a failed final write is logged, not thrown as an unhandled rejection.
- **Also recovered (out-of-spec):** the file was truncated mid-JSX at line ~449 (navigation button + all closing tags missing) — a previously undocumented build-blocker. The missing tail was restored faithfully from the compiled `dist/` bundle (`Navigation` button -> `launchNavigation(current.address)`).
- **Verified:** `vite build` exits 0; completion path compiles; no new lint findings from the change.

### P0-2 — Fix case-mismatched module imports — ✅ Complete
- **Spec:** `specs/P0-2-case-mismatched-imports.md`
- **Change (Option A):** renamed files to PascalCase to match `App.jsx` imports: `src/shared/login.jsx -> Login.jsx`, `src/driver/driverhome.jsx -> DriverHome.jsx`, `src/admin/adminmap.jsx -> AdminMap.jsx`. Forced casing change via temp-name rename (the workspace mount is case-insensitive — the risk the spec flagged).
- **Verified:** all relative imports match on-disk casing; clean `npm install` + `vite build` exits 0 on a case-sensitive Linux filesystem; all four route components self-consistent (PascalCase).

### P0-3 — Firestore security rules — ✅ Complete (pending deployment)
- **Spec:** `specs/P0-3-firestore-security-rules.md`
- **Change:** new `firestore.rules` (deny-by-default; drivers write only their own `trips/{id}`; GPS points scoped to the real top-level `locations/{tripId}/points` path with ownership resolved via the trip doc; admin reads gated by `isAdmin()` custom-claim/allowlist). Added `firestore` block to `firebase.json`; new `firestore.indexes.json`; deploy command documented in `README.md`; rules unit-test suite in `tests/firestore.rules.test.mjs`.
- **Verified:** rules structurally valid (brace/paren balance, all required `match` blocks present).
- **PENDING (requires user's Firebase credentials):** run `tests/firestore.rules.test.mjs` against the emulator, then `firebase deploy --only firestore:rules` to `movigo-adee1`. Provision an `admins/{uid}` doc or `admin:true` claim for the dispatcher account before deploy, or the dashboard's active-trips query will be denied.

**Phase 0 outcome:** Build is green on a clean case-sensitive environment. Demo readiness 38 -> 64 (see `docs/current-state.md §7`). Rules enforcement lands the final security points on deployment.
