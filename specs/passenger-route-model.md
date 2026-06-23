# Spec P1-6 — Single Source of Truth for Passengers & Routes

**ID:** P1-6
**Phase:** Phase 1 — Honest demo for Amibus
**Author:** VOYO Architect agent
**Date:** 2026-06-23
**Status:** Draft — ready for Builder
**Decisions honored:** DEC-002 (visibility before optimization), DEC-003 (honest Amibus demo), DEC-004 (single source of truth)
**Source inputs:** `docs/architecture.md`, `docs/current-state.md`, `docs/business-model.md`, `docs/users.md`, `decisions/DEC-002/003/004`, current source (`DriverHome.jsx`, `ActiveRoute.jsx`, `AdminMap.jsx`, `firestore.rules`)
**Estimated effort:** ~1–2 days implementation + emulator/manual test
**Implementation note:** Specification only. No production code is written here. All code fragments are illustrative; the Builder agent owns final implementation against the Acceptance Criteria.

---

## 1. Problem Statement

Passenger and route data is defined **three separate times**, in three components, with **conflicting shapes and status vocabularies**. A driver and a dispatcher looking at the same person ("Marie Tremblay") see different truths, and no driver action ever changes what the dispatcher sees. This blocks the single most valuable Amibus demo moment (DEC-003): *driver confirms pickup → dispatcher sees the status change live.*

The business objective for P1-6 is a one-way, real-time status flow with one authoritative record:

> A driver picks up a passenger → the passenger's status changes **once** in Firestore → the dispatcher immediately sees the updated status → and the **same** status record is later consumable by SMS notifications, a caregiver portal, and a family portal — without re-modeling the data.

Per DEC-004, passenger and route information must not be duplicated across files, components, or collections; status is **written once and reflected everywhere**. This spec defines the Firestore data model and the component changes that make that true, while (req. 9) minimizing migration complexity and (req. 10) preserving the existing, working GPS pipeline.

## 2. Current Architecture Analysis

### 2.1 The three conflicting definitions (the core defect)

| Location | Shape | Status vocabulary | Notes |
|---|---|---|---|
| `src/driver/DriverHome.jsx` (~L23) | `{ id, name, address, notes, status }` | `'pending'` | Short addresses; route label hardcoded "Route Matin A". |
| `src/driver/ActiveRoute.jsx` (~L10, module-level `const passengers`) | `{ id, name, address, notes }` | **none** | Full addresses ("…, Granby, Quebec"); drives geocoding/navigation. Has no status field at all. |
| `src/admin/AdminMap.jsx` (~L50, `const PASSENGERS`) | `{ name, addr, route, status, sms, notes }` | `'waiting' / 'onboard' / 'dropped'` | Different field names (`addr`), extra fields (`sms`), 5th passenger ("Lise Paré") not present in driver files. |

Three different status vocabularies (`pending`; none; `waiting/onboard/dropped`), none of which matches the **documented** model in `docs/architecture.md` (Passenger: *Waiting → Picked Up → Onboard → Dropped Off*; Trip: *Scheduled → Assigned → Active → Completed → Cancelled*). Routes exist only as hardcoded strings (`'Route Matin A'`, `routeName: 'Route Matin A'` at `ActiveRoute.jsx` ~L87, and `MOCK_DRIVERS[].route` in `AdminMap.jsx`).

### 2.2 What already works and must be preserved (req. 10)

The driver→Firestore→dispatcher **GPS pipeline is real and is the project's best asset** (current-state §1). It must not regress:

- `ActiveRoute.jsx` writes `trips/{tripId}` with `{ currentLocation, driverId, status, routeName, updatedAt }` (merge) and appends GPS points to the top-level path `locations/{tripId}/points` (~L83–L96).
- On completion (P0-1) it merges `{ status: 'completed', completedAt }` into `trips/{tripId}`.
- `AdminMap.jsx` subscribes in real time via `onSnapshot(query(collection(db,'trips'), where('status','==','active')))` (~L306) and renders real GPS markers distinctly from `MOCK_DRIVERS` via the `isReal` flag.

So **real-time transport already exists for *location*.** P1-6 extends the same pattern to *passenger status* — it does not invent a new transport mechanism.

### 2.3 Security model already in place (P0-3)

