import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, auth } from '../firebase'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import { getDispatcherRows } from '../data/routesRepo'

const MAPS_API_KEY = 'AIzaSyCsD1QINJGHCF0gyTzLuUOANdO96fG592Q'
const LIBRARIES = ['places']

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#0d1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8eb8d4' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1a2e' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2f4a' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#14D3C4' }, { lightness: -60 }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  ]
}

const MOCK_DRIVERS = [
  { id: 'driver1', name: 'Marc Leblanc', route: 'Route Matin A', stops: '3/7', onTime: true, lat: 45.3660, lng: -72.7520 },
  { id: 'driver2', name: 'Sarah Bouchard', route: 'Route Matin B', stops: '5/6', onTime: true, lat: 45.3720, lng: -72.7680 },
  { id: 'driver3', name: 'Pierre Gagnon', route: 'Route Centre-Ville', stops: '2/8', onTime: false, lat: 45.3580, lng: -72.7440 },
  { id: 'driver4', name: 'Julie Martin', route: 'Route Sud', stops: '1/5', onTime: true, lat: 45.3490, lng: -72.7610 },
]

const MOCK_ACTIVITY = [
  { icon: '✅', text: 'Jacob B. embarqué', sub: 'Marc L. · Route Matin A · 08h36', type: 'pickup' },
  { icon: '📱', text: 'SMS envoyé — Famille Bouchard', sub: 'Embarquement confirmé · 08h36', type: 'sms' },
  { icon: '🏠', text: 'Élise D. déposée', sub: 'Sarah B. · Route Matin B · 08h30', type: 'dropoff' },
  { icon: '⚠️', text: 'Retard détecté — Pierre Gagnon', sub: '+8 min · Route Centre-Ville · 08h22', type: 'delay' },
  { icon: '📱', text: 'SMS retard — 3 familles notifiées', sub: 'Route Centre-Ville · 08h23', type: 'sms' },
  { icon: '✅', text: 'Thomas L. embarqué', sub: 'Marc L. · Route Matin A · 08h28', type: 'pickup' },
]

const BOTTOM_TABS = [
  { id: 'map', icon: '🗺️', label: 'Carte' },
  { id: 'drivers', icon: '🚌', label: 'Chauffeurs' },
  { id: 'passengers', icon: '👥', label: 'Passagers' },
  { id: 'sms', icon: '📱', label: 'SMS' },
  { id: 'history', icon: '📋', label: 'Historique' },
]

const PASSENGERS = getDispatcherRows()

const SMS_LOG = [
  { type: '✅', name: 'Jacob Bouchard', msg: '"Jacob a été embarqué avec Marc à 8h36. Bonne journée!"', phone: '450-555-0101', time: '08h36' },
  { type: '🚌', name: 'Jacob Bouchard', msg: '"Le transport de Jacob arrive dans ~8 min. Chauffeur Marc, Toyota blanc ABC-123."', phone: '450-555-0101', time: '08h28' },
  { type: '🏠', name: 'Élise Dupont', msg: '"Élise est arrivée à destination et déposée à 8h30. Bonne journée!"', phone: '450-555-0202', time: '08h30' },
  { type: '⚠️', name: 'Pierre Gagnon (3 familles)', msg: '"Le transport a ~8 min de retard. Merci de votre patience."', phone: 'Multiple', time: '08h23' },
  { type: '🚌', name: 'Élise Dupont', msg: '"Le transport d\'Élise arrive dans ~8 min. Chauffeur Sarah, Honda bleu XYZ-456."', phone: '450-555-0202', time: '08h22' },
]

const HISTORY = [
  { date: "Aujourd'hui", route: 'Route Matin A', driver: 'Marc Leblanc', pass: 7, sms: 18, ok: true },
  { date: "Aujourd'hui", route: 'Route Matin B', driver: 'Sarah Bouchard', pass: 6, sms: 15, ok: true },
  { date: 'Hier', route: 'Route Matin A', driver: 'Marc Leblanc', pass: 7, sms: 21, ok: true },
  { date: 'Hier', route: 'Route Centre-Ville', driver: 'Pierre Gagnon', pass: 8, sms: 19, ok: false },
  { date: '13 mai', route: 'Route Sud', driver: 'Julie Martin', pass: 5, sms: 14, ok: true },
]

