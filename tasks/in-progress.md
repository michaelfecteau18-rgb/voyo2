# In Progress

## P1-6 — Single Source of Truth for Passengers & Routes
**Spec:** `specs/passenger-route-model.md` · **Plan:** `tasks/plan-P1-6-passenger-route-model.md`
**Decisions ratified 2026-06-23:** stopId=passengerId · statusEvents nested at `trips/{tripId}/statusEvents` · fixed 5-passenger authoritative roster · implement without waiting for rules deploy.

- [x] **Phase A — Rules + tests** (2026-06-23): extended `firestore.rules` with `passengers/*`, `routes/*`, `trips/{tripId}/stops/{passengerId}`, `trips/{tripId}/statusEvents/{eventId}`; extended `tests/firestore.rules.test.mjs` (+18 P1-6 cases). Existing `trips`/`locations` blocks byte-identical to P0-3. Structurally validated; emulator run blocked by sandbox network allowlist (suite ready to run by user).
- [x] **Phase B — Data layer + seed** (2026-06-23): created `src/data/{status,passengersRepo,routesRepo,tripService}.js` + `scripts/seed-demo.mjs` (5-passenger §3.6 roster + `route_matin_a`). No UI/workflow edits. Build green (probe + clean); data layer lints clean; all firebase named imports resolve via bundler. Unimported by components (wired in Phase C).
- [x] **Phase C — Wire components to data layer** (2026-06-23): removed all 3 duplicated literals (DriverHome, ActiveRoute, AdminMap `PASSENGERS`); added `src/data/demoData.js` (single canonical source) + sync canonical accessors on the repos; refactored seed to import demoData. Components source passenger/route data via routesRepo/passengersRepo (synchronous — no async/loading/geofence change). GPS write + geofence + completion byte-identical. Build green; no new lint findings. Roster is now 5 app-wide (was 4 on driver).
- [ ] Phase C-orig — Driver reads
- [ ] Phase D — Driver writes (pickup/dropoff → setStopStatus + events)
- [ ] Phase E — Dispatcher live (stops subscription)
- [ ] Phase F — Closeout (delete literals, regression)
