# VOYO Roadmap

**Maintained by:** Product Owner agent · **Last updated:** 2026-06-23
**Inputs:** `docs/audit-2026-06-23.md`, `docs/business-model.md`, `docs/product.md`, `docs/architecture.md`, `tasks/backlog.md`
**North star:** Eliminate uncertainty in adapted transportation — fewer "where is my ride?" calls, more visibility, informed families.

The roadmap is sequenced so that each phase is *independently demoable and honest* (no phase relies on mock data to tell its story).

---

## Phase 0 — Make it build (now)
**Goal:** The app compiles and runs on a clean, case-sensitive environment, with data access secured.
**Backlog:** P0-1, P0-2, P0-3.
**Exit criteria:** `vite build` passes in CI on Linux; trip completion works end to end; Firestore rules committed and deployed.
**Why first:** Nothing else is demonstrable until the build is green and the database isn't open.

## Phase 1 — Honest demo for Amibus
**Goal:** A live demo where everything shown is real (or clearly labeled as sample), and the system is safe to expose.
**Backlog:** P1-4 (secrets/keys), P1-5 (auth guards/roles), P1-6 (one passenger/route source + live driver→dispatcher status).
**Exit criteria:** Driver picks up/drops off → dispatcher map and passenger status update live; protected routes require auth; no secrets in repo. Mock fillers (extra drivers, history) clearly marked as sample.
**Customer story:** "Watch the dispatcher see the driver move and the passenger status change in real time — no phone call needed."

## Phase 2 — Prove the headline value (Communication)
**Goal:** Turn the mocked SMS pillar into one real message in the demo flow.
**Backlog:** P2-7 (real SMS via Cloud Function), P2-8 (GPS resilience).
**Exit criteria:** A real SMS lands on a phone on pickup and dropoff; delivery status visible to dispatcher; weak-GPS degrades gracefully.
**Customer story:** "When the driver confirms pickup, the family gets a text automatically. That's the call your office didn't have to take."
**This is the single highest-leverage phase for closing Amibus** — it converts the core buyer promise ("reduce phone calls") from a screenshot into a working feature.

## Phase 3 — Pilot-ready operations
**Goal:** Run a real route for a real operator beyond a scripted demo.
**Backlog:** P3-10 (trip + vehicle models, multi-route), P3-12 (test baseline + CI), plus demo-data seed → real roster import.
**Exit criteria:** Multiple concurrent routes/drivers; documented trip/vehicle state machines implemented; core logic under test; dispatcher manages real delays.

## Phase 4 — The differentiator (Family & Caregiver portals)
**Goal:** Deliver the "peace of mind" promise to the people the docs call primary users but who have no app yet.
**Backlog:** P3-9 (caregiver/family read-only portal), P3-11 (design system + accessibility).
**Exit criteria:** A caregiver/family member opens a link and sees their passenger's live status + ETA without calling anyone.
**Why later:** Depends on a real data source (Phase 1) and real notifications (Phase 2); building it earlier would just be another mock.

## Phase 5+ — Expansion (post-pilot, market-driven)
Booking requests, route optimization, AI scheduling, predictive ETA (original backlog "Future"), and the documented future verticals: school, medical, senior, municipal transport. Gate these on validated pilot demand and the pricing-model decision (per vehicle / per driver / per org).

---

## Sequencing rationale
1. **Build & security before features** — a broken build or open database makes every other milestone moot.
2. **Real before more** — make a smaller true system before adding surface area; the dashboard already over-promises via mock data.
3. **Communication is the wedge** — it's the buyer's stated pain ("too many phone calls") and the cheapest real win.
4. **Portals last among near-term work** — highest user delight, but entirely dependent on the data + notification plumbing beneath them.

## Open decisions blocking later phases (PO to resolve with stakeholders)
- Pricing model (per vehicle / per active driver / per organization) — affects multi-route and vehicle modeling priorities.
- First notification audience — families vs. residence staff — affects Phase 2/4 scope.
- Consent/opt-out and data-retention policy for passenger location + SMS — must be settled before a real pilot.
