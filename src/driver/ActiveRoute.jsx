import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, auth } from '../firebase'
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api'
import { getDriverStops } from '../data/routesRepo'

const MAPS_API_KEY = 'AIzaSyCsD1QINJGHCF0gyTzLuUOANdO96fG592Q'
const ARRIVAL_THRESHOLD_METERS = 150

const passengers = getDriverStops()

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#0d1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8eb8d4' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1a2e' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2f4a' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#14D3C4' }, { lightness: -60 }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ]
}

// Calculate distance between two lat/lng points in meters
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Geocode an address to lat/lng
async function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK') {
        resolve({
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng()
        })
      } else {
        reject(new Error('Geocode failed: ' + status))
      }
    })
  })
}

function useGPS(tripId, isActive) {
  const watchRef = useRef(null)
  const lastWriteRef = useRef(0)
  const [coords, setCoords] = useState(null)
  const [gpsError, setGpsError] = useState(null)

  useEffect(() => {
    if (!isActive || !tripId) return
    let wakeLock = null
    navigator.wakeLock?.request('screen').then(l => { wakeLock = l }).catch(() => {})

    watchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude: lat, longitude: lng, speed, heading, accuracy } = position.coords
        if (accuracy > 50) return
        setCoords({ lat, lng, speed, heading, accuracy })

        const now = Date.now()
        const interval = (speed || 0) < 0.5 ? 60000 : 15000
        if (now - lastWriteRef.current >= interval) {
          lastWriteRef.current = now
          try {
            await setDoc(doc(db, 'trips', tripId), {
              currentLocation: { lat, lng, speed, heading, accuracy, updatedAt: serverTimestamp() },
              driverId: auth.currentUser?.uid,
              status: 'active',
              routeName: 'Route Matin A',
              updatedAt: serverTimestamp()
            }, { merge: true })
            await addDoc(collection(db, `locations/${tripId}/points`), {
              lat, lng, speed, heading, accuracy, ts: serverTimestamp()
            })
          } catch (err) {
            console.error('GPS write error:', err)
          }
        }
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 }
    )

    return () => {
      navigator.geolocation.clearWatch(watchRef.current)
      wakeLock?.release()
    }
  }, [isActive, tripId])

  return { coords, gpsError }
}

