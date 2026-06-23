# Adaptiride / Movigo — Project Briefing

> Context for ChatGPT. This describes an existing codebase so you can help with it.

## What it is
A web app for **adapted/paratransit transport** (transport adapté) — door-to-door
rides for people with reduced mobility (wheelchair users, riders needing boarding
assistance). The product is branded **"movigo"** in the UI; the repo/package is named
**adaptiride**. Interface language is **French (Québec)**. Operating area is **Granby,
Quebec**. Tagline: "Transport adapté sécurisé."

It has two user types in one app:
1. **Drivers** — see their assigned route, navigate stop-to-stop, mark passengers
   picked up / dropped off.
2. **Admin / dispatch** — a live operations dashboard tracking all drivers on a map,
   passenger statuses, delays, and SMS notifications to families.

## Tech stack
- **React 19** + **Vite 8** (JavaScript, not TypeScript), **React Router 7**
- **Firebase** — Auth (email/password) + **Firestore** (real-time DB)
- **Google Maps** via `@react-google-maps/api` (maps, geocoding, directions, markers)
- **Zustand** (state), **dayjs** (dates), **Tailwind CSS** (configured; components mostly use inline styles)
- Hosted on **Firebase Hosting** (`firebase.json`, `.firebaserc`); Firebase project id `movigo-adee1`

## Routes (src/App.jsx)
- `/login` — `shared/login.jsx`
- `/driver` — `driver/driverhome.jsx` (route overview + passenger list)
- `/driver/route` — `driver/ActiveRoute.jsx` (live navigation)
- `/admin` — `admin/adminmap.jsx` (dispatch dashboard)
- `*` → redirects to `/login`

## How it works
**Auth & roles:** Email/password login via Firebase. Role is decided by email —
`admin@movigo.ca` → `/admin`, everyone else → `/driver`. (Hardcoded check, not
custom claims.)

**Driver flow:** Driver sees "Route Matin A" with a passenger list. Starting the
route writes a `trips/{tripId}` doc (status `active`) to Firestore and begins
streaming GPS into `locations/{tripId}/points`. The app launches turn-by-turn
navigation to each stop and runs a **geofence**: it computes distance to the next
stop (Haversine, `ARRIVAL_THRESHOLD_METERS = 150`) on every GPS update and pops an
arrival overlay when the driver is within range. Driver confirms pickup/dropoff,
advances to the next stop; completing the last stop sets the trip `status: 'completed'`.

**Admin flow:** Dashboard with tabs — Carte (map), Chauffeurs (drivers), Passagers,
SMS, Historique. A Google Map shows live driver markers; it subscribes to active
trips via Firestore `onSnapshot` (`where status == 'active'`). Shows on-time vs.
delayed drivers, a live activity feed (pickups, dropoffs, delay alerts, SMS sent to
families), and passenger statuses (waiting / onboard / dropped).

## Current state — important caveats
- **Prototype / demo stage.** Most data is **hardcoded mock data** (passenger lists,
  driver positions, activity feed, history are literals in the components). The real
  Firestore wiring exists mainly on the driver→admin trip/location path.
- The **SMS-to-families** feature appears in the UI/activity feed but isn't wired to a
  real SMS provider in the code seen.
- `docs/`, `specs/`, `qa/`, `reviews/`, `tasks/`, `orchestration/` folders exist but
  contain **empty placeholder files** (0 bytes) — planning scaffolding, no content yet.
- **Secrets are committed in source:** Firebase config in `src/firebase.js` and a
  `Google API'S.txt` file. The Google Maps key is referenced as `MAPS_API_KEY` in the
  map components. These should be moved to env vars / restricted.

## Likely next features (implied by repo structure)
- `specs/feature-driver-checkin.md` — formalize driver check-in
- `specs/feature-parent-notifications.md` — real parent/family notifications (the SMS feature)
