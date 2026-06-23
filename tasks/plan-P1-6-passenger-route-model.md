# Implementation Plan — P1-6 Single Source of Truth for Passengers & Routes

**Author:** VOYO Builder agent · **Date:** 2026-06-23 · **Status:** Plan (decisions ratified; Phase A in progress)
**Spec:** `specs/passenger-route-model.md` (P1-6)
**Grounding:** line numbers verified against current source on 2026-06-23.

**Ratified decisions (2026-06-23):**
1. **stopId = passengerId** — stop docs live at `trips/{tripId}/stops/{passengerId}` (eliminates the seq↔index mapping risk).
2. **statusEvents location = `trips/{tripId}/statusEvents/{eventId}`** — nested under the trip (driver-owned, resolved via the parent trip's `driverId`).
3. **Canonical demo roster = a fixed 5-passenger dataset** (see §3.6), authoritative across the whole app.
4. **Rules deployment** — implement now; do **not** wait for deployment. (Phase A authors + tests rules; live `firebase deploy` remains a separate credentialed step.)

This is a planning artifact. No production code is produced in this file.

---

## 0. Grounding — verified current state

| Item | Location (verified) | Today |
|---|---|---|
| Driver roster literal | `DriverHome.jsx` L23–27 (`const passengers`) | 4 passengers, `status:'pending'`, short addresses |
| Hardcoded route label | `DriverHome.jsx` L88, L108 | "Route Matin A" string |
| Driver nav literal | `ActiveRoute.jsx` L10 (`const passengers`) | full addresses, no status |
| Hardcoded routeName write | `ActiveRoute.jsx` L87 | `routeName:'Route Matin A'` inside trip merge |
| Current stop selector | `ActiveRoute.jsx` L131 (`current = passengers[currentIndex]`) | index-based; passengerId now becomes the stop key |
| tripId | `ActiveRoute.jsx` L123 | client-generated `useRef` `trip_${uid}_${Date.now()}` |
| Pickup / dropoff handlers | `ActiveRoute.jsx` L190 / L198 | local state only; dropoff writes trip completion (P0-1) |
| GPS write block (DO NOT TOUCH) | `ActiveRoute.jsx` L72–96 | `trips/{id}` merge + `locations/{id}/points` append |
| Dispatcher literal | `AdminMap.jsx` L50 (`const PASSENGERS`) | 5 passengers, `waiting/onboard/dropped`, field `addr` |
| Dispatcher Passagers render | `AdminMap.jsx` L201 (`PASSENGERS.map`) | renders literal |
| Active-trips subscription (KEEP) | `AdminMap.jsx` L306–307 | `onSnapshot(trips where status==active)` |
| Other mock fillers | `AdminMap.jsx` L26 MOCK_DRIVERS, L58 SMS_LOG, L66 HISTORY | keep, label sample |

## 1. Files that will change

| File | Change | Spec ref |
|---|---|---|
| `src/driver/DriverHome.jsx` | Delete inline `passengers` (L23–27) and "Route Matin A" (L88, L108); load assigned route + joined passengers from `src/data`. | §8, AC-1/2 |
| `src/driver/ActiveRoute.jsx` | Delete module `passengers` (L10) and hardcoded `routeName` (L87); derive plan from route/trip via `src/data`. `handlePickup` → `setStopStatus(tripId, current.passengerId, 'onboard')`; `handleDropoff` → `setStopStatus(..., 'dropped_off')` around the P0-1 completion write. **GPS block L72–96 untouched.** | §8, AC-3/4/6 |
| `src/admin/AdminMap.jsx` | Delete `const PASSENGERS` (L50) + hardcoded `route` strings; keep MOCK_DRIVERS/SMS_LOG/HISTORY only if labeled sample. Add per-active-trip `onSnapshot(trips/{id}/stops)`; Passagers tab (L201) renders live stops. Keep L306 subscription + `isReal`. | §8, AC-5/9 |
| `firestore.rules` | **(Phase A)** Add `match` blocks for `passengers/*`, `routes/*`, `trips/{tripId}/stops/{passengerId}`, `trips/{tripId}/statusEvents/{eventId}`, reusing `isSignedIn()`/`isAdmin()`/`tripDriverId()`. Existing `trips` and `locations` blocks untouched. | §7, AC-8 |
| `tests/firestore.rules.test.mjs` | **(Phase A)** Add stop/statusEvents/passengers/routes ownership cases. | §12, AC-8 |
| `firestore.indexes.json` | Add a composite index only if a stops/statusEvents query needs it; expected none for P1-6 (single-collection subscription). | §3.5 |
| `README.md` | Note seed script + new collections. | §8 seed |

## 2. New files required

| File | Purpose | Spec ref |
|---|---|---|
| `src/data/passengersRepo.js` | Read `passengers/*`; `getPassenger(id)`, `listActivePassengers()`. | §8 |
| `src/data/routesRepo.js` | Read `routes/*`; `getRouteWithPassengers(routeId)` join (route.stops[].passengerId → passengers/{id}). | §8 |
| `src/data/tripService.js` | `startTripFromRoute(routeId)` → creates `trips/{id}` (existing fields + `routeId`/`serviceDate`), seeds `trips/{id}/stops/{passengerId}` at `scheduled`; `setStopStatus(tripId, passengerId, status)` → updates the stop doc (id = passengerId), sets timestamps, **and** appends a `trips/{tripId}/statusEvents` record in one action. | §8, AC-3/4/7 |
| `src/data/status.js` | Canonical snake_case status enums + allowed-transition table (§5/§6). | §5/§6 |
| `scripts/seed-demo.mjs` | One-time idempotent seed of the **fixed 5-passenger roster (§3.6)** + one `routes/{id}` "Route Matin A" referencing those ids. | §8 seed, §9 step 2 |
| `tasks/plan-P1-6-passenger-route-model.md` | This plan. | — |

> All new files written via **shell heredoc** + byte/newline verification (current-state §9 truncation hazard).

## 3. Firestore collections affected

| Collection | Status | Effect |
|---|---|---|
| `passengers/{passengerId}` | **NEW** | Identity SSOT (dispatcher-managed). Seeded from §3.6. |
| `routes/{routeId}` | **NEW** | Plan SSOT; `stops[]` reference passengerId only. Seeded. |
| `trips/{tripId}` | **EXISTING — additive only** | Gains `routeId`, `serviceDate`; existing fields unchanged. No reshape. |
| `trips/{tripId}/stops/{passengerId}` | **NEW subcollection** | Live per-passenger status; **doc id = passengerId** (decision 1). Seeded at trip start; mutated by driver. |
| `trips/{tripId}/statusEvents/{eventId}` | **NEW subcollection** | Append-only fan-out (decision 2). Written per transition; no consumer code now. |
| `locations/{tripId}/points/{pointId}` | **EXISTING — UNCHANGED** | GPS path. Out of scope (AC-6). |
| `admins/{uid}` | **EXISTING (P0-3)** | `isAdmin()` allowlist; reused, unchanged. |

### 3.6 Canonical demo roster (decision 3 — authoritative)

Fixed 5-passenger dataset; the single authoritative demo data for the whole app (reconciles the three former literals + the AdminMap-only 5th passenger). passengerId is the stable stop key.

| passengerId | fullName | address (geocodable, Granby QC) | accessibility |
|---|---|---|---|
| `pax_jacob_bouchard` | Jacob Bouchard | 142 rue des Érables, Granby, QC | wheelchair |
| `pax_elise_dupont` | Élise Dupont | 89 boul. Laurier, Granby, QC | — |
| `pax_thomas_lefebvre` | Thomas Lefebvre | 25 rue Principale, Granby, QC | — |
| `pax_marie_tremblay` | Marie Tremblay | 67 av. des Pins, Granby, QC | boarding assistance |
| `pax_lise_pare` | Lise Paré | 310 rue Saint-Jacques, Granby, QC | — |

Route `route_matin_a` (serviceDate set at seed/run time): ordered `stops[]` = the five above, seq 1–5.

## 4. Migration steps (additive, reversible — spec §9)

1. **Rules first (Phase A).** Add the four new `match` blocks; author + test. Live deploy deferred (decision 4) but rules ship in-repo now.
2. **Seed identity data (Phase B).** `scripts/seed-demo.mjs` creates the §3.6 passengers + `route_matin_a`. Idempotent (stable ids).
3. **Add shared `src/data` layer (Phase B/C)**; point `DriverHome`+`ActiveRoute` reads at it; GPS writes unchanged.
4. **Wire driver writes (Phase D).** `startTripFromRoute` seeds `trips/{id}/stops/{passengerId}`; `handlePickup`/`handleDropoff` call `setStopStatus` keyed by the **current passengerId** (decision 1 — no seq mapping). Existing `trips`/`locations` writes unchanged.
5. **Wire dispatcher reads (Phase E).** Add `stops` subscription to `AdminMap`; remove `PASSENGERS` literal.
6. **Delete the three literals (Phase F)** once all read from `src/data`. Grep-verify zero remain.
7. **Future seams unused** (`statusEvents`, `contacts`, `consent`) — no SMS/portal code.

No live-trip data migration; old trips remain readable; no downtime.

## 5. Estimated implementation phases

| Phase | Work | Est. | Gate |
|---|---|---|---|
| **A — Rules + tests** *(current)* | Extend `firestore.rules` + `tests/firestore.rules.test.mjs` | 0.5 day | Rules valid; unit tests written; deny/allow per §7 (emulator if reachable) |
| **B — Data layer + seed** | `src/data/*`, `status.js`, `scripts/seed-demo.mjs` (§3.6) | 0.5 day | Seeded passengers/route readable; join works |
| **C — Driver reads** | `DriverHome`+`ActiveRoute` read plan from `src/data`; GPS untouched | 0.25 day | Driver renders from Firestore; markers still move |
| **D — Driver writes** | `startTripFromRoute` seeds stops; pickup/dropoff → `setStopStatus` + events | 0.5 day | Firestore shows status + timestamps + events; P0-1 intact |
| **E — Dispatcher live** | `AdminMap` stops subscription; remove literal; label mocks | 0.5 day | Two-session: status flips ≤1–2 s, no reload |
| **F — Closeout** | Delete 3 literals; grep clean; build/lint; GPS regression | 0.25 day | AC-1/2 grep zero; build exit 0; GPS pass |

**Total ≈ 1.5–2 days.** Land C+D+E together (no half-migration).

## 6. Risks

- **R1 — Breaking the GPS pipeline (highest).** GPS block L72–96 and `locations/{id}/points` out of scope; regression-verify markers after each phase. See §7.
- **R2 — Rules too strict → silent write failures.** Stop/event writes fail quietly. Mitigation: emulator tests; surface write errors in UI.
- **R3 — Listener cost/leaks.** One `onSnapshot` per active trip's stops; unsubscribe on completion/unmount.
- **R4 — Denormalization drift.** `passengerName`/`address` snapshotted into stops; stale if renamed mid-trip. Accepted point-in-time.
- **R5 — Half-migrated demo.** Land shared layer + driver writes + dispatcher reads together, or revert as a unit.
- **R6 — Workspace write truncation.** New files via shell heredoc + byte-verify.
- **R7 — ~~currentIndex ↔ stopId mismatch~~ — RESOLVED by decision 1.** stopId = passengerId, so the current passenger maps directly to its stop doc; no seq/index arithmetic. Ordering still comes from `route.stops[].seq`; assert each current passenger has a seeded stop doc at trip start.
- **R8 — Privacy/consent.** `contacts`/`consent` in schema but not surfaced/texted until policy (gates P2-7/P4).
- **R9 — Auth identity for writes.** `setStopStatus` requires `auth.currentUser.uid == trip.driverId`; gate trip start on authenticated user (overlaps P1-5).

## 7. What can break existing GPS tracking (explicit — AC-6)

1. **Editing the GPS write block** (`ActiveRoute.jsx` L72–96). → Out of scope; verified by diff at Phase F.
2. **Changing the `trips/{tripId}` doc shape or id.** Stops/statusEvents hang off the same `tripId`. → `startTripFromRoute` reuses the existing client `tripId`, only *adds* `routeId`/`serviceDate` via merge; never replaces `driverId/status/currentLocation`.
3. **Rules regression.** → Phase A adds **new** `match` blocks only; the existing `trips/{tripId}` and `locations/{tripId}/points` blocks are not modified; rules tests assert GPS create/update still allowed for the owning driver, and that the new `stops`/`statusEvents` rules resolve ownership via `tripDriverId(tripId)` exactly like points.
4. **Geocoding/navigation source swap.** Nav reads the stop's denormalized `address`; a blank seeded address breaks `geocodeAddress` + geofence. → Seed canonical geocodable addresses (§3.6); null-guard nav.
5. **Extra listeners.** Additive subscriptions; map subscription (L306) untouched; unsubscribe on completion.
6. **Trip completion path.** `handleDropoff` also calls `setStopStatus('dropped_off')` around the P0-1 write. → Keep P0-1 `async`/`try-catch`; wrap the stop/event write in its own try/catch so it can't throw past completion.

**Regression guard (every phase):** run the driver flow; confirm the dispatcher marker keeps moving and `locations/{id}/points` keeps growing.

## 8. Acceptance-criteria confirmation (AC 1–10 → plan)

| AC | Requirement | Satisfied by |
|---|---|---|
| AC-1 | One source for passengers; 3 literals removed | §1 (3 files), §2 `passengersRepo`, §4 steps 2/3/6, §3.6 roster |
| AC-2 | One source for routes; no hardcoded "Route Matin A" | §1 (DriverHome L88/108, ActiveRoute L87), §2 `routesRepo` |
| AC-3 | Pickup → `onboard` + `pickedUpAt` + `picked_up` event | §1 ActiveRoute `handlePickup`, §2 `tripService.setStopStatus`, Phase D |
| AC-4 | Dropoff → `dropped_off` + `droppedOffAt` + event; last dropoff completes (P0-1) | §1 ActiveRoute `handleDropoff`, §7 item 6, Phase D |
| AC-5 | Dispatcher live ≤1–2 s, no reload | §1 AdminMap stops subscription, Phase E, §12 two-session |
| AC-6 | GPS preserved; `locations`/`currentLocation` unchanged | §3 (UNCHANGED rows), **§7 entire section**, regression guard |
| AC-7 | `statusEvents` per transition, SMS/portal-ready, no consumer code | §2 `tripService` (stop+event together), §3 statusEvents NEW (nested), §4 step 7 |
| AC-8 | New collections secured per §7 ownership; non-owner denied | §1 `firestore.rules` (Phase A), rules tests, Phase A gate |
| AC-9 | Honest demo: real statuses; mocks labeled sample | §1 AdminMap, §4 step 5, `isReal` preserved |
| AC-10 | Additive migration; trips/locations not reshaped; build green | §3 (additive), §4 (no live-trip migration), Phase F gate |

**Conclusion:** every AC (1–10) maps to concrete work; req. 9 (additive) and req. 10 (GPS preserved) are first-class constraints. Decisions 1–4 are reflected throughout.

<!-- END OF PLAN P1-6 -->
