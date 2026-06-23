# Current State

**Maintained by:** Product Owner agent · **Last updated:** 2026-06-23 (Phase 0 + P1-6 Phases A & B; score 68/100)
**Method:** Regenerated from `docs/audit-2026-06-23.md`, `tasks/completed.md`, `docs/roadmap.md`, and Reviewer findings. See `tasks/completed.md` for delivered items and `tasks/backlog.md` (currently empty) for queued work.

VOYO (repo `adaptiride`, UI brand `movigo`) is an early-stage transportation-visibility platform for adapted/paratransit operators in Granby, Québec. A real driver -> Firestore -> dispatcher GPS pipeline works today; most of the surrounding dashboard is still mock data. **As of 2026-06-23 the app builds green** on a clean, case-sensitive environment (Phase 0: P0-1, P0-2 complete), and Firestore security rules are authored and committed, **pending deployment** (P0-3).

---

## 1. Completed Features

Implemented and functional in source.

* **Firebase email/password authentication** — French UI; routes to admin vs. driver by email (`Login.jsx`).
* **Driver live GPS tracking** — `watchPosition`, accuracy filtering, adaptive write throttling (60s stationary / 15s moving), screen wake-lock; writes to `trips/{id}` and `locations/{id}/points` (`ActiveRoute.jsx`).
* **Geofence arrival detection** — Haversine distance, 150 m threshold, vibration + full-screen arrival overlay.
* **Turn-by-turn directions & geocoding** — address -> coordinates, route polyline via Google Maps.
* **Real-time dispatcher map** — subscribes to active trips (`onSnapshot`); plots real GPS markers distinctly from mock drivers via an `isReal` flag (`AdminMap.jsx`).
* **Responsive dispatcher UI** — desktop sidebar / mobile bottom-tab across Map, Drivers, Passengers, SMS, History.
* **Driver route workflow** — home -> start route -> stop-by-stop pickup/dropoff -> progress bar -> completion screen.

## 2. Partially Completed Features

Visible and partly wired, but incomplete or not connected end to end.

* **Trip lifecycle** — `active` and `completed` write to Firestore; completion path now compiles and runs (P0-1). Route name is still hardcoded; documented states Scheduled/Assigned/Cancelled are absent.
* **Passenger management** — passengers render in three places but are inlined, inconsistent, and not a shared source; driver actions do not update dispatcher-visible status.
* **Activity feed / delay management** — rendered from static arrays; no real detection.
* **Historical reporting** — hardcoded rows only.

## 3. Mocked Functionality

Looks real in the UI; backed by hardcoded data only.

* **SMS / family notifications** — entire subsystem mocked (log, "47 sent / 100% delivered", delay texts). No provider integrated. *This is a documented core pillar (Communication).*
* **Dispatcher drivers** — `MOCK_DRIVERS` (4 fixed drivers/positions).
* **Passenger statuses & SMS counts** — hardcoded in `AdminMap.jsx`.
* **Activity feed** — `MOCK_ACTIVITY`.
* **Trip history** — `HISTORY`.
* **Driver home route summary** — "4 passengers, 08h15 départ" static.

## 4. Technical Risks

* **~~BUILD-BLOCKER~~ — async/await mismatch:** ✅ **RESOLVED 2026-06-23 (P0-1).** `handleDropoff` is now `async` with `try/catch` on the completion write. A second, undocumented build-blocker was found and fixed in the same file: `ActiveRoute.jsx` was truncated mid-JSX (navigation button + closing tags missing); the tail was recovered from the compiled `dist/` bundle.
* **~~BUILD-BLOCKER~~ — case-mismatched imports:** ✅ **RESOLVED 2026-06-23 (P0-2).** Route components renamed to PascalCase (`Login`/`DriverHome`/`AdminMap.jsx`); `vite build` verified green on a case-sensitive Linux filesystem.
* **No single source of truth for data** — passengers defined 3x with conflicting fields; cannot demo a second route without code edits. *(Targeted by P1-6.)*
* **GPS accuracy filter too strict** — `if (accuracy > 50) return` silently drops coarse readings; map/geofence can stall indoors/in-vehicle with no feedback. *(Targeted by P2-8.)*
* **No CI smoke build** — both build-blockers would have been caught by a Linux CI build; none is wired up. Committed `dist/` is stale and must not be treated as source of truth.
* **Pre-existing lint findings** — `react-hooks` errors in original `ActiveRoute.jsx` (lines ~123/137/172) and an unused var in `DriverHome.jsx`; not introduced by Phase 0 work, became visible once the file parses.
* **Bleeding-edge dependencies** — React 19 / Vite 8 / ESLint 10 / router 7; install + build confirmed working in a clean Linux env on 2026-06-23.
* **Inline styles everywhere** — Tailwind configured but unused; blocks design-system and accessibility work.

