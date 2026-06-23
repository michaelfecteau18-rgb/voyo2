# Spec P0-1 — Fix `await` in non-async `handleDropoff()`

**ID:** P0-1
**Phase:** Phase 0 — Make it build
**Author:** VOYO Architect agent
**Date:** 2026-06-23
**Status:** Draft — ready for Builder
**Source findings:** `docs/audit-2026-06-23.md` §4.1; `docs/roadmap.md` Phase 0
**Estimated effort:** ~15 minutes implementation, plus test
**Implementation note:** This is a specification only. No production code is written here. The Builder agent implements against the Technical Approach and Acceptance Criteria below.

---

## 1. Problem

`src/driver/ActiveRoute.jsx` declares `handleDropoff()` as a **synchronous** function but uses `await` inside it. This is a syntax error: `await` is only valid inside an `async` function (or top-level module scope). It causes a **parse-time failure**, which means:

- `vite build` fails — no production bundle can be produced.
- `vite` dev server fails to compile the module on load.
- The existing `dist/` was built before this defect and masks the failure; any clean rebuild breaks.

Worst of all, the broken `await` sits on the **trip-completion path** — the moment the driver drops off the last passenger and the trip is marked `completed` in Firestore. This is the climax of the driver demo, so the most important user moment is exactly the one that does not compile.

## 2. Root Cause

The function is declared without the `async` keyword:

```jsx
// src/driver/ActiveRoute.jsx  (~line 198)
function handleDropoff() {
  setArrived(false)
  arrivalTriggered.current = false
  setDirections(null)

  if (currentIndex + 1 >= passengers.length) {
    await setDoc(doc(db, 'trips', tripId), {   // <-- line ~204: await in non-async fn
      status: 'completed',
      completedAt: serverTimestamp()
    }, { merge: true })
    setDone(true)
  } else {
    setCurrentIndex(currentIndex + 1)
    setPhase('pickup')
    launchNavigation(passengers[currentIndex + 1].address)
  }
}
```

The adjacent GPS-write code (line ~73) correctly uses `async (position) => { ... await setDoc(...) }`, so the pattern was understood elsewhere — `handleDropoff` was simply never marked `async` when the `setDoc` call was added. The author also did not handle the promise rejection path, unlike the GPS writer which wraps its writes in `try/catch`.

## 3. Files Affected

| File | Change |
|---|---|
| `src/driver/ActiveRoute.jsx` | Make `handleDropoff` async; add error handling around the completion write. (Primary, required.) |

No other files import or depend on the signature of `handleDropoff` — it is a local event handler wired to the dropoff button only. No call site changes are required. No Firestore schema change. No config change.

## 4. Technical Approach

1. **Make the function async.** Change the declaration `function handleDropoff()` to `async function handleDropoff()`. This is the minimal fix that resolves the parse error.

2. **Wrap the completion write in `try/catch`** for parity with the GPS write path (line ~83–96), so a Firestore failure on the final dropoff does not throw an unhandled promise rejection and the driver still gets feedback. On error, log it (`console.error`) and still allow the UI to proceed to the done state, or surface a non-blocking retry — Builder's choice, but it must not silently swallow a failure that leaves the trip stuck in `active`.

3. **Order of state updates.** Keep `setDone(true)` after the awaited write resolves so the success screen reflects a persisted completion. The synchronous state resets at the top of the function (`setArrived`, `arrivalTriggered`, `setDirections`) should remain before the `await` so the UI responds immediately on tap.

4. **No behavioral change to the non-final branch** (advancing to the next passenger). That branch contains no `await` and must keep working exactly as today.

Reference shape (illustrative, not prescriptive — Builder owns final code):

```jsx
async function handleDropoff() {
  setArrived(false)
  arrivalTriggered.current = false
  setDirections(null)

  if (currentIndex + 1 >= passengers.length) {
    try {
      await setDoc(doc(db, 'trips', tripId), {
        status: 'completed',
        completedAt: serverTimestamp()
      }, { merge: true })
    } catch (err) {
      console.error('Trip completion write failed:', err)
      // surface non-blocking error / allow retry; do not leave trip silently 'active'
    }
    setDone(true)
  } else {
    setCurrentIndex(currentIndex + 1)
    setPhase('pickup')
    launchNavigation(passengers[currentIndex + 1].address)
  }
}
```

## 5. Risks

- **Low risk overall** — this is a one-keyword correctness fix plus defensive error handling.
- **Interaction with P0-3 (Firestore rules):** once security rules are deployed, the completion `setDoc` could be **rejected** if the rules do not permit the authenticated driver to update their own trip. The `try/catch` added here is what makes that failure visible rather than a silent unhandled rejection. P0-1 and P0-3 should be tested together once both land.
- **Double-tap / race:** if the driver double-taps the dropoff button, two completion writes could fire. Low impact (idempotent `merge` write to the same doc), but Builder may debounce the button. Not required for this spec.
- **`tripId` undefined:** if `handleDropoff` is reachable when `tripId` has not been set (e.g., trip never started), `doc(db,'trips', undefined)` would throw. Out of scope here, but the `try/catch` contains it.

## 6. Acceptance Criteria

1. `npm run build` (`vite build`) completes with exit code 0 on a clean checkout. (Combined with P0-2 for a fully green build.)
2. `npm run dev` starts and `ActiveRoute.jsx` compiles without a parse error.
3. `npm run lint` reports no new errors introduced by the change.
4. Completing the **last** passenger dropoff writes `{ status: 'completed', completedAt: <timestamp> }` to `trips/{tripId}` (merge) and then shows the "Trajet complété!" done screen.
5. Completing a **non-last** dropoff advances `currentIndex`, returns to the `pickup` phase, and launches navigation to the next passenger — unchanged from current behavior.
6. A Firestore write failure on the final dropoff is caught and logged, not thrown as an unhandled rejection.

## 7. Test Plan

**Static / build**
- Run `npm run build` and confirm exit 0 (this defect currently fails it).
- Run `npm run lint` and confirm no new findings.

**Manual (driver flow, against a dev Firestore)**
- Start a route, advance through all passengers, drop off the last one → verify done screen appears and the `trips/{tripId}` doc shows `status: completed` with a `completedAt` timestamp in the Firestore console.
- Drop off a middle passenger → verify advance-to-next behavior (phase returns to pickup, next navigation launches).
- Simulate write failure (e.g., temporarily deny the trip update in rules, or go offline) → verify the error is logged and the app does not crash with an unhandled rejection.

**Suggested automated (aligns with roadmap P3-12 test baseline; optional now)**
- Unit test `handleDropoff` with a mocked `setDoc`: assert it is awaited, assert `setDone(true)` runs after resolution on the last-passenger branch, assert the next-passenger branch does not call `setDoc`.

## 8. Rollback Plan

- The change is isolated to one function in one file. To roll back, revert the single commit touching `src/driver/ActiveRoute.jsx`.
- **Caveat:** rolling back restores the build-blocking parse error, so rollback is only safe in combination with reverting any dependent work. There is no data migration and no Firestore schema change, so no data rollback is needed.
- Because the prebuilt `dist/` masks the defect, do **not** rely on the existing `dist/` as a rollback target — it represents pre-defect code and would diverge from current source.
