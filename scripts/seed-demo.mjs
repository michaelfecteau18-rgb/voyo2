// VOYO / Adaptiride — one-time idempotent demo seed.
// Spec: specs/passenger-route-model.md §3.6, §9 step 2. DEC-004: the roster +
// route are imported from the SINGLE canonical source (src/data/demoData.js) —
// this script does NOT redefine them, so app and seed can never drift.
//
// passengers/* and routes/* are admin-only per firestore.rules, so this uses the
// Firebase Admin SDK (which bypasses rules) — the correct tool for seeding.
//
// Usage:
//   npm i -D firebase-admin
//   # against the emulator:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GOOGLE_CLOUD_PROJECT=movigo-adee1 node scripts/seed-demo.mjs
//   # against production (needs a service account):
//   GOOGLE_APPLICATION_CREDENTIALS=./sa.json node scripts/seed-demo.mjs
//
// Idempotent: stable document ids + { merge:true } — safe to re-run.

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { DEMO_PASSENGERS, DEMO_ROUTE } from '../src/data/demoData.js'

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'movigo-adee1'
const SERVICE_DATE = process.env.SEED_SERVICE_DATE || new Date().toISOString().slice(0, 10)

function passengerDoc(p) {
  return {
    fullName: p.fullName,
    address: p.address,
    geo: null,
    accessibility: { wheelchair: p.wheelchair, boardingAssistance: p.boardingAssistance, notes: p.notes },
    contacts: { family: [], caregiver: [] },
    consent: { locationSharing: false, smsConsentAt: null },
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
}

function routeDoc() {
  return {
    name: DEMO_ROUTE.name,
    serviceDate: SERVICE_DATE,
    status: DEMO_ROUTE.status,
    assignedDriverId: DEMO_ROUTE.assignedDriverId,
    vehicleId: DEMO_ROUTE.vehicleId,
    stops: DEMO_ROUTE.stops.map((s) => ({
      seq: s.seq,
      passengerId: s.passengerId,
      scheduledPickup: s.scheduledPickup ?? null,
      scheduledDropoff: s.scheduledDropoff ?? null,
    })),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
}

async function main() {
  initializeApp(
    process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? { credential: applicationDefault(), projectId: PROJECT_ID }
      : { projectId: PROJECT_ID }
  )
  const db = getFirestore()

  const batch = db.batch()
  for (const p of DEMO_PASSENGERS) {
    batch.set(db.collection('passengers').doc(p.id), passengerDoc(p), { merge: true })
  }
  batch.set(db.collection('routes').doc(DEMO_ROUTE.id), routeDoc(), { merge: true })
  await batch.commit()

  console.log(`Seeded ${DEMO_PASSENGERS.length} passengers + route "${DEMO_ROUTE.id}" (serviceDate ${SERVICE_DATE}) into ${PROJECT_ID}.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('Seed failed:', e); process.exit(1) })