`firestore.rules` (authored, pending deploy) enforces: deny-by-default; a driver may create/update only a `trips/{id}` where `driverId == request.auth.uid`; GPS points under `locations/{tripId}/points` are scoped to the owning driver via a `get()` on the trip; admin reads gated by `isAdmin()` (custom claim or `admins/{uid}` allowlist). **P1-6's new collections must extend this same ownership model**, not bypass it.

## 3. Firestore Schema

Design principle: **separate slow-changing identity (passengers, routes) from live execution (trips + per-stop status)**. Identity is the single source of truth for *who* and *what is planned*; the trip is the single source of truth for *what is happening now*. This keeps the existing `trips`/`locations` pipeline intact (additive migration) and gives every present and future consumer one place to read status.

### 3.1 `passengers/{passengerId}` — identity master (SSOT for passengers, req. 1)

```
passengers/{passengerId}
  fullName: string                  // "Marie Tremblay"
  address: string                   // canonical full address, geocodable: "67 av. des Pins, Granby, Quebec"
  geo: { lat: number, lng: number } | null   // cached geocode (optional; filled lazily)
  accessibility: {
    wheelchair: boolean,
    boardingAssistance: boolean,
    notes: string                   // free text, replaces ad-hoc "♿" / "🤝" emoji
  }
  contacts: {
    family:   [{ name, phone, locale, smsOptIn: boolean }],   // future family portal + SMS
    caregiver:[{ name, phone, role,  smsOptIn: boolean }]      // future caregiver portal + SMS
  }
  consent: { locationSharing: boolean, smsConsentAt: timestamp | null }  // privacy (current-state §5)
  active: boolean                   // soft-delete / roster on-off
  createdAt: timestamp
  updatedAt: timestamp
```

### 3.2 `routes/{routeId}` — route master (SSOT for routes, req. 2)

```
routes/{routeId}
  name: string                      // "Route Matin A"
  serviceDate: string               // "2026-06-23" (YYYY-MM-DD) — a route is per service day
  status: string                    // route lifecycle (see §6)
  assignedDriverId: string | null   // Firebase Auth uid of the driver
  vehicleId: string | null          // forward hook for Vehicles object (architecture.md); nullable now
  stops: [                          // ORDERED plan; the canonical pickup sequence
    {
      seq: number,                  // 1-based order
      passengerId: string,          // reference into passengers/{id} — NO duplicated name/address
      scheduledPickup: string | null,   // "08:15"
      scheduledDropoff: string | null
    }
  ]
  createdAt: timestamp
  updatedAt: timestamp
```

Note: `stops` references `passengerId` only. Names/addresses are **never copied** into the route (DEC-004). A UI joins `route.stops[].passengerId` → `passengers/{id}` for display.

### 3.3 `trips/{tripId}` — live execution (extends the EXISTING doc; req. 10)

Existing fields are **kept exactly as today**; P1-6 only *adds* references. This is the key to minimal migration.

```
trips/{tripId}
  // --- existing (unchanged; preserves GPS pipeline) ---
  currentLocation: { lat, lng, speed, heading, accuracy, updatedAt }
  driverId: string                  // == request.auth.uid (rules already enforce)
  status: string                    // trip/route execution state (§6): active | completed | ...
  updatedAt: timestamp
  completedAt: timestamp            // set on completion (P0-1)
  // --- added by P1-6 ---
  routeId: string                   // reference to routes/{id}  (replaces hardcoded routeName)
  routeName: string                 // KEPT denormalized for display continuity (already written today)
  serviceDate: string
```

### 3.4 `trips/{tripId}/stops/{stopId}` — live per-passenger status (the money shot)

This subcollection is the **single authoritative live status** for each passenger on this trip. It is seeded from `routes/{routeId}.stops` when the trip starts, then mutated by driver pickup/dropoff. Every consumer (dispatcher now; SMS, caregiver, family later) reads/subscribes here.

```
trips/{tripId}/stops/{stopId}
  seq: number
  passengerId: string               // reference → passengers/{id}
  passengerName: string             // denormalized for cheap display + offline resilience
  address: string                   // denormalized snapshot used for navigation
  status: string                    // PASSENGER LIFECYCLE (see §5)
  pickedUpAt: timestamp | null
  droppedOffAt: timestamp | null
  updatedAt: timestamp
  updatedBy: string                 // driver uid that wrote the change (audit)
```

