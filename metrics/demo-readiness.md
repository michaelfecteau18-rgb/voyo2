# Demo Readiness

**Current Score: 68 / 100**
**Last Updated:** 2026-06-23 (P1-6 Phases A & B — data-layer foundation)
**Authority:** mirrors `docs/current-state.md §7`. Score moves only on delivered build/feature work — documentation alone does not change it.

---

## Score History

| Date | Score | Δ | Trigger |
|------|------:|----:|---------|
| 2026-06-23 | 38 | — | Initial audit baseline (`docs/audit-2026-06-23.md`) |
| 2026-06-23 | 64 | +26 | Phase 0 complete: P0-1, P0-2 (build green), P0-3 (rules authored) |
| 2026-06-23 | 64 | 0 | PO docs refresh (audit/roadmap/current-state/backlog) — no score impact |
| 2026-06-23 | 68 | +4 | P1-6 Phases A & B: passenger/route architecture + single-source-of-truth data layer + rules expanded for status workflow. **Capped at +4 — no user-visible functionality changed yet** (data layer unimported; UI still on literals). |

---

## Dimension Scorecard (current)

| Dimension | Weight | Before | Now | Gap to full | Next lever |
|---|---:|---:|---:|---:|---|
| Builds & runs | 25 | 3 | 23 | 2 | OPS-2 CI smoke build; retire stale `dist/` |
| Core flow end-to-end | 20 | 11 | 14 | 6 | P1-6 Phases C–E: wire live driver→dispatcher status |
| Data realism / honesty | 15 | 5 | 9 | 6 | +4 this round: SSOT data layer + seed + rules authored (foundation). Remaining gap closes when UI consumes it (Phases C–F) and literals are deleted. |
| Communication (SMS) | 15 | 1 | 1 | 14 | P2-7 one real SMS |
| Security & privacy | 15 | 4 | 7 | 8 | OPS-1 deploy rules · P1-4 secrets · P1-5 guards |
| Polish / UX | 10 | 14* | 14* | — | P3-11 contrast/design system |

\*Driver UX exceeds baseline (additive scoring). **Total = 23 + 14 + 9 + 1 + 7 + 14 = 68 / 100.**

> **Why only +4:** P1-6 Phases A & B are foundation — the data layer is unimported and the UI still renders hardcoded literals, so nothing a demo viewer sees has changed. The increment reflects *architectural readiness* (the single source of truth and its security rules now exist), not delivered user-visible behaviour. The rest of the Data-realism gap unlocks when Phases C–F wire the UI to the data layer and remove the three literals.

---

## Target: 80 / 100 (honest demo)

Required (in priority order — see `tasks/backlog.md`):

* **OPS-1** — deploy Firestore rules + provision admin identity *(needs user Firebase creds)*
* **P1-6** — single source of truth + live passenger status updates *(highest ROI: Core flow + Data realism)*
* **P1-4** — secrets to env, restrict + rotate Maps key
* **P1-5** — route auth guards + enforced roles
* **P2-7** — one real SMS notification on pickup/dropoff

Projected lift: Core flow 14→~19, Data realism 9→~13, Security 7→~13, Communication 1→~8 → **~80**.

---

## Future: 90+ / 100

Required:

* **P3-9** — family portal
* **P3-9** — caregiver portal
* **P3-10** — trip/vehicle models, multi-route, better reporting
* **P3-12** — test baseline in CI
* Improved notifications (delay/ETA, beyond pickup/dropoff)

---

## Remaining Blockers to 80 (quick view)

* P1-6 Passenger Route Model (data source + live status)
* OPS-1 rules deployment
* Auth guards (P1-5)
* Secret management (P1-4)
* Real SMS (P2-7)

<!-- END OF FILE — VOYO demo-readiness metric · 2026-06-23 -->