## 5. Security Risks

* **~~No Firestore security rules in repo~~** — ✅ **AUTHORED 2026-06-23 (P0-3), pending deployment.** `firestore.rules` committed (deny-by-default; drivers write only their own trips/points; admin reads via `isAdmin()`), wired into `firebase.json`, with a unit-test suite in `tests/`. **Not yet enforced live** — needs `firebase deploy --only firestore:rules` to `movigo-adee1` plus an admin identity provisioned. Until deployed, console-only rules remain the live posture.
* **Secrets committed** — Maps key in `ActiveRoute.jsx`, `AdminMap.jsx`, and `Google API'S.txt`; Firebase config in `firebase.js`; Maps key unrestricted. *Open — targeted by P1-4.* Action: env vars, restrict key, remove txt file, rotate.
* **Routes not auth-guarded** — `/driver/route` and `/admin` render with no auth check; admin role decided once at login by hardcoded email and never enforced, so any authenticated user can open `/admin`. *Open — targeted by P1-5.*
* **Privacy/consent unaddressed** — passenger location + (future) SMS involve vulnerable riders; no consent, retention, or opt-out policy.

## 6. Missing Demo Features

Gaps that would weaken or break the intended Amibus demo.

* **~~A working build~~** — ✅ resolved (Phase 0). `vite build` exits 0 on a clean case-sensitive environment.
* **One real SMS** — headline buyer value ("reduce phone calls") is faked; a single live message makes the Communication pillar real. *(P2-7.)*
* **Live driver -> dispatcher status** — pickup/dropoff should visibly change passenger status on the dashboard; today the two sides do not talk. *(P1-6 — highest-ROI next item.)*
* **Believable seeded demo data** — consistent passengers/drivers/routes from one source. *(P1-6.)*
* **Clear "sample data" labeling** — extend the `isReal` idea so nothing silently implies live when it is not.
* **Caregiver/Family view** — named as primary users in docs, but no portal exists (acceptable to defer; it is the differentiator).
* **Contrast/readability pass** — low-opacity text borderline for in-vehicle, sunlit driver use.

## 7. Demo Readiness Score

**68 / 100** (was 38 pre–Phase 0, 64 post–Phase 0; recalculated 2026-06-23 after P1-6 Phases A & B). Mirrors `metrics/demo-readiness.md`.

| Dimension | Weight | Before | Now | Notes |
|---|---:|---:|---:|---|
| Builds & runs | 25 | 3 | 23 | Both build-blockers fixed + truncation recovered; `vite build` verified exit 0 on case-sensitive Linux. Remaining: no CI smoke build; stale `dist/`. |
| Core flow end-to-end | 20 | 11 | 14 | Completion path now compiles and runs (done screen restored). Driver -> dispatcher live status linkage (P1-6 Phases C–E) still missing. |
| Data realism / honesty | 15 | 5 | 9 | **+4 (P1-6 A & B):** single-source-of-truth data layer (`src/data/*`), demo seed, and status-workflow rules authored. Foundation only — unimported by the UI, which still renders literals; the rest unlocks at Phases C–F. |
| Communication pillar (SMS) | 15 | 1 | 1 | Unchanged — entirely mocked. |
| Security & privacy | 15 | 4 | 7 | Rules authored, committed, test-ready (+) but not yet deployed/enforced; secrets still exposed, routes still unguarded, no consent model. |
| Polish / UX | 10 | 14* | 14* | Unchanged — driver UX strong; contrast/consistency still pending. |

