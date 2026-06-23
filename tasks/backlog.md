# VOYO Backlog — Authoritative Roadmap

**Maintained by:** Product Owner agent · **Last updated:** 2026-06-23 (post–Phase 0)
**Sources:** `docs/audit-2026-06-23.md`, `docs/current-state.md`, `tasks/completed.md`
**Status of build:** Green on a clean case-sensitive environment. **Demo readiness: 64 / 100** (`current-state.md §7`).
**This file is the single source of truth for what VOYO works on next.** When an item starts, move its status to *In Progress* (and mirror in `tasks/in-progress.md`); when delivered, set *Complete* and log it in `tasks/completed.md`.

**Status legend:** `Not Started` · `In Progress` · `Complete`
**Priority order:** the global `#` column is the recommended execution sequence. Lower number = do sooner. Dependencies override raw priority (a blocked item waits).

---

## Priority Order (master sequence)

| # | ID | Item | Phase | Status | Blocked by |
|--:|----|------|-------|--------|-----------|
| — | P0-1 | Fix async `handleDropoff` | 0 | ✅ Complete | — |
| — | P0-2 | Fix case-mismatched imports | 0 | ✅ Complete | — |
| — | P0-3 | Firestore security rules (authored) | 0 | ✅ Complete (pending deploy → OPS-1) | — |
| 1 | OPS-1 | Deploy Firestore rules + provision admin identity | 0→1 | Not Started | P0-3, user Firebase creds |
| 2 | OPS-2 | Linux CI smoke build | 1 | Not Started | — |
| 3 | P1-6 | Single source of truth + live driver→dispatcher status | 1 | Not Started | Phase 0 (done) |
| 4 | P1-4 | Secrets to env + restrict/rotate Maps key | 1 | Not Started | — |
| 5 | P1-5 | Route auth guards + enforced roles | 1 | Not Started | OPS-1 (for `isAdmin()` enforcement) |
| 6 | P2-7 | Real SMS notifications (Communication pillar) | 2 | Not Started | P1-6 |
| 7 | P2-8 | GPS weak-signal handling | 2 | Not Started | — |
| 8 | P3-9 | Caregiver / Family status portal | 3 | Not Started | P1-6, P2-7 |
| 9 | P3-10 | Trip & vehicle data models; multi-route ops | 3 | Not Started | P1-6 |
| 10 | P3-11 | Tailwind/design-system + accessibility pass | 3 | Not Started | — |
| 11 | P3-12 | Test baseline + coverage | 3 | Not Started | OPS-2 (shares CI) |
| 12 | P3-13 | Future verticals: booking, route opt, AI scheduling, predictive ETA | 3+ | Not Started | P3-10; validated pilot demand |

---

## Phase 0 — Build-blockers & data security ✅ COMPLETE
*Detail in `tasks/completed.md`. Listed here for traceability; one operational follow-up remains (OPS-1).*

- **P0-1 · Fix async/await in trip completion** — ✅ Complete. `handleDropoff` is `async` with `try/catch`; latent JSX truncation also recovered. `vite build` exits 0.
- **P0-2 · Fix case-mismatched imports** — ✅ Complete. Route components renamed to PascalCase; build verified green on case-sensitive Linux.
- **P0-3 · Firestore security rules** — ✅ Complete (authored/committed/test-ready), **pending live deploy** → tracked as **OPS-1**.

---

## Operational (must precede / accompany P1)

### OPS-1 · Deploy Firestore rules + provision admin identity — Priority #1
- **Status:** Not Started
- **Depends on:** P0-3 (done), user's Firebase credentials for project `movigo-adee1`
- **Why now:** Rules exist in the repo but are **not enforced live**; until deployed, the database posture is whatever the console currently holds. This is the last Phase-0 security point and a prerequisite for P1-5's server-side role check.
- **Acceptance:** `tests/firestore.rules.test.mjs` passes against the emulator; `firebase deploy --only firestore:rules` succeeds; an `admins/{uid}` doc or `admin:true` custom claim exists for the dispatcher account; dispatcher active-trips query returns data (not permission-denied).
- **Spec:** `specs/P0-3-firestore-security-rules.md` (deploy section)

