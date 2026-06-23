# Spec P0-3 — Author, commit, and deploy Firestore security rules

**ID:** P0-3
**Phase:** Phase 0 — Make it build (and secure the data)
**Author:** VOYO Architect agent
**Date:** 2026-06-23
**Status:** Draft — ready for Builder
**Source findings:** `docs/audit-2026-06-23.md` §4.3 (and related §4.5 auth); `docs/roadmap.md` Phase 0
**Estimated effort:** ~1–2 hours including emulator testing and deploy
**Implementation note:** Specification only. No production code or rules logic is finalized here — the rule snippets below are reference/illustrative. The Builder agent authors the final `firestore.rules`, tests against the emulator, and deploys.

---

## 1. Problem

There is **no `firestore.rules` file in the repository.** Whatever access rules the `movigo-adee1` Firestore database currently enforces exist only in the Firebase console — unversioned, unreviewable, and not deployable from source. Two failure modes follow:

- **If the console rules are still in test/open mode** (`allow read, write: if true;` or time-limited test rules), then anyone with the project's public Firebase config — which is committed in `src/firebase.js` — can read and write every `trips/*` and `locations/*` document. They could tamper with live trip status, inject fake GPS points, read passenger movement data, or delete trips. This is a real data-exposure and integrity risk for a product whose core asset is real-time location data tied to identifiable passengers.
- **If the console rules are locked down** but not in the repo, then deploys, environment rebuilds, or a new Firebase project (staging) have no rules to apply, and the security posture is unknown and undocumented.

Either way, the rules must be authored, committed to the repo, and deployed via the Firebase CLI so they are version-controlled and reviewable.

## 2. Root Cause

The project was scaffolded and developed against a Firebase project whose rules were configured (or left in test mode) **in the console only**. `firebase.json` declares `hosting` but has **no `firestore` block**, so the CLI has never been told where rules live or that it should deploy them. Security rules were simply never made part of the codebase or the deploy pipeline.

Current `firebase.json` (no firestore section):
```json
{ "hosting": { "public": "dist", ... } }
```

## 3. Files Affected

| File | Change |
|---|---|
| `firestore.rules` | **New file** — the security rules (primary deliverable). |
| `firebase.json` | Add a `firestore` block pointing at `firestore.rules` (and optionally `firestore.indexes.json`) so `firebase deploy` includes rules. |
| `firestore.indexes.json` | **New file (optional)** — only if any required composite index is identified (the dispatcher query `where status == 'active'` is single-field and does not need one). |
| `.gitignore` | Verify rules files are **not** ignored. |
| `README.md` / deploy docs | Note the deploy command (`firebase deploy --only firestore:rules`). Optional but recommended. |

No application source (`src/**`) changes are required by this spec. However, the rules must be designed against the **actual access patterns** the app performs (see §4), and they interact with the P1-5 auth-guard work.

## 4. Technical Approach

### 4.1 Observed data model and access patterns (from current source)

The rules must permit exactly what the app does today and deny the rest:

- **Driver writes** (`src/driver/ActiveRoute.jsx`):
  - `setDoc(doc(db, 'trips', tripId), { currentLocation, driverId: auth.currentUser.uid, status, routeName, updatedAt }, { merge:true })` — driver creates/updates their own trip.
  - `addDoc(collection(db, 'locations/{tripId}/points'), { lat, lng, speed, heading, accuracy, ts })` — driver appends GPS points.
  - On completion: `setDoc(doc(db,'trips',tripId), { status:'completed', completedAt }, {merge:true})`.
- **Dispatcher reads** (`src/admin/adminmap.jsx`):
  - `onSnapshot(query(collection(db,'trips'), where('status','==','active')))` — dispatcher reads all active trips.
- **Auth:** all access is by an authenticated Firebase user (email/password). Role is currently decided client-side by email (`admin@movigo.ca`) — there are **no custom claims** today.

### 4.2 Rules design principles

1. **Deny by default.** Start from `allow read, write: if false;` and open only the paths above.
2. **Require authentication for everything.** No unauthenticated access to any collection.
3. **Drivers write only their own trip.** A trip write should be allowed only when the document's `driverId` equals `request.auth.uid` (on create, validate the incoming `driverId`; on update, check the existing doc's `driverId`). GPS point writes under `locations/{tripId}/points` should be tied to the owning driver of that trip.
4. **Dispatcher/admin read access.** Until custom claims exist, the cleanest enforcement is role via a custom claim or an `admins/{uid}` allowlist document. **Recommended:** introduce an `isAdmin()` helper backed by either a custom claim (`request.auth.token.admin == true`) or an `exists(/databases/$(db)/documents/admins/$(request.auth.uid))` lookup. This is the secure analog of the hardcoded `admin@movigo.ca` check and pairs with P1-5. As an interim, an authenticated-read rule on `trips` is acceptable **only if** the team accepts that any authenticated user can read active trips during the demo — call this out explicitly for sign-off.
5. **Validate writes minimally.** Reject trip writes missing required fields (`status`, `driverId`) or with unexpected status values outside the documented state machine (`scheduled|assigned|active|completed|cancelled`). Keep validation pragmatic for Phase 0; full schema validation can come later.