\*Driver UX exceeds baseline (additive scoring). **Total = 23+14+9+1+7+14 = 68/100.**

*+4 cap rationale: P1-6 Phases A & B changed no user-visible behaviour (data layer unimported, UI still on literals); the increment reflects architectural readiness, not delivered demo function.*

**Reading:** Phase 0 cleared the two build-blockers (and a third, latent file truncation) and put real security rules in the repo — moving from a non-building app to one that compiles and runs green. The remaining gap to a credible, honest **80** is concentrated in three demo-critical dimensions: a real driver -> dispatcher status link (P1-6), deploying the rules + closing the secret/route exposures (P0-3 deploy, P1-4, P1-5), and at least one real SMS (P2-7).

## 8. Remaining Work (P1 / P2)

**P1 — make the demo honest and safe (next):**
* **P1-6 (highest ROI) — single source of truth for passengers/routes + live driver -> dispatcher status.** Phases A & B (data layer + rules) are done (+4 → Data realism 9); Phases C–F wire it to the UI. Lifts two of the lowest-scoring, most demo-visible dimensions (Core flow 14->~19, Data realism 9->~13) toward 80. Delivers the demo money-shot ("driver confirms pickup -> dispatcher sees status change live") and is the prerequisite for the SMS pillar (a real status event is what a notification fires on).
* **P1-4 — secrets/keys.** Move secrets to env vars, restrict the Maps key by referrer + API, remove `Google API'S.txt`, rotate the key. Cheap, non-visible, but a must-do before any public/hosted demo.
* **P1-5 — auth guards + enforced role check.** Shared route guard on `/driver/route` and `/admin`; enforce admin role server-side (pairs with the `isAdmin()` model in the new rules).

**P2 — deliver a core pillar:**
* **P2-7 — real SMS** on pickup/dropoff via a provider (Twilio or equivalent) behind a Cloud Function; even one live message makes the Communication pillar real. Single highest-value feature for closing Amibus; depends on P1-6.
* **P2-8 — GPS weak-signal handling.** Loosen/fallback the `accuracy > 50` filter and surface a "GPS weak" state.

**Immediate operational follow-ups (not feature work):**
* Deploy P0-3 rules + run `tests/firestore.rules.test.mjs` against the emulator (needs Firebase credentials).
* Wire a Linux CI smoke build (`npm ci && npm run build`) to prevent build-blocker regressions.

## 9. Known Workspace Truncation Risk

**The workspace mount intermittently truncates writes made through the file-editing tools**, silently capping a file mid-token (no error returned). Confirmed instances on 2026-06-23:

* `src/driver/ActiveRoute.jsx` — truncated mid-JSX (~line 449); recovered from the `dist/` bundle.
* `firebase.json` — truncated to 233 bytes mid-token (`"rewrite`), producing invalid JSON; restored.
* `tasks/completed.md` — corrupted on append; rewritten atomically.
* `docs/current-state.md` — truncated to 691 bytes mid-sentence; this file is the regenerated replacement.

**Mitigation in use:** write/restore affected files via the shell (heredoc) rather than the file-editing tools, then verify on disk (byte size, terminating newline, presence of the final section). **Recommended:** after any edit to a tracked file, re-open and confirm it is not truncated; keep a Linux CI build as a backstop. Root cause appears to be the mount layer, not the file contents.

---

## Current Goal

Prepare a professional, **honest** demo for adapted-transport operators such as Amibus — everything shown is real or clearly labeled as sample. Phase 0 (build + rules authored) is complete; next is P1-6 plus the rules deploy and key hardening.

## Demo Objective

Demonstrate: (1) driver application, (2) dispatcher dashboard, (3) live vehicle tracking, (4) transportation visibility, (5) communication workflow — with the communication step backed by at least one real notification.

<!-- END OF FILE -->