### 3.5 `statusEvents/{eventId}` — append-only event log (future-consumer fan-out, req. 6/7/8)

An immutable log of status transitions. The future SMS Cloud Function (P2-7) triggers on inserts here; caregiver/family portals can read a passenger's recent events. Writing this event in the same client action as the stop update keeps "write once, reflected everywhere" true for *all* consumers, not just the dispatcher.

```
statusEvents/{eventId}
  passengerId: string
  tripId: string
  stopId: string
  type: string                      // "picked_up" | "dropped_off" | "en_route" | "no_show" | ...
  at: timestamp
  routeName: string
  actorId: string                   // driver uid
```

> Design choice: keep the event log a **separate top-level collection** (not nested under the trip) so a future Cloud Function can use a simple collection-group-free trigger and so portals can query "all events for passenger X" cheaply. If Builder prefers a `collectionGroup` query on a nested events list, that is acceptable provided the SMS trigger and portal read paths remain single-source.

## 4. Collection Structure (summary)

```
passengers/{passengerId}                 # identity SSOT  (dispatcher-managed)
routes/{routeId}                         # plan SSOT      (dispatcher-managed)
trips/{tripId}                           # live execution (driver-owned)   [EXISTING + routeId]
trips/{tripId}/stops/{stopId}            # live passenger status (driver-owned, all-read)   [NEW]
trips/{tripId}/points/...  →  locations/{tripId}/points/{pointId}   # GPS  [EXISTING, UNCHANGED]
statusEvents/{eventId}                   # append-only fan-out for SMS/portals   [NEW]
admins/{uid}                             # isAdmin() allowlist   [EXISTING per P0-3]
```

Read/subscribe map by consumer:
- **Driver:** reads `routes/{id}` + joined `passengers/*` to render the plan; writes `trips/{id}`, `trips/{id}/stops/*`, `statusEvents/*`, `locations/{id}/points`.
- **Dispatcher (now):** subscribes `trips where status==active` (existing) **and** `trips/{id}/stops` (new) → live passenger status. Reads `passengers/*`, `routes/*` for context.
- **SMS function (P2-7):** triggers on `statusEvents` inserts; reads `passengers/{id}.contacts` for numbers + opt-in.
- **Caregiver/Family portals (P4):** read-only on a passenger's current `trips/{id}/stops` entry + recent `statusEvents`; never write.

## 5. Passenger Lifecycle States

Canonical vocabulary, reconciling the documented model (`architecture.md`: Waiting → Picked Up → Onboard → Dropped Off) with the driver workflow. **Stored values are snake_case strings** in `trips/{tripId}/stops/{stopId}.status`.

| State | Meaning | Set by | Maps to architecture.md |
|---|---|---|---|
| `scheduled` | Planned, not yet started | seeded at trip start | Waiting |
| `en_route` | Driver navigating to this pickup | driver (phase change / nav launch) | Waiting |
| `arrived` | Geofence fired at pickup (150 m) | driver app (geofence) | Waiting |
| `onboard` | **Pickup confirmed** — passenger in vehicle | driver `handlePickup` | Picked Up / Onboard |
| `dropped_off` | **Dropoff confirmed** | driver `handleDropoff` | Dropped Off |
| `no_show` | Passenger not present at pickup | driver (`handleNotArrived` → explicit no-show) | (exception) |
| `cancelled` | Stop cancelled (dispatcher) | dispatcher | (exception) |

Allowed transitions:

```
scheduled → en_route → arrived → onboard → dropped_off
scheduled/en_route/arrived → no_show
scheduled → cancelled
```

Requirement mapping: **req. 3 (pickup)** = transition to `onboard` (sets `pickedUpAt`); **req. 4 (dropoff)** = transition to `dropped_off` (sets `droppedOffAt`). Each transition also appends a `statusEvents` record (req. 8).

## 6. Route / Trip Lifecycle States

Two related lifecycles. The **route** (plan) and the **trip** (execution instance) share the documented vocabulary from `architecture.md`. Stored as snake_case strings.

Route (`routes/{routeId}.status`):

