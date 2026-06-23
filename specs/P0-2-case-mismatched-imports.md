# Spec P0-2 — Fix case-mismatched module imports in `App.jsx`

**ID:** P0-2
**Phase:** Phase 0 — Make it build
**Author:** VOYO Architect agent
**Date:** 2026-06-23
**Status:** Draft — ready for Builder
**Source findings:** `docs/audit-2026-06-23.md` §4.2; `docs/roadmap.md` Phase 0
**Estimated effort:** ~20 minutes implementation, plus test
**Implementation note:** Specification only. No production code is written here. The Builder agent implements against the Technical Approach and Acceptance Criteria.

---

## 1. Problem

`src/App.jsx` imports three route components using filenames whose **letter casing does not match the files on disk**. On a case-insensitive filesystem (typical Windows and default macOS dev machines) this resolves fine, so it "works on my machine." On a **case-sensitive filesystem** — which is what Linux CI runners, most container build steps, and many hosting build pipelines use — the imports fail to resolve and `vite build` errors out with "module not found."

This is a latent build-blocker: the app appears healthy locally but cannot be built in CI or any Linux-based deploy step. The existing `dist/` was produced before the mismatch and hides the problem.

## 2. Root Cause

The import specifiers in `src/App.jsx` use PascalCase names, but the actual files are lower/mixed case:

```jsx
// src/App.jsx — current
import Login      from './shared/Login.jsx'       // file is  src/shared/login.jsx
import DriverHome from './driver/DriverHome.jsx'   // file is  src/driver/driverhome.jsx
import ActiveRoute from './driver/ActiveRoute.jsx' // file is  src/driver/ActiveRoute.jsx  ✅ matches
import AdminMap   from './admin/AdminMap.jsx'      // file is  src/admin/adminmap.jsx
```

Verified actual filenames on disk:

| Import specifier in App.jsx | Actual file on disk | Match? |
|---|---|---|
| `./shared/Login.jsx` | `src/shared/login.jsx` | ❌ |
| `./driver/DriverHome.jsx` | `src/driver/driverhome.jsx` | ❌ |
| `./driver/ActiveRoute.jsx` | `src/driver/ActiveRoute.jsx` | ✅ |
| `./admin/AdminMap.jsx` | `src/admin/adminmap.jsx` | ❌ |

The mismatch arose because the files were created with lower/condensed casing while the imports were written with the conventional PascalCase component naming. Only `ActiveRoute.jsx` happens to have been created with matching casing.

## 3. Files Affected

| File | Change |
|---|---|
| `src/App.jsx` | Correct the three import specifiers to match on-disk casing **or** the files are renamed (see Technical Approach for the decision). |
| `src/shared/login.jsx` | Possibly renamed to `Login.jsx` (depending on chosen option). |
| `src/driver/driverhome.jsx` | Possibly renamed to `DriverHome.jsx`. |
| `src/admin/adminmap.jsx` | Possibly renamed to `AdminMap.jsx`. |

No other importers of these three modules exist outside `App.jsx` (they are route-level components). `ActiveRoute.jsx` is imported by `App.jsx` only and already matches.

## 4. Technical Approach

Two valid options. **Option A is recommended** for consistency with React component-file conventions and with the already-correct `ActiveRoute.jsx`.

**Option A (recommended) — Rename files to PascalCase, keep imports as-is.**
Rename on disk so the project consistently uses PascalCase component filenames:
- `src/shared/login.jsx` → `src/shared/Login.jsx`
- `src/driver/driverhome.jsx` → `src/driver/DriverHome.jsx`
- `src/admin/adminmap.jsx` → `src/admin/AdminMap.jsx`

`App.jsx` then needs no edit. **Critical git detail:** on case-insensitive dev machines a plain rename may not be recorded by git. Use `git mv` with a two-step rename if needed (`git mv login.jsx login.tmp.jsx && git mv login.tmp.jsx Login.jsx`) or `git config core.ignorecase false` so the casing change is actually committed. If the rename is not committed correctly, CI will still see the old lowercase name and the build will still fail — this is the single biggest execution risk of Option A.

**Option B — Fix the imports to match current filenames.**
Leave files as-is and change `src/App.jsx`:
```jsx
import Login      from './shared/login.jsx'
import DriverHome from './driver/driverhome.jsx'
import AdminMap   from './admin/adminmap.jsx'
```
Simpler and git-safe (only an edit, no rename), but leaves the codebase with inconsistent casing (`ActiveRoute.jsx` PascalCase, the others lowercase), which invites the same class of bug again.

**Whichever option is chosen, the project must end in a self-consistent state and the change must be verified on a case-sensitive filesystem before being considered done.**

Optional hardening (recommended follow-up, not required for P0-2): add an ESLint rule / `eslint-plugin-import` `import/no-unresolved` with case sensitivity, or rely on the CI build itself (a Linux build) to catch future drift.

## 5. Risks

- **Git case-rename not committed (Option A):** the highest risk. A rename that git ignores on a case-insensitive machine means CI keeps failing despite a "fixed" local tree. Mitigation: verify with `git ls-files` that the committed path has the new casing, and run the build on Linux/CI.
- **Hidden additional importers:** if any other file (now or soon) imports these modules with the old casing, Option A would break them. Verified today only `App.jsx` imports them; Builder should re-grep before finalizing.
- **`dist/` staleness:** the committed `dist/` predates the defect and must be rebuilt; do not treat it as a source of truth.
- **Low functional risk:** no runtime logic changes; this is purely module resolution.

## 6. Acceptance Criteria

1. `npm run build` completes with exit code 0 **on a case-sensitive filesystem** (Linux CI or container), not only on the dev machine. (Combined with P0-1 for a fully green build.)
2. `git ls-files src/` shows filenames whose casing exactly matches every import specifier that references them.
3. The app loads at `/login`, `/driver`, `/driver/route`, and `/admin` with no "module not found" or resolution errors in the console.
4. Project casing is self-consistent (all four route components follow the same convention).
5. `npm run lint` reports no new errors.

## 7. Test Plan

**The decisive test must run on a case-sensitive filesystem** (the bug is invisible on case-insensitive dev machines).

- **CI / Linux build:** run `npm ci && npm run build` in a clean Linux environment (the sandbox here is Linux and case-sensitive, so it can serve as the verification environment). Confirm exit 0 and that the previously-failing imports now resolve.
- **Git verification:** `git ls-files src/shared src/driver src/admin` and confirm the committed paths match the import casing (catches the uncommitted-rename trap).
- **Grep for stragglers:** search the repo for any remaining import of `login.jsx`, `driverhome.jsx`, `adminmap.jsx` (or the PascalCase variants, depending on chosen option) to ensure nothing else references the old names.
- **Manual smoke:** start dev server, visit all four routes, confirm each component renders and the browser console shows no resolution errors.

## 8. Rollback Plan

- **Option A (rename):** revert by `git revert` of the rename commit (git restores both the filenames and the import state together). Because renames and `App.jsx` are in the same change set, rollback is atomic.
- **Option B (edit imports):** revert the single edit to `src/App.jsx`.
- No data, schema, or config changes are involved, so there is nothing to migrate back.
- **Caveat:** rolling back reintroduces the build-blocker on case-sensitive environments, so rollback is only appropriate alongside reverting dependent work. Do not restore the old `dist/` as a "working" state — it predates the defect.
