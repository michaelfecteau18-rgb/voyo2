// VOYO / Adaptiride — passengers data access (SSOT for passenger identity).
// Spec: specs/passenger-route-model.md §3.1, §8. DEC-004: passenger identity is
// defined ONCE (src/data/demoData.js) and read through this repo — never inlined
// in components.
//
// Two access paths share one source of truth:
//   - Canonical (synchronous): getCanonicalPassengers/getCanonicalPassenger read
//     the bundled authoritative roster. Used by the current UI so behavior and
//     screens are preserved with no async/loading change (Phase C).
//   - Live (async): getPassenger/listActivePassengers read Firestore once the
//     roster is seeded (scripts/seed-demo.mjs) — used by later live wiring.

import { db } from '../firebase'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { DEMO_PASSENGERS } from './demoData'

const COLLECTION = 'passengers'

// --- Canonical (synchronous) — single source for current UI rendering ---
export function getCanonicalPassengers() {
  return DEMO_PASSENGERS.map((p) => ({ ...p }))
}

export function getCanonicalPassenger(passengerId) {
  const p = DEMO_PASSENGERS.find((x) => x.id === passengerId)
  return p ? { ...p } : null
}

// --- Live (async, Firestore) — used once passengers/* is seeded ---
function toPassenger(snap) {
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getPassenger(passengerId) {
  if (!passengerId) return null
  const snap = await getDoc(doc(db, COLLECTION, passengerId))
  return toPassenger(snap)
}

export async function getPassengers(ids = []) {
  return Promise.all(ids.map((id) => getPassenger(id)))
}

export async function listActivePassengers() {
  const q = query(collection(db, COLLECTION), where('active', '==', true))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