| State | Meaning |
|---|---|
| `scheduled` | Created, not yet assigned |
| `assigned` | Driver (and vehicle) assigned |
| `active` | A trip for this route is in progress |
| `completed` | All stops dropped off |
| `cancelled` | Called off before/while running |

Trip (`trips/{tripId}.status`) — **keeps the existing `active`/`completed` values to avoid migration**, extended to the full set:

```
scheduled → assigned → active → completed
        ↘ cancelled (from any pre-completed state)
```

Today the app only writes `active` and `completed`; P1-6 keeps those literal values valid and simply *documents* the wider set. Drivers move a trip to `active` on start (existing) and `completed` on last dropoff (existing, P0-1). Dispatcher may set `scheduled/assigned/cancelled`. This satisfies req. 10 (no breaking change to current writes).

## 7. Data Ownership

Aligns with the P0-3 `firestore.rules` ownership model; rules must be extended (not loosened):

| Collection | Create / Update | Read |
|---|---|---|
| `passengers/*` | Dispatcher/admin only (`isAdmin()`) | Authenticated app users; future portals read only the single passenger they're scoped to (token/link-based, P4) |
| `routes/*` | Dispatcher/admin only | Authenticated; driver reads their assigned route |
| `trips/{id}` | Owning driver (`driverId == auth.uid`) — **existing rule** | Owning driver + `isAdmin()` |
| `trips/{id}/stops/*` | Owning driver of the parent trip (resolve via `get(trips/{id}).driverId == auth.uid`) | Owning driver + `isAdmin()` (+ future portal scoped read) |
| `locations/{id}/points/*` | Owning driver — **existing rule, unchanged** | `isAdmin()` (+ owning driver) |
| `statusEvents/*` | Owning driver (create only; **no update/delete** — append-only) | `isAdmin()`; future SMS function (admin context); future portals scoped |
| `admins/{uid}` | Out-of-band/console — **existing** | Authenticated |

Principle: **status is written by exactly one role at one place** — the driver, into the trip's stop — and everyone else only reads. That is the literal enforcement of DEC-004 ("written once, reflected everywhere").

## 8. Component Changes

No business logic is specified as code here; this lists the required edits and their contracts.

**New: `src/data/` shared layer (the single source in code).**
- `passengersRepo` / `routesRepo`: read `passengers/*`, `routes/*`; join helpers (`getRouteWithPassengers(routeId)`).
- `tripService`: `startTripFromRoute(routeId)` → creates `trips/{tripId}` (existing fields + `routeId`), seeds `trips/{tripId}/stops/*` from `routes/{routeId}.stops` at `scheduled`; `setStopStatus(tripId, stopId, status)` → updates the stop, sets timestamps, **and** appends a `statusEvents` record in the same logical action.
- Replaces all three inline literals. After this, `DriverHome`, `ActiveRoute`, and `AdminMap` import passenger/route data from here — **the three literals are deleted** (DEC-004).

**`src/driver/DriverHome.jsx`**
- Remove inline `passengers` (~L23) and hardcoded "Route Matin A".
- Load the driver's assigned route via `routesRepo` (joined passengers) for the roster summary.

**`src/driver/ActiveRoute.jsx`**
- Remove module-level `const passengers` (~L10) and hardcoded `routeName` (~L87); derive both from the active route/trip.
- `handlePickup` → call `tripService.setStopStatus(tripId, currentStopId, 'onboard')` (req. 3).
- `handleDropoff` → call `setStopStatus(…, 'dropped_off')` (req. 4) **before/around** the existing trip-completion write; keep the P0-1 `async`/`try-catch` shape.
- **GPS code (~L73–L96) is untouched** (req. 10). Navigation/geocoding now reads the stop's denormalized `address`.
- Geofence `arrived` may optionally write `status:'arrived'` (nice-to-have; not required for AC).

**`src/admin/AdminMap.jsx`**
- Remove `const PASSENGERS` (~L50) and the hardcoded `route` strings; keep `MOCK_DRIVERS`/`SMS_LOG`/`HISTORY` **only if** clearly labeled sample (DEC-003 honesty) — but the **Passagers tab must render live `trips/{id}/stops`**, not the literal.
- Add a second subscription: for each active trip from the existing `onSnapshot`, subscribe `onSnapshot(collection(db,'trips/{tripId}/stops'))` and render live passenger status (req. 5). The existing active-trips subscription (~L306) stays.
- Preserve the `isReal` honesty pattern: live stops are real; any remaining mock fillers are visibly marked sample.