### OPS-2 · Linux CI smoke build — Priority #2
- **Status:** Not Started
- **Depends on:** —
- **Why now:** Both Phase-0 build-blockers would have been caught automatically. Prevents regressions; cheap.
- **Acceptance:** CI runs `npm ci && npm run build` on a case-sensitive Linux runner on every push; red build blocks merge. Committed `dist/` is explicitly not treated as source of truth.
- **Spec:** `specs/ops-ci-smoke-build.md`

---

## P1 — Honest & safe demo (next up)

### P1-6 · Single source of truth for passengers/routes + live driver→dispatcher status — Priority #3  ⭐ highest ROI
- **Status:** Not Started
- **Depends on:** Phase 0 (complete)
- **Blocks:** P2-7, P3-9, P3-10
- **Problem:** Passengers are defined 3× with conflicting fields; driver pickup/dropoff does not update what the dispatcher sees. Two of the lowest-scoring, most demo-visible dimensions.
- **Business value:** Delivers the demo money-shot — "driver confirms pickup → dispatcher sees the status change live" — and is the event a real notification later fires on. Estimated lift: Core flow 14→~19, Data realism 5→~11 (~+11 toward 80).
- **Acceptance:** One passenger/route data source (Firestore-backed or a single shared module consumed by driver + dispatcher); driver pickup/dropoff writes a passenger status the dispatcher dashboard reflects live; a second route can be shown without code edits.
- **Spec:** `specs/passenger-route-model.md`

### P1-4 · Secrets to env + restrict/rotate Maps key — Priority #4
- **Status:** Not Started
- **Depends on:** —
- **Problem:** Maps key hardcoded in `ActiveRoute.jsx`, `AdminMap.jsx`, and `Google API'S.txt`; unrestricted. Firebase config in `firebase.js`.
- **Acceptance:** Keys read from gitignored env; `Google API'S.txt` removed from repo and history-scrubbed if feasible; Maps key restricted by HTTP referrer + API and **rotated**; build still green.
- **Spec:** `specs/secrets-and-key-restriction.md`

### P1-5 · Route auth guards + enforced roles — Priority #5
- **Status:** Not Started
- **Depends on:** OPS-1 (so the `isAdmin()` model is live to enforce against)
- **Problem:** `/driver/route` and `/admin` render with no auth check; admin role decided once at login by hardcoded email and never enforced — any authenticated user can open `/admin`.
- **Acceptance:** Shared route guard redirects unauthenticated users from all protected routes; `/admin` reachable only by admin role, enforced server-side via custom claim/allowlist (consistent with the deployed rules); role source documented.
- **Spec:** `specs/route-guards-and-roles.md`

---

## P2 — Deliver a core pillar

### P2-7 · Real SMS notifications (Communication pillar) — Priority #6  ⭐ closes Amibus
- **Status:** Not Started
- **Depends on:** P1-6 (a real status event is the trigger)
- **Blocks:** P3-9
- **Problem:** Entire SMS subsystem is mocked; it is the headline buyer value ("reduce phone calls").
- **Business value:** Single highest-value feature for closing Amibus — turns a faked screen into a working one. Even one live message proves the pillar.
- **Acceptance:** On pickup and dropoff, a real SMS sends to a configured family number via provider (e.g., Twilio) behind a Cloud Function; delivery status reflected on the dashboard; consent/opt-out handling considered and documented.
- **Spec:** `specs/feature-parent-notifications.md` *(currently empty — fill first)*

### P2-8 · GPS weak-signal handling — Priority #7
- **Status:** Not Started
- **Depends on:** —
- **Problem:** `if (accuracy > 50) return` silently drops coarse readings; map/geofence can stall with no feedback.
- **Acceptance:** Looser fallback threshold or degraded mode; visible "GPS faible" state; geofence still functions at reduced confidence.
- **Spec:** `specs/gps-signal-resilience.md`