### 4.3 Reference rules (illustrative — Builder finalizes)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function isAdmin() {
      return isSignedIn() &&
        (request.auth.token.admin == true ||
         exists(/databases/$(database)/documents/admins/$(request.auth.uid)));
    }

    match /trips/{tripId} {
      // Dispatcher/admin can read all; a driver can read their own trip.
      allow read: if isAdmin() ||
        (isSignedIn() && resource.data.driverId == request.auth.uid);

      // Driver creates/updates only their own trip.
      allow create: if isSignedIn()
        && request.resource.data.driverId == request.auth.uid
        && request.resource.data.status in ['scheduled','assigned','active','completed','cancelled'];
      allow update: if isSignedIn()
        && resource.data.driverId == request.auth.uid;
      allow delete: if false;

      match /points/{pointId} {            // NOTE: confirm real path (see Risks)
        allow read: if isAdmin() ||
          (isSignedIn() && get(/databases/$(database)/documents/trips/$(tripId)).data.driverId == request.auth.uid);
        allow create: if isSignedIn()
          && get(/databases/$(database)/documents/trips/$(tripId)).data.driverId == request.auth.uid;
        allow update, delete: if false;
      }
    }

    match /admins/{uid} {
      allow read: if isSignedIn();
      allow write: if false;             // managed out-of-band / console only
    }

    match /{document=**} {
      allow read, write: if false;       // deny by default
    }
  }
}
```

### 4.4 `firebase.json` addition

```json
{
  "hosting": { "...": "unchanged" },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

### 4.5 Deploy

`firebase deploy --only firestore:rules` (after `firebase use default` → `movigo-adee1`). Rules take effect immediately on deploy.

## 5. Risks

- **Sub-collection path shape.** The app writes GPS points with `collection(db, 'locations/{tripId}/points')`, which is the path string `locations/{tripId}/points` — i.e., points live under a top-level `locations` collection, **not** under `trips/{tripId}/points`. The reference rules above show the points block under `trips` for clarity; **Builder must match the real path** and write the rule under `match /locations/{tripId}/points/{pointId}`, resolving the owning driver via `get(/databases/$(database)/documents/trips/$(tripId))`. Getting this path wrong will either break GPS writes (too strict) or leave them open (too loose). **This is the most important detail to get right.**
- **Breaking the working GPS pipeline.** The driver→Firestore→dispatcher path is the project's best asset (audit §9). Over-strict rules could silently break live writes — failures surface only as `console.error('GPS write error')` in `ActiveRoute.jsx`. Must be emulator-tested before deploy.
- **No custom claims today.** Enforcing admin read with `isAdmin()` requires either setting a custom claim or seeding an `admins/{uid}` doc for the dispatcher account. If neither is provisioned before deploy, the dispatcher dashboard's `trips` query will be denied and the map goes blank. Coordinate with P1-5; provision the admin identity as part of this work or use the interim authenticated-read fallback (with explicit sign-off).
- **`tripId` is client-generated.** Since drivers create trip docs with a client-chosen id, a malicious authenticated user could create trips under arbitrary ids — but the `driverId == request.auth.uid` constraint limits them to trips they own, which is acceptable.
- **Lockout risk on deploy.** A mistaken `if false` everywhere would break the live app. Mitigated by emulator testing and a fast rollback (§8).

## 6. Acceptance Criteria

1. A `firestore.rules` file exists in the repo root, is committed, and is referenced by a `firestore` block in `firebase.json`.
2. Rules **deny by default** — any path not explicitly allowed returns permission-denied for both reads and writes.
3. **Unauthenticated** requests are denied on all paths.
4. An **authenticated driver** can create/update **their own** `trips/{tripId}` document and append points to the corresponding `locations/{tripId}/points` collection; the existing GPS pipeline and trip completion (P0-1) continue to work.
5. A driver **cannot** write to a trip whose `driverId` is not their uid.
6. The **dispatcher/admin** identity can read active trips (`where status == 'active'`) so the dashboard map populates; a non-admin authenticated user's admin-only access is denied (or, if the interim authenticated-read fallback is used, this is explicitly documented and signed off).
7. Rules are deployed to `movigo-adee1` via `firebase deploy --only firestore:rules` and the live app's driver and dispatcher flows both still function end-to-end.
8. The deploy command is documented (README or deploy notes).

## 7. Test Plan

**Use the Firebase Emulator Suite — do not test destructively against production.**

- **Setup:** `firebase emulators:start --only firestore` with `firestore.rules` loaded. Write rules unit tests using `@firebase/rules-unit-testing` (or exercise via the emulator UI).
- **Positive cases:**
  - Authenticated driver A creates `trips/tripA` with `driverId == A.uid` → allowed.
  - Driver A appends a point to `locations/tripA/points` → allowed.
  - Driver A updates `trips/tripA` to `status: completed` → allowed (validates P0-1 path under rules).
  - Admin identity reads the active-trips query → allowed.
- **Negative cases:**
  - Unauthenticated read/write of `trips/*` or `locations/*` → denied.
  - Driver B writes `trips/tripA` (owned by A) → denied.
  - Any write to an undeclared collection (e.g., `passengers/*`) → denied.
  - Non-admin authenticated user attempts admin-only read (if `isAdmin()` enforced) → denied.
- **Live smoke after deploy:** run one real driver route on a phone and confirm GPS markers appear on the dispatcher map (proves rules don't break the real pipeline), then verify trip completion writes succeed.

## 8. Rollback Plan

- **Fast path:** rules are versioned in the Firebase console. If a deploy breaks access, roll back to the previous rules version directly in the console (Firestore → Rules → version history) for an immediate fix, then fix-forward in the repo.
- **Repo path:** `git revert` the commit adding `firestore.rules` / `firebase.json` firestore block, then redeploy with `firebase deploy --only firestore:rules`. Note: reverting to *no rules file* is not a real rollback target if production was previously in console-only test mode — prefer rolling back to a known-good committed ruleset rather than removing rules entirely.
- **No data migration** is involved; rules changes are non-destructive to stored documents.
- **Pre-deploy safeguard:** because rules apply immediately and affect the live app, deploy during a low-traffic window and have the previous ruleset version identified before deploying so rollback is one click.