// ─── SUB COMPONENTS (outside AdminMap) ───

function MapView({ isLoaded, allDrivers, selectedDriver, setSelectedDriver, mapRef, setMapRef, isMobile }) {
  const onMapLoad = useCallback((map) => setMapRef(map), [setMapRef])

  return (
    <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={{ lat: 45.3649, lng: -72.7550 }}
          zoom={13}
          options={mapOptions}
          onLoad={onMapLoad}
        >
          {allDrivers.map(driver => (
            <Marker
              key={driver.id}
              position={{ lat: driver.lat, lng: driver.lng }}
              onClick={() => setSelectedDriver(driver)}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: driver.isReal ? 14 : 10,
                fillColor: driver.isReal ? '#14D3C4' : driver.onTime ? '#22c55e' : '#f59e0b',
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: driver.isReal ? 3 : 2,
              }}
            />
          ))}
          {selectedDriver && (
            <InfoWindow
              position={{ lat: selectedDriver.lat, lng: selectedDriver.lng }}
              onCloseClick={() => setSelectedDriver(null)}
            >
              <div style={{ fontFamily: 'sans-serif', padding: '4px', minWidth: '160px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>
                  {selectedDriver.isReal ? '🟢 GPS Réel' : selectedDriver.name}
                </div>
                <div style={{ fontSize: '12px', color: '#444', marginBottom: '2px' }}>{selectedDriver.route}</div>
                <div style={{ fontSize: '12px', color: '#444' }}>Arrêts: {selectedDriver.stops}</div>
                <div style={{ fontSize: '11px', fontWeight: '700', marginTop: '4px', color: selectedDriver.onTime ? '#16a34a' : '#d97706' }}>
                  {selectedDriver.onTime ? '✓ À l\'heure' : '⚠ En retard'}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      ) : (
        <div style={{ width: '100%', height: '100%', background: '#0d1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#14D3C4' }}>Chargement de la carte...</span>
        </div>
      )}

      {/* Legend */}
      <div style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(17,28,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px' }}>
        {[{ color: '#14D3C4', label: 'GPS réel' }, { color: '#22c55e', label: 'À l\'heure' }, { color: '#f59e0b', label: 'En retard' }].map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: i < 2 ? '6px' : '0' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color }} />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Mini driver list on mobile */}
      {isMobile && (
        <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(17,28,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 12px', maxWidth: '150px' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
            {allDrivers.length} actifs
          </div>
          {allDrivers.slice(0, 4).map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', cursor: 'pointer' }}
              onClick={() => { setSelectedDriver(d); mapRef?.panTo({ lat: d.lat, lng: d.lng }); mapRef?.setZoom(15) }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: d.isReal ? '#14D3C4' : d.onTime ? '#22c55e' : '#f59e0b', flexShrink: 0 }} />
              <span style={{ color: 'white', fontSize: '11px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.isReal ? 'GPS Réel' : d.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DriversPage({ allDrivers, isMobile }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '24px' }}>
      <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Chauffeurs actifs</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {allDrivers.map(driver => (
          <div key={driver.id} style={{ background: '#111c2e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, #14D3C4, #4DA3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: 'white', flexShrink: 0, position: 'relative' }}>
              {driver.isReal ? '📍' : driver.name.split(' ').map(n => n[0]).join('')}
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%', background: driver.onTime ? '#22c55e' : '#f59e0b', border: '2px solid #111c2e' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>{driver.isReal ? '🟢 GPS Réel' : driver.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>{driver.route} · {driver.stops} arrêts</div>
            </div>
            <span style={{ background: driver.onTime ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: driver.onTime ? '#22c55e' : '#f59e0b', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px' }}>
              {driver.onTime ? 'À l\'heure' : '+8 min ⚠'}
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '24px' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Activité récente</div>
        {MOCK_ACTIVITY.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', padding: '12px', background: '#111c2e', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, background: 'rgba(20,211,196,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>{item.icon}</div>
            <div>
              <div style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>{item.text}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '2px' }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PassengersPage({ isMobile }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '24px' }}>
      <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Passagers — Aujourd'hui</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {PASSENGERS.map((p, i) => (
          <div key={i} style={{ background: '#111c2e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(20,211,196,0.15)', border: '1.5px solid rgba(20,211,196,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14D3C4', fontWeight: '700', fontSize: '13px', flexShrink: 0 }}>
              {p.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>{p.name} {p.notes}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.addr} · Route {p.route}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
              <span style={{ background: p.status === 'dropped' ? 'rgba(20,211,196,0.1)' : p.status === 'onboard' ? 'rgba(77,163,255,0.1)' : 'rgba(245,158,11,0.1)', color: p.status === 'dropped' ? '#14D3C4' : p.status === 'onboard' ? '#4DA3FF' : '#f59e0b', fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px' }}>
                {p.status === 'dropped' ? 'Déposé ✓' : p.status === 'onboard' ? 'En route' : 'À venir'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>📱 {p.sms} SMS</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SMSPage({ isMobile }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '24px' }}>
      <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Journal SMS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[{ num: 47, label: 'Envoyés', color: '#14D3C4' }, { num: '100%', label: 'Livrés', color: '#22c55e' }, { num: 3, label: 'Retards', color: '#f59e0b' }].map((s, i) => (
          <div key={i} style={{ background: '#111c2e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
            <div style={{ color: s.color, fontSize: '22px', fontWeight: '800' }}>{s.num}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {SMS_LOG.map((sms, i) => (
          <div key={i} style={{ background: '#111c2e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>{sms.type}</span>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>{sms.name}</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>{sms.time}</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', lineHeight: '1.5', marginBottom: '6px' }}>{sms.msg}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>📞 {sms.phone}</span>
              <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: '600' }}>✓ Livré</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HistoryPage({ isMobile }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '24px' }}>
      <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Historique des trajets</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {HISTORY.map((row, i) => (
          <div key={i} style={{ background: '#111c2e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <div style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>{row.route}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>{row.driver} · {row.date}</div>
              </div>
              <span style={{ background: row.ok ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: row.ok ? '#22c55e' : '#f59e0b', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px' }}>
                {row.ok ? 'Complété ✓' : '+12 min ⚠'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>👥 {row.pass} passagers</span>
              <span style={{ color: '#14D3C4', fontSize: '12px', fontWeight: '600' }}>📱 {row.sms} SMS</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───

export default function AdminMap() {
  const navigate = useNavigate()
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [realTrips, setRealTrips] = useState([])
  const [activePage, setActivePage] = useState('map')
  const [mapRef, setMapRef] = useState(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: MAPS_API_KEY,
    libraries: LIBRARIES
  })

  useEffect(() => {
    const q = query(collection(db, 'trips'), where('status', '==', 'active'))
    const unsub = onSnapshot(q, (snap) => {
      const trips = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setRealTrips(trips)
    })
    return unsub
  }, [])

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  const allDrivers = [
    ...realTrips.filter(t => t.currentLocation).map(t => ({
      id: t.id,
      name: 'GPS Réel',
      route: 'Route en cours',
      stops: '—',
      onTime: true,
      lat: t.currentLocation.lat,
      lng: t.currentLocation.lng,
      isReal: true,
    })),
    ...MOCK_DRIVERS
  ]

  const mapProps = { isLoaded, allDrivers, selectedDriver, setSelectedDriver, mapRef, setMapRef, isMobile }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0B1220', fontFamily: 'sans-serif', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ background: '#111c2e', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 16px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '30px', height: '30px', background: 'linear-gradient(135deg, #14D3C4, #4DA3FF)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: 'white', fontSize: '15px' }}>M</div>
          <span style={{ color: 'white', fontWeight: '700', fontSize: '16px' }}>movigo</span>
          <span style={{ background: 'rgba(20,211,196,0.1)', border: '1px solid rgba(20,211,196,0.2)', color: '#14D3C4', fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '4px' }}>ADMIN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: '600' }}>EN DIRECT</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 12px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Quitter
          </button>
        </div>
      </div>

      {!isMobile ? (
        /* ── DESKTOP ── */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Sidebar */}
          <div style={{ width: '200px', background: '#111c2e', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '16px 12px', flex: 1 }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', padding: '0 8px' }}>Navigation</div>
              {BOTTOM_TABS.map(item => (
                <div key={item.id} onClick={() => setActivePage(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '9px', fontSize: '13px', fontWeight: '600', color: activePage === item.id ? '#14D3C4' : 'rgba(255,255,255,0.45)', background: activePage === item.id ? 'rgba(20,211,196,0.1)' : 'transparent', cursor: 'pointer', marginBottom: '2px' }}>
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.id === 'map' && <span style={{ marginLeft: 'auto', background: '#14D3C4', color: '#0B1220', fontSize: '10px', fontWeight: '800', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{allDrivers.length}</span>}
                </div>
              ))}
            </div>
            <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { num: allDrivers.length, label: 'Actifs' },
                  { num: 48, label: 'Passagers' },
                  { num: allDrivers.filter(d => d.onTime).length, label: "À l'heure" },
                  { num: allDrivers.filter(d => !d.onTime).length, label: 'Retard' }
                ].map((s, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                    <div style={{ color: i === 3 && s.num > 0 ? '#f59e0b' : '#14D3C4', fontSize: '18px', fontWeight: '800' }}>{s.num}</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Desktop content */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {activePage === 'map' && (
              <>
                <MapView {...mapProps} />
                <div style={{ width: '280px', background: '#111c2e', borderLeft: '1px solid rgba(255,255,255,0.07)', overflow: 'auto', padding: '14px 16px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Chauffeurs actifs</div>
                  {allDrivers.map(driver => (
                    <div key={driver.id} onClick={() => { setSelectedDriver(driver); mapRef?.panTo({ lat: driver.lat, lng: driver.lng }); mapRef?.setZoom(15) }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #14D3C4, #4DA3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'white', flexShrink: 0, position: 'relative' }}>
                        {driver.isReal ? '📍' : driver.name.split(' ').map(n => n[0]).join('')}
                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '8px', height: '8px', borderRadius: '50%', background: driver.onTime ? '#22c55e' : '#f59e0b', border: '2px solid #111c2e' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>{driver.isReal ? '🟢 GPS Réel' : driver.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>{driver.route} · {driver.stops}</div>
                      </div>
                      <span style={{ color: driver.onTime ? '#22c55e' : '#f59e0b', fontSize: '12px' }}>{driver.onTime ? '✓' : '⚠'}</span>
                    </div>
                  ))}
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '16px 0 10px' }}>Activité récente</div>
                  {MOCK_ACTIVITY.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, background: 'rgba(20,211,196,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>{item.icon}</div>
                      <div>
                        <div style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>{item.text}</div>
                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '1px' }}>{item.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {activePage === 'drivers' && <DriversPage allDrivers={allDrivers} isMobile={isMobile} />}
            {activePage === 'passengers' && <PassengersPage isMobile={isMobile} />}
            {activePage === 'sms' && <SMSPage isMobile={isMobile} />}
            {activePage === 'history' && <HistoryPage isMobile={isMobile} />}
          </div>
        </div>
      ) : (
        /* ── MOBILE ── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: '64px' }}>
            {activePage === 'map' && <MapView {...mapProps} />}
            {activePage === 'drivers' && <DriversPage allDrivers={allDrivers} isMobile={isMobile} />}
            {activePage === 'passengers' && <PassengersPage isMobile={isMobile} />}
            {activePage === 'sms' && <SMSPage isMobile={isMobile} />}
            {activePage === 'history' && <HistoryPage isMobile={isMobile} />}
          </div>

          {/* Bottom tab bar */}
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '64px', background: '#111c2e', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', zIndex: 100 }}>
            {BOTTOM_TABS.map(tab => (
              <div key={tab.id} onClick={() => setActivePage(tab.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', cursor: 'pointer', padding: '8px 0', position: 'relative' }}>
                <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: '9px', fontWeight: '600', color: activePage === tab.id ? '#14D3C4' : 'rgba(255,255,255,0.35)' }}>{tab.label}</span>
                {activePage === tab.id && (
                  <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '24px', height: '2px', background: '#14D3C4', borderRadius: '0 0 2px 2px' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}