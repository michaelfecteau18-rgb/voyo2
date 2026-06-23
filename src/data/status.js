// VOYO / Adaptiride — canonical status vocabulary (single source in code).
// Spec: specs/passenger-route-model.md §5 (passenger lifecycle) and §6 (route/trip
// lifecycle). All stored values are snake_case strings and MUST match the
// `validStopStatus` set enforced in firestore.rules.
//
// Phase B (data-layer foundation) only. Not yet imported by any UI/workflow.

// --- Passenger / stop lifecycle (trips/{tripId}/stops/{passengerId}.status) ---
export const StopStatus = Object.freeze({
  SCHEDULED: 'scheduled',
  EN_ROUTE: 'en_route',
  ARRIVED: 'arrived',
  ONBOARD: 'onboard',
  DROPPED_OFF: 'dropped_off',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
})

// --- Trip / route execution lifecycle ---
export const TripStatus = Object.freeze({
  SCHEDULED: 'scheduled',
  ASSIGNED: 'assigned',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
})

// Route shares the trip vocabulary (spec §6).
export const RouteStatus = TripStatus

// Allowed stop transitions (spec §5). Terminal states map to [].
const STOP_TRANSITIONS = Object.freeze({
  scheduled: ['en_route', 'arrived', 'onboard', 'no_show', 'cancelled'],
  en_route: ['arrived', 'onboard', 'no_show'],
  arrived: ['onboard', 'no_show'],
  onboard: ['dropped_off'],
  dropped_off: [],
  no_show: [],
  cancelled: [],
})

export function isValidStopStatus(s) {
  return Object.values(StopStatus).includes(s)
}

export function canTransitionStop(from, to) {
  if (!isValidStopStatus(to)) return false
  if (from == null) return to === StopStatus.SCHEDULED
  return (STOP_TRANSITIONS[from] || []).includes(to)
}

// Map a stop status to the statusEvents `type` written on that transition
// (spec §3.5: "picked_up" | "dropped_off" | "en_route" | "no_show" | ...).
// Returns null when a transition should not emit an event.
export function statusEventType(toStatus) {
  switch (toStatus) {
    case StopStatus.ONBOARD: return 'picked_up'
    case StopStatus.DROPPED_OFF: return 'dropped_off'
    case StopStatus.EN_ROUTE: return 'en_route'
    case StopStatus.ARRIVED: return 'arrived'
    case StopStatus.NO_SHOW: return 'no_show'
    case StopStatus.CANCELLED: return 'cancelled'
    default: return null
  }
}