**`firestore.rules` (extend P0-3)**
- Add `match /passengers/{id}`, `/routes/{id}`, `/trips/{tripId}/stops/{stopId}`, `/statusEvents/{id}` per §7. Reuse `isSignedIn()` / `isAdmin()` and the `get(trips/{tripId}).driverId == request.auth.uid` ownership check already used for points.

**Seed (demo data, DEC-003):** a one-time seed of `passengers/*` and one `routes/*` ("Route Matin A", Granby) from the current literals so the demo shows consistent, real, single-sourced data.

## 9. Migration Plan (req. 9 — minimize complexity)

Additive and reversible; no destructive reshape of the working pipeline.

1. **Rules first (extend, deploy with P0-3).** Add the new collection rules; deploy alongside the pending P0-3 deploy so new writes are protected from day one.
2. **Seed identity data.** Script-create `passengers/*` (from the union of the three literals — reconciling "Lise Paré" and address differences into canonical records) and one `routes/{routeId}` "Route Matin A" referencing those passenger ids. One-time, idempotent (keyed by stable ids).
3. **Add the shared `src/data` layer** and point `DriverHome`/`ActiveRoute` reads at it — **without** changing GPS writes. Verify the driver flow still renders.
4. **Wire driver writes.** `handlePickup`/`handleDropoff` call `setStopStatus`; trip start seeds `trips/{id}/stops`. Existing `trips`/`locations` writes unchanged.
5. **Wire dispatcher reads.** Add the `stops` subscription to `AdminMap`; Passagers tab now reflects live status. Remove `PASSENGERS` literal.
6. **Delete the three literals** once all three components read from the shared layer (DEC-004 closeout).
7. **Future-consumer seams left in place** (`statusEvents`, `contacts`, `consent`) but unused until P2-7/P4 — no portal/SMS code in this task.

Because the existing `trips` doc only gains fields and the GPS path is untouched, there is **no data migration of live trips** and no downtime; old trips remain readable.

## 10. Risks

- **Breaking the working GPS pipeline (highest).** The driver→dispatcher location flow is the best asset (current-state §1). Mitigation: GPS write block (`ActiveRoute.jsx` ~L73–96) and the `locations/{id}/points` path are explicitly out of scope to modify; verify markers still move after each change.
- **Rules too strict → silent write failures.** Like the GPS writer, stop/status writes can fail quietly (only `console.error`). A wrong `get(trips/{id})` ownership rule could block pickups. Mitigation: emulator unit tests for stop/event writes before deploy; surface write errors in UI.
- **Extra `onSnapshot` per active trip → cost/perf.** Subscribing to each trip's `stops` multiplies listeners. Acceptable at demo scale (a handful of trips); flag for batching/`collectionGroup` if routes scale. Must unsubscribe on trip completion to avoid leaks.
- **Denormalization drift.** `passengerName`/`address` are copied into stops for display/offline. If a passenger is renamed mid-trip, the stop snapshot is stale. Acceptable (a trip is a point-in-time execution); identity edits apply to future trips. Document this intent.
- **Status vocabulary mismatch during rollout.** Until all three literals are removed, mixed vocab could appear. Mitigation: ship the shared layer + dispatcher read in the same change set; do not leave a half-migrated state across a demo.
- **Workspace write truncation (current-state §9).** Builder must write new files via shell heredoc and re-verify byte size — the same hazard that truncated `ActiveRoute.jsx`/`firebase.json`.
- **Privacy/consent (current-state §5).** `contacts`/`consent` now exist in schema; they must not be surfaced or texted until a consent policy is set (gates P2-7/P4, not P1-6).

## 11. Acceptance Criteria

