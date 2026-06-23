// VOYO / Adaptiride — routes data access (SSOT for route plans).
// Spec: specs/passenger-route-model.md §3.2, §8. DEC-004: the route plan is
// defined ONCE (src/data/demoData.js) and read through this repo. Route stops
// reference passengerId only; passenger identity is joined from passengersRepo
// (never copied into the route).
//
// Canonical (synchronous) accessors preserve current UI behavior with no async
// change; live (async) Firestore accessors are used once routes/* is seeded.

import { db } from '../firebase'
import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore'
import { getPassenger, getCanonicalPassenger } from './passengersRepo'
import { DEMO_ROUTE, DEMO_DISPATCHER_SAMPLE } from './demoData'

const COLLECTION = 'routes'

// Driver-facing notes string (preserves the original inline presentation).
function driverNotes(p) {
  if (!p) return ''
  if (p.wheelchair) return '♿ Fauteuil roulant'
  if (p.boardingAssistance) return "Aide à l'embarquement"
  return p.notes || ''
}

// Compact icon-only notes used by the dispatcher list.
function iconNotes(p) {
  if (!p) return ''
  if (p.wheelchair) return '♿'
  if (p.boardingAssistance) return '🤝'
  return ''
}

// --- Canonical (synchronous) — single source for current UI rendering ---

// Route header info (name + departure label) without the stop detail.
export function getCanonicalRoute() {
  return {
    id: DEMO_ROUTE.id,
    name: DEMO_ROUTE.name,
    departureLabel: DEMO_ROUTE.departureLabel,
    status: DEMO_ROUTE.status,
  }
}

// Driver/route stop list, joined to passenger identity, in the shape the driver
// screens consume: { id, name, address, notes }. One row per route stop, ordered.
export function getDriverStops() {
  return DEMO_ROUTE.stops.map((s) => {
    const p = getCanonicalPassenger(s.passengerId)
    return {
      id: s.passengerId,
      name: p?.fullName ?? s.passengerId,
      address: p?.address ?? '',
      notes: driverNotes(p),
    }
  })
}

// Dispatcher passenger rows: identity from SSOT; status/sms are SAMPLE display
// (replaced by live trips/{id}/stops in Phase E). Shape mirrors the old literal:
// { name, addr, route, status, sms, notes }.
export function getDispatcherRows() {
  const routeLabel = DEMO_ROUTE.name.replace(/^Route\s+/, '')
  return DEMO_ROUTE.stops.map((s) => {
    const p = getCanonicalPassenger(s.passengerId)
    const sample = DEMO_DISPATCHER_SAMPLE[s.passengerId] || { status: 'waiting', sms: 0 }
    return {
      name: p?.fullName ?? s.passengerId,
      addr: p?.address ?? '',
      route: routeLabel,
      status: sample.status,
      sms: sample.sms,
      notes: iconNotes(p),
    }
  })
}

// --- Live (async, Firestore) — used once routes/* is seeded ---
function toRoute(snap) {
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getRoute(routeId) {
  if (!routeId) return null
  const snap = await getDoc(doc(db, COLLECTION, routeId))
  return toRoute(snap)
}

export async function getRouteWithPassengers(routeId) {
  const route = await getRoute(routeId)
  if (!route) return null
  const stops = await Promise.all(
    (route.stops || []).map(async (stop) => ({
      ...stop,
      passenger: await getPassenger(stop.passengerId),
    }))
  )
  return { ...route, stops }
}

export async function getAssignedRouteForDriver(driverId) {
  if (!driverId) return null
  const q = query(
    collection(db, COLLECTION),
    where('assignedDriverId', '==', driverId),
    limit(1)
  )
  const snap = await getDocs(q)
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}
