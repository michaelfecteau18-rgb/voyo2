// VOYO / Adaptiride — canonical demo dataset (DEC-004 single source of truth).
// Spec: specs/passenger-route-model.md §3.6. This is the ONE authoritative
// definition of the demo passengers + route. It is consumed by:
//   - the app (synchronous render via passengersRepo / routesRepo accessors), and
//   - scripts/seed-demo.mjs (which loads the same records into Firestore).
// Nothing else in the app may define passenger or route data inline (DEC-004).
//
// Pure data only — NO firebase / browser imports — so both the browser bundle
// and the Node seed script can import it.

// --- Canonical 5-passenger roster (authoritative across the whole app) ---
export const DEMO_PASSENGERS = [
  { id: 'pax_jacob_bouchard',  fullName: 'Jacob Bouchard',  address: '142 rue des Érables, Granby, QC',  wheelchair: true,  boardingAssistance: false, notes: 'Fauteuil roulant' },
  { id: 'pax_elise_dupont',    fullName: 'Élise Dupont',    address: '89 boul. Laurier, Granby, QC',      wheelchair: false, boardingAssistance: false, notes: '' },
  { id: 'pax_thomas_lefebvre', fullName: 'Thomas Lefebvre', address: '25 rue Principale, Granby, QC',     wheelchair: false, boardingAssistance: false, notes: '' },
  { id: 'pax_marie_tremblay',  fullName: 'Marie Tremblay',  address: '67 av. des Pins, Granby, QC',       wheelchair: false, boardingAssistance: true,  notes: "Aide à l'embarquement" },
  { id: 'pax_lise_pare',       fullName: 'Lise Paré',       address: '310 rue Saint-Jacques, Granby, QC', wheelchair: false, boardingAssistance: false, notes: '' },
]

// --- Canonical route plan ("Route Matin A") — references passengerId only ---
export const DEMO_ROUTE = {
  id: 'route_matin_a',
  name: 'Route Matin A',
  departureLabel: '08h15',
  status: 'scheduled',
  assignedDriverId: null,
  vehicleId: null,
  stops: DEMO_PASSENGERS.map((p, i) => ({
    seq: i + 1,
    passengerId: p.id,
    scheduledPickup: null,
    scheduledDropoff: null,
  })),
}

// --- SAMPLE dispatcher presentation only (NOT live status) ---
// The dispatcher Passagers tab shows status + SMS counts. Until Phase E wires the
// live trips/{id}/stops subscription, these sample values preserve the existing
// screen. They are clearly SAMPLE and must be replaced by live data in Phase E.
export const DEMO_DISPATCHER_SAMPLE = {
  pax_jacob_bouchard:  { status: 'onboard', sms: 2 },
  pax_elise_dupont:    { status: 'dropped', sms: 3 },
  pax_thomas_lefebvre: { status: 'waiting', sms: 0 },
  pax_marie_tremblay:  { status: 'waiting', sms: 0 },
  pax_lise_pare:       { status: 'onboard', sms: 2 },
}
