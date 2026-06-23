// VOYO / Adaptiride — trip execution service (live status writes).
// Spec: specs/passenger-route-model.md §3.3/§3.4/§3.5, §8.
//
// Responsibilities:
//   - startTripFromRoute: create/merge the trips/{tripId} doc (ADDITIVE to the
//     existing GPS fields) and seed trips/{tripId}/stops/{passengerId} from the
//     route plan, denormalizing passengerName/address for cheap display.
//   - setStopStatus: update one stop's status + timestamps AND append a
//     trips/{tripId}/statusEvents record in the same logical action
//     ("written once, reflected everywhere" — DEC-004 / AC-3/4/7).
//
// IMPORTANT (AC-6 / Risk R1): this service NEVER writes trips.currentLocation
// nor anything under locations/{tripId}/points — the GPS pipeline is untouched.
// startTripFromRoute uses { merge:true } so it only ADDS routeId/serviceDate and
// reuses the caller's existing client tripId; it does not reshape the trip doc.
//
// Phase B (data-layer foundation) only. Not yet imported by any UI/workflow.

import { db, auth } from '../firebase'
import {
  doc, setDoc, collection, addDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { getRouteWithPassengers } from './routesRepo'
import {
  StopStatus, TripStatus, statusEventType, isValidStopStatus,
} from './status'

// Mirror of the existing id scheme in ActiveRoute.jsx (trip_${uid}_${Date.now()}).
export function makeTripId(driverId) {
  return `trip_${driverId}_${Date.now()}`
}

function requireUid() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('startTripFromRoute/setStopStatus: not authenticated')
  return uid
}

// Create (or merge into) the trip and seed its stops from the route plan.
// Pass an existing tripId (the GPS pipeline's client id) to keep one doc.
export async function startTripFromRoute(routeId, tripId) {
  const uid = requireUid()
  const route = await getRouteWithPassengers(routeId)
  if (!route) throw new Error(`startTripFromRoute: route not found: ${routeId}`)

  const id = tripId || makeTripId(uid)

  // Additive merge — only adds routeId/serviceDate/routeName; preserves any
  // existing driverId/status/currentLocation written by the GPS pipeline.
  await setDoc(
    doc(db, 'trips', id),
    {
      driverId: uid,
      status: TripStatus.ACTIVE,
      routeId,
      routeName: route.name ?? null,
      serviceDate: route.serviceDate ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )

  // Seed one stop per route stop, keyed by passengerId (decision 1).
  const batch = writeBatch(db)
  for (const stop of route.stops || []) {
    const ref = doc(db, `trips/${id}/stops`, stop.passengerId)
    batch.set(
      ref,
      {
        seq: stop.seq ?? null,
        passengerId: stop.passengerId,
        passengerName: stop.passenger?.fullName ?? null,
        address: stop.passenger?.address ?? stop.address ?? null,
        status: StopStatus.SCHEDULED,
        pickedUpAt: null,
        droppedOffAt: null,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      },
      { merge: true }
    )
  }
  await batch.commit()

  return id
}

// Update a single stop's status and append a matching status event.
// opts.routeName is denormalized into the event for the future SMS consumer.
export async function setStopStatus(tripId, passengerId, toStatus, opts = {}) {
  const uid = requireUid()
  if (!tripId || !passengerId) {
    throw new Error('setStopStatus: tripId and passengerId are required')
  }
  if (!isValidStopStatus(toStatus)) {
    throw new Error(`setStopStatus: invalid status "${toStatus}"`)
  }

  const patch = {
    status: toStatus,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  }
  if (toStatus === StopStatus.ONBOARD) patch.pickedUpAt = serverTimestamp()
  if (toStatus === StopStatus.DROPPED_OFF) patch.droppedOffAt = serverTimestamp()

  await setDoc(doc(db, `trips/${tripId}/stops`, passengerId), patch, { merge: true })

  const type = statusEventType(toStatus)
  if (type) {
    await addDoc(collection(db, `trips/${tripId}/statusEvents`), {
      passengerId,
      tripId,
      stopId: passengerId,
      type,
      at: serverTimestamp(),
      routeName: opts.routeName ?? null,
      actorId: uid,
    })
  }

  return { tripId, passengerId, status: toStatus, eventType: type }
}