1. **One source for passengers.** Passenger identity exists only in `passengers/*`; the inline literals in `DriverHome.jsx`, `ActiveRoute.jsx`, and `AdminMap.jsx` are removed (req. 1, DEC-004).
2. **One source for routes.** Route plans exist only in `routes/*`; no hardcoded `'Route Matin A'` remains in components (req. 2).
3. **Pickup updates status.** Driver "embarqué/pickup" writes `status:'onboard'` + `pickedUpAt` to `trips/{tripId}/stops/{stopId}` and appends a `statusEvents` `picked_up` record (req. 3).
4. **Dropoff updates status.** Driver dropoff writes `status:'dropped_off'` + `droppedOffAt` and appends a `dropped_off` event; last dropoff still completes the trip (P0-1 path intact) (req. 4).
5. **Dispatcher live.** Without reload, the dispatcher Passagers view reflects the new status within ~1–2 s of the driver action, via `onSnapshot` (req. 5).
6. **GPS preserved.** Driver GPS still streams and the dispatcher map markers still move exactly as before; `locations/{id}/points` and `trips.currentLocation` writes are unchanged (req. 10).
7. **Future-consumer ready.** `statusEvents` records are written on every transition and carry enough to fire an SMS (passengerId, type, at) and to power a portal read — with no portal/SMS code shipped (req. 6/7/8).
8. **Secured.** New collections enforce the §7 ownership model in `firestore.rules`; a non-owner driver cannot write another driver's stop; non-admins cannot read the roster beyond their scope.
9. **Honest demo (DEC-003).** Passenger statuses shown to the dispatcher are real (driver-driven); any remaining mock fillers are visibly labeled sample.
10. **Migration is additive.** No reshaping of existing `trips`/`locations` documents; old trips remain readable; build stays green.

## 12. Test Plan

**Rules unit tests (emulator, extend `tests/firestore.rules.test.mjs`):**
- Driver A creates `trips/tripA/stops/s1` (A owns tripA) → allowed; Driver B writes it → denied.
- `statusEvents` create allowed for owning driver; update/delete denied (append-only).
- `passengers/*` and `routes/*` writes denied for non-admin; reads behave per §7.
- Admin reads `trips/*/stops/*` → allowed.

**Integration / manual (driver → dispatcher, two sessions):**
- Open driver on one device/session and dispatcher on another. Start the route → `trips/{id}/stops` seeded at `scheduled`.
- Confirm pickup → dispatcher Passagers row flips to "À bord/Onboard" within ~1–2 s **without reload**; Firestore shows `onboard` + `pickedUpAt` + a `picked_up` event.
- Confirm dropoff → row flips to "Déposé/Dropped Off"; last dropoff shows the "Trajet complété" screen and `trips/{id}.status==completed`.
- Throughout, confirm the **GPS marker keeps moving** (regression guard for req. 10).
- `no_show` path: mark not-arrived/no-show → status `no_show` + event; dispatcher reflects it.

**Data-integrity checks:**
- Grep the repo: zero remaining inline passenger/route literals in the three components (AC 1/2).
- Renaming a passenger in `passengers/*` does not retroactively alter a completed trip's stop snapshot (documents denormalization intent).

**Build/CI:**
- `npm run build` exits 0 on case-sensitive Linux; `npm run lint` no new findings.

**Suggested automated (aligns roadmap P3-12; optional now):**
- Unit-test `tripService.setStopStatus` with mocked Firestore: asserts stop update + event append happen together and timestamps are set.

## 13. Rollback Plan

- **Code:** the change is grouped (shared `src/data` layer + the three component edits + rules extension + seed). `git revert` the P1-6 commit(s) restores the prior components. Because reads/writes for status are isolated to the new layer and the new subcollection, reverting cleanly returns to the (working, build-green) Phase 0 state.
- **Data:** the migration is **additive** — new collections (`passengers`, `routes`, `statusEvents`) and a new subcollection (`trips/{id}/stops`). Rolling back the code simply stops reading/writing them; the documents can be left in place (harmless) or deleted by a cleanup script. **No existing `trips`/`locations` document is reshaped, so there is nothing to migrate back** (the whole point of req. 9).
- **Rules:** revert the added `match` blocks; redeploy `firebase deploy --only firestore:rules`. Roll back to the previous committed ruleset version (console version history) if a deploy breaks access.
- **Partial-state caution:** do **not** ship a half-migration into a demo (literals removed but dispatcher read not wired, or vice-versa) — land the shared layer, driver writes, and dispatcher reads together, or revert as a unit.
- **GPS safety net:** since the GPS pipeline is untouched, even a full P1-6 rollback leaves the existing live-location demo working.

<!-- END OF SPEC P1-6 -->
