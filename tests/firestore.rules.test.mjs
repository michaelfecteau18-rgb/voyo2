import { readFileSync } from 'fs'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore'

let pass = 0, fail = 0
const check = async (name, p) => { try { await p; console.log('  PASS', name); pass++ } catch(e){ console.log('  FAIL', name, '-', e.message); fail++ } }

const env = await initializeTestEnvironment({
  projectId: 'voyo-rules-test',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
})

// Seed (rules bypassed): a trip owned by driverA, an admin allowlist doc, and
// one passenger + one route for read tests.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await setDoc(doc(db, 'trips/tripA'), { driverId: 'driverA', status: 'active', routeName: 'R' })
  await setDoc(doc(db, 'admins/adminUid'), { role: 'dispatcher' })
  await setDoc(doc(db, 'passengers/pax_marie_tremblay'), { fullName: 'Marie Tremblay', active: true })
  await setDoc(doc(db, 'routes/route_matin_a'), { name: 'Route Matin A', status: 'active' })
  // a pre-existing statusEvent to test update/delete denial
  await setDoc(doc(db, 'trips/tripA/statusEvents/e0'), { type: 'picked_up', passengerId: 'pax_marie_tremblay' })
})

const driverA = env.authenticatedContext('driverA').firestore()
const driverB = env.authenticatedContext('driverB').firestore()
const admin   = env.authenticatedContext('adminUid').firestore()
const anon    = env.unauthenticatedContext().firestore()

console.log('POSITIVE cases (P0-3):')
await check('driverA creates own trip', assertSucceeds(setDoc(doc(driverA,'trips/tripA2'), { driverId:'driverA', status:'active' })))
await check('driverA updates own trip to completed', assertSucceeds(setDoc(doc(driverA,'trips/tripA'), { driverId:'driverA', status:'completed' }, { merge:true })))
await check('driverA appends GPS point to own trip', assertSucceeds(addDoc(collection(driverA,'locations/tripA/points'), { lat:1, lng:2, ts:1 })))
await check('driverA reads own trip', assertSucceeds(getDoc(doc(driverA,'trips/tripA'))))
await check('admin reads active-trips query', assertSucceeds(getDocs(query(collection(admin,'trips'), where('status','==','active')))))
await check('admin reads any trip', assertSucceeds(getDoc(doc(admin,'trips/tripA'))))

console.log('POSITIVE cases (P1-6 stops / statusEvents / passengers / routes):')
await check('driverA creates own stop (status scheduled)', assertSucceeds(setDoc(doc(driverA,'trips/tripA/stops/pax_marie_tremblay'), { passengerId:'pax_marie_tremblay', status:'scheduled', seq:1 })))
await check('driverA updates own stop to onboard', assertSucceeds(setDoc(doc(driverA,'trips/tripA/stops/pax_marie_tremblay'), { passengerId:'pax_marie_tremblay', status:'onboard', pickedUpAt:1 }, { merge:true })))
await check('driverA appends statusEvent to own trip', assertSucceeds(addDoc(collection(driverA,'trips/tripA/statusEvents'), { type:'picked_up', passengerId:'pax_marie_tremblay', at:1 })))
await check('driverA reads own stop', assertSucceeds(getDoc(doc(driverA,'trips/tripA/stops/pax_marie_tremblay'))))
await check('admin reads any trip stop', assertSucceeds(getDoc(doc(admin,'trips/tripA/stops/pax_marie_tremblay'))))
await check('admin reads statusEvents', assertSucceeds(getDocs(collection(admin,'trips/tripA/statusEvents'))))
await check('signed-in driver reads passengers', assertSucceeds(getDoc(doc(driverA,'passengers/pax_marie_tremblay'))))
await check('signed-in driver reads routes', assertSucceeds(getDoc(doc(driverA,'routes/route_matin_a'))))
await check('admin creates a passenger', assertSucceeds(setDoc(doc(admin,'passengers/pax_new'), { fullName:'New Person', active:true })))
await check('admin creates a route', assertSucceeds(setDoc(doc(admin,'routes/route_new'), { name:'Route B', status:'scheduled' })))

console.log('NEGATIVE cases (P0-3):')
await check('anon cannot read trips', assertFails(getDoc(doc(anon,'trips/tripA'))))
await check('anon cannot write trips', assertFails(setDoc(doc(anon,'trips/tripX'), { driverId:'x', status:'active' })))
await check('driverB cannot update driverA trip', assertFails(setDoc(doc(driverB,'trips/tripA'), { driverId:'driverA', status:'cancelled' }, { merge:true })))
await check('driverB cannot reassign trip to self', assertFails(setDoc(doc(driverB,'trips/tripA'), { driverId:'driverB', status:'active' }, { merge:true })))
await check('driverB cannot append GPS to driverA trip', assertFails(addDoc(collection(driverB,'locations/tripA/points'), { lat:1,lng:2,ts:1 })))
await check('driverA cannot create trip with invalid status', assertFails(setDoc(doc(driverA,'trips/tripBad'), { driverId:'driverA', status:'flying' })))
await check('driverA cannot create trip owned by someone else', assertFails(setDoc(doc(driverA,'trips/tripC'), { driverId:'driverB', status:'active' })))
await check('non-admin driver denied admin-only read of others trip', assertFails(getDoc(doc(driverB,'trips/tripA'))))
await check('nobody can write undeclared collection passengersList', assertFails(setDoc(doc(driverA,'passengersList/p1'), { x:1 })))
await check('trips delete denied', assertFails(deleteDoc(doc(driverA,'trips/tripA'))))

console.log('NEGATIVE cases (P1-6):')
await check('driverB cannot create stop on driverA trip', assertFails(setDoc(doc(driverB,'trips/tripA/stops/pax_marie_tremblay'), { passengerId:'pax_marie_tremblay', status:'onboard' })))
await check('driverB cannot append statusEvent on driverA trip', assertFails(addDoc(collection(driverB,'trips/tripA/statusEvents'), { type:'picked_up', at:1 })))
await check('driverA cannot create stop with invalid status', assertFails(setDoc(doc(driverA,'trips/tripA/stops/pax_bad'), { passengerId:'pax_bad', status:'flying' })))
await check('stop delete denied (append/keep)', assertFails(deleteDoc(doc(driverA,'trips/tripA/stops/pax_marie_tremblay'))))
await check('statusEvent update denied (append-only)', assertFails(updateDoc(doc(driverA,'trips/tripA/statusEvents/e0'), { type:'tampered' })))
await check('statusEvent delete denied (append-only)', assertFails(deleteDoc(doc(driverA,'trips/tripA/statusEvents/e0'))))
await check('non-admin cannot write passengers', assertFails(setDoc(doc(driverA,'passengers/pax_marie_tremblay'), { fullName:'Hacked' }, { merge:true })))
await check('non-admin cannot write routes', assertFails(setDoc(doc(driverA,'routes/route_matin_a'), { name:'Hacked' }, { merge:true })))
await check('anon cannot read passengers', assertFails(getDoc(doc(anon,'passengers/pax_marie_tremblay'))))
await check('anon cannot read routes', assertFails(getDoc(doc(anon,'routes/route_matin_a'))))

await env.cleanup()
console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