export default function ActiveRoute() {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState('pickup')
  const [done, setDone] = useState(false)
  const [directions, setDirections] = useState(null)
  const [mapRef, setMapRef] = useState(null)
  const [stopCoords, setStopCoords] = useState(null)
  const [arrived, setArrived] = useState(false)
  const [distanceToStop, setDistanceToStop] = useState(null)
  const arrivalTriggered = useRef(false)

  const tripId = useRef(`trip_${auth.currentUser?.uid}_${Date.now()}`).current
  const { coords, gpsError } = useGPS(tripId, true)

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: MAPS_API_KEY,
    libraries: ['places']
  })

  const current = passengers[currentIndex]
  const progress = Math.round((currentIndex / passengers.length) * 100)

  // Geocode current stop address when stop changes
  useEffect(() => {
    if (!isLoaded) return
    setStopCoords(null)
    setArrived(false)
    arrivalTriggered.current = false
    setDirections(null)

    geocodeAddress(current.address)
      .then(coords => setStopCoords(coords))
      .catch(err => console.error('Geocode error:', err))
  }, [currentIndex, isLoaded])

  // Get directions when we have both driver coords and stop coords
  useEffect(() => {
    if (!isLoaded || !coords || !stopCoords) return
    const service = new window.google.maps.DirectionsService()
    service.route({
      origin: new window.google.maps.LatLng(coords.lat, coords.lng),
      destination: new window.google.maps.LatLng(stopCoords.lat, stopCoords.lng),
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK') setDirections(result)
    })
  }, [isLoaded, stopCoords, coords?.lat, coords?.lng])

  // GEOFENCE — check distance to stop every GPS update
  useEffect(() => {
    if (!coords || !stopCoords || arrivalTriggered.current || arrived) return

    const distance = getDistanceMeters(
      coords.lat, coords.lng,
      stopCoords.lat, stopCoords.lng
    )
    setDistanceToStop(Math.round(distance))

    if (distance <= ARRIVAL_THRESHOLD_METERS) {
      arrivalTriggered.current = true
      setArrived(true)
      // Vibrate phone if supported
      navigator.vibrate?.([200, 100, 200])
    }
  }, [coords, stopCoords, arrived])

  // Auto-launch Google Maps navigation to next stop
  function launchNavigation(address) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`)
  }

  // Pan map to driver
  useEffect(() => {
    if (mapRef && coords) mapRef.panTo({ lat: coords.lat, lng: coords.lng })
  }, [coords, mapRef])

  const onMapLoad = useCallback((map) => setMapRef(map), [])

  function handlePickup() {
    setArrived(false)
    arrivalTriggered.current = false
    setPhase('dropoff')
    // Auto-launch navigation to dropoff (same address for now, will be different in real data)
    launchNavigation(current.address)
  }

  async function handleDropoff() {
    setArrived(false)
    arrivalTriggered.current = false
    setDirections(null)

    if (currentIndex + 1 >= passengers.length) {
      try {
        await setDoc(doc(db, 'trips', tripId), {
          status: 'completed',
          completedAt: serverTimestamp()
        }, { merge: true })
      } catch (err) {
        console.error('Trip completion write failed:', err)
        // Non-blocking: still show the done screen so the driver isn't stuck,
        // but the error is surfaced in logs rather than thrown as an unhandled
        // rejection (parity with the GPS write path). See spec P0-1 §4.2.
      }
      setDone(true)
    } else {
      setCurrentIndex(currentIndex + 1)
      setPhase('pickup')
      // Auto-launch navigation to next pickup
      launchNavigation(passengers[currentIndex + 1].address)
    }
  }

  function handleNotArrived() {
    setArrived(false)
    arrivalTriggered.current = false
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B1220', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px', width: '100%' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h1 style={{ color: 'white', fontSize: '26px', fontWeight: '700', marginBottom: '8px' }}>Trajet complété!</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '32px' }}>
            Tous les passagers ont été déposés avec succès.
          </p>
          <div style={{ background: 'rgba(20,211,196,0.08)', border: '1px solid rgba(20,211,196,0.2)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
            {passengers.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < passengers.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span>✅</span>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>{p.name}</span>
                <span style={{ color: '#14D3C4', fontSize: '11px', marginLeft: 'auto' }}>Déposé</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/driver')} style={{ width: '100%', background: 'linear-gradient(135deg, #14D3C4, #4DA3FF)', border: 'none', borderRadius: '14px', padding: '16px', fontSize: '16px', fontWeight: '700', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', background: '#0B1220', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: '#111c2e', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <button onClick={() => navigate('/driver')} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', width: '34px', height: '34px', color: 'rgba(255,255,255,0.6)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: '700', fontSize: '15px' }}>Route Matin A</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
            Arrêt {currentIndex + 1} de {passengers.length} · {phase === 'pickup' ? 'Ramassage' : 'Dépose'}
            {distanceToStop && !arrived ? ` · ${distanceToStop}m` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: coords ? '#14D3C4' : gpsError ? '#ef4444' : '#f59e0b', boxShadow: `0 0 0 3px ${coords ? 'rgba(20,211,196,0.2)' : 'rgba(245,158,11,0.2)'}` }} />
          <span style={{ color: coords ? '#14D3C4' : gpsError ? '#ef4444' : '#f59e0b', fontSize: '12px', fontWeight: '600' }}>
            {coords ? 'GPS ✓' : gpsError ? 'GPS ✕' : 'GPS...'}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', background: '#111c2e', flexShrink: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '600' }}>{currentIndex + 1}/{passengers.length}</span>
        <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #14D3C4, #4DA3FF)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '600' }}>{progress}%</span>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={coords || { lat: 45.3649, lng: -72.7550 }}
            zoom={15}
            options={mapOptions}
            onLoad={onMapLoad}
          >
            {coords && (
              <Marker
                position={{ lat: coords.lat, lng: coords.lng }}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: '#14D3C4',
                  fillOpacity: 1,
                  strokeColor: 'white',
                  strokeWeight: 3,
                }}
              />
            )}
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: false,
                  polylineOptions: { strokeColor: '#14D3C4', strokeWeight: 5, strokeOpacity: 0.9 }
                }}
              />
            )}
          </GoogleMap>
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#0d1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#14D3C4' }}>Chargement de la carte...</span>
          </div>
        )}

        {/* ══════════ GEOFENCE ARRIVAL OVERLAY ══════════ */}
        {arrived && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(11,18,32,0.96)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '32px', zIndex: 100,
            animation: 'fadeIn 0.3s ease'
          }}>
            {/* Pulse ring */}
            <div style={{
              width: '100px', height: '100px', borderRadius: '50%',
              background: phase === 'pickup'
                ? 'rgba(20,211,196,0.15)'
                : 'rgba(77,163,255,0.15)',
              border: `3px solid ${phase === 'pickup' ? '#14D3C4' : '#4DA3FF'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '42px', marginBottom: '24px',
              boxShadow: `0 0 40px ${phase === 'pickup' ? 'rgba(20,211,196,0.3)' : 'rgba(77,163,255,0.3)'}`
            }}>
              {phase === 'pickup' ? '✅' : '🏠'}
            </div>

            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
              {phase === 'pickup' ? 'Arrivé au point de ramassage' : 'Arrivé au point de dépose'}
            </div>

            <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '800', textAlign: 'center', marginBottom: '6px' }}>
              {current.name}
            </h1>

            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', textAlign: 'center', marginBottom: '8px' }}>
              📍 {current.address}
            </p>

            {current.notes && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '10px 16px', color: '#fbbf24', fontSize: '13px', marginBottom: '32px', textAlign: 'center' }}>
                ⚠️ {current.notes}
              </div>
            )}

            {!current.notes && <div style={{ marginBottom: '32px' }} />}

            {/* BIG action button */}
            {phase === 'pickup' ? (
              <button
                onClick={handlePickup}
                style={{
                  width: '100%', maxWidth: '340px',
                  background: 'linear-gradient(135deg, #14D3C4, #0fb8aa)',
                  border: 'none', borderRadius: '18px', padding: '22px',
                  fontSize: '20px', fontWeight: '800', color: 'white',
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 12px 40px rgba(20,211,196,0.4)',
                  marginBottom: '12px'
                }}
              >
                ✅ &nbsp;Confirmer l'embarquement
              </button>
            ) : (
              <button
                onClick={handleDropoff}
                style={{
                  width: '100%', maxWidth: '340px',
                  background: 'linear-gradient(135deg, #4DA3FF, #3a8fe0)',
                  border: 'none', borderRadius: '18px', padding: '22px',
                  fontSize: '20px', fontWeight: '800', color: 'white',
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 12px 40px rgba(77,163,255,0.4)',
                  marginBottom: '12px'
                }}
              >
                🏠 &nbsp;Confirmer la dépose
              </button>
            )}

            <button
              onClick={handleNotArrived}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px', padding: '12px 24px',
                color: 'rgba(255,255,255,0.4)', fontSize: '13px',
                cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              Pas encore arrivé
            </button>
          </div>
        )}

        {/* Normal bottom card (when not arrived) */}
        {!arrived && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(11,18,32,0.98) 70%, transparent)',
            padding: '20px 16px 16px'
          }}>
            <div style={{ background: 'rgba(17,28,46,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px 16px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(20,211,196,0.15)', border: '2px solid rgba(20,211,196,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14D3C4', fontWeight: '700', fontSize: '16px', flexShrink: 0 }}>
                  {current.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'white', fontSize: '16px', fontWeight: '700' }}>{current.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📍 {current.address}
                  </div>
                  {current.notes && <div style={{ color: '#f59e0b', fontSize: '11px', marginTop: '3px' }}>⚠️ {current.notes}</div>}
                </div>
                {distanceToStop && (
                  <div style={{ background: 'rgba(20,211,196,0.1)', border: '1px solid rgba(20,211,196,0.2)', borderRadius: '8px', padding: '4px 10px', color: '#14D3C4', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>
                    {distanceToStop}m
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={handleNotArrived}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                ⏭ &nbsp;Passer
              </button>
              <button
                onClick={() => launchNavigation(current.address)}
                style={{ background: 'rgba(77,163,255,0.1)', border: '1px solid rgba(77,163,255,0.25)', borderRadius: '10px', padding: '12px', color: '#4DA3FF', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                🧭 &nbsp;Navigation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