---

## P3 — Vision expansion (post-pilot)

### P3-9 · Caregiver / Family status portal — Priority #8
- **Status:** Not Started
- **Depends on:** P1-6, P2-7
- **Problem:** Caregivers and families are named primary users in `docs/`, but no app exists for them. This is the product's differentiator ("peace of mind").
- **Acceptance:** Read-only live status + ETA for a specific passenger via a shareable link; no PII beyond what consent allows; built on the P1-6 data source and P2-7 notification events.
- **Spec:** `specs/family-portal.md`

### P3-10 · Trip & vehicle data models; multi-route operations — Priority #9
- **Status:** Not Started
- **Depends on:** P1-6
- **Problem:** Documented state machines unimplemented; single hardcoded route.
- **Acceptance:** Trip (Scheduled→Assigned→Active→Completed→Cancelled) and Vehicle (Available→Assigned→Active→Offline) models implemented; multiple concurrent routes/drivers supported; route name no longer hardcoded.
- **Spec:** `specs/trip-vehicle-models.md`

### P3-11 · Tailwind/design-system + accessibility pass — Priority #10
- **Status:** Not Started
- **Depends on:** —
- **Problem:** Tailwind configured but unused; 100% inline styles; low-contrast text borderline for in-vehicle, sunlit driver use.
- **Acceptance:** Incremental migration off inline styles; driver screens meet WCAG AA contrast; shared tokens/components established under `src/shared/components`.
- **Spec:** `specs/design-system-adoption.md`

### P3-12 · Test baseline + coverage — Priority #11
- **Status:** Not Started
- **Depends on:** OPS-2 (shares the CI pipeline)
- **Problem:** Zero tests despite Builder/QA agents referencing them.
- **Acceptance:** Unit tests for `getDistanceMeters`, geofence transitions, and the trip lifecycle; Firestore rules tests run in CI; coverage threshold agreed and enforced.
- **Spec:** `specs/testing-baseline.md`

### P3-13 · Future verticals & advanced features — Priority #12
- **Status:** Not Started
- **Depends on:** P3-10; validated pilot demand + pricing-model decision
- **Scope:** Booking requests, route optimization, AI scheduling, predictive ETA; documented future markets (school, medical, senior, municipal transport). Gate each on real demand.
- **Spec:** `specs/future-verticals.md` *(stub)*

---

## Dependency Graph (text)

```
Phase 0 (P0-1, P0-2, P0-3) ── done
        │
        ├─> OPS-1 (deploy rules) ──> P1-5 (enforced roles)
        │
        ├─> OPS-2 (CI) ──> P3-12 (tests)
        │
        └─> P1-6 (data source + live status)  ⭐
                 ├─> P2-7 (real SMS) ⭐ ──> P3-9 (family portal)
                 └─> P3-10 (trip/vehicle models) ──> P3-13 (future verticals)

Independent (no blockers): P1-4 (secrets), P2-8 (GPS), P3-11 (design system)
```

## Path to an honest 80/100
**OPS-1 + P1-6 + P1-4 + P1-5 + P2-7**, in that order. P1-6 lifts Core flow and Data realism; OPS-1/P1-4/P1-5 close the security gaps; P2-7 makes the Communication pillar real. That sequence addresses every dimension currently below target in `current-state.md §7`.

## Questions to validate (PO ↔ Amibus)
* Who makes the most "Where is my ride?" calls — families, residences, or dispatchers? (Sets P2-7 first audience.)
* Pricing model: per vehicle / per active driver / per organization? (Gates P3-10 / P3-13.)
* Consent, opt-out, and data-retention policy for passenger location + SMS? (Required before a real pilot; blocks P3-9 go-live.)

---
<!-- END OF FILE — VOYO authoritative backlog · 2026-06-23 · if this marker is missing the file is truncated -->
