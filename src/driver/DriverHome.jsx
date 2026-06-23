import { useEffect, useState } from 'react'
import { auth } from '../firebase'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { getCanonicalRoute, getDriverStops } from '../data/routesRepo'

export default function DriverHome() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      if (!u) navigate('/login')
      else setUser(u)
    })
    return unsub
  }, [])

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  const route = getCanonicalRoute()
  const passengers = getDriverStops()

  return (
    <div style={{ minHeight: '100vh', background: '#0B1220', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{
        background: '#111c2e',
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.07)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, #14D3C4, #4DA3FF)',
            borderRadius: '9px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '800', color: 'white', fontSize: '18px'
          }}>M</div>
          <span style={{ color: 'white', fontWeight: '700', fontSize: '18px' }}>movigo</span>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            padding: '8px 14px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '13px',
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >Déconnexion</button>
      </div>

      <div style={{ padding: '20px', maxWidth: '480px', margin: '0 auto' }}>

        {/* Greeting */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Bonjour 👋</p>
          <h1 style={{ color: 'white', fontSize: '22px', fontWeight: '700', marginTop: '2px' }}>
            {user?.email?.split('@')[0]}
          </h1>
        </div>

        {/* Route card */}
        <div style={{
          background: 'linear-gradient(135deg, #14D3C4, #4DA3FF)',
          borderRadius: '18px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
            Trajet assigné aujourd'hui
          </p>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>
            {route.name}
          </h2>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <div style={{ color: 'white', fontSize: '24px', fontWeight: '800' }}>{passengers.length}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>Passagers</div>
            </div>
            <div>
              <div style={{ color: 'white', fontSize: '24px', fontWeight: '800' }}>{route.departureLabel}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>Départ</div>
            </div>
          </div>
        </div>

        {/* Passenger list */}
        <p style={{
          color: 'rgba(255,255,255,0.4)', fontSize: '11px',
          fontWeight: '700', letterSpacing: '0.08em',
          textTransform: 'uppercase', marginBottom: '12px'
        }}>
          Passagers — {route.name}
        </p>

        {passengers.map((p, i) => (
          <div key={p.id} style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px',
            padding: '14px 16px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '40px', height: '40px',
              borderRadius: '50%',
              background: 'rgba(20,211,196,0.15)',
              border: '2px solid rgba(20,211,196,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#14D3C4', fontWeight: '700', fontSize: '13px',
              flexShrink: 0
            }}>
              {p.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>{p.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>{p.address}</div>
              {p.notes && (
                <div style={{ color: '#f59e0b', fontSize: '11px', marginTop: '4px' }}>{p.notes}</div>
              )}
            </div>
            <div style={{
              background: 'rgba(245,158,11,0.15)',
              color: '#f59e0b',
              fontSize: '11px', fontWeight: '600',
              padding: '4px 10px', borderRadius: '8px'
            }}>À venir</div>
          </div>
        ))}

        {/* Start button */}
        <button
          onClick={() => navigate('/driver/route')}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #14D3C4, #4DA3FF)',
            border: 'none',
            borderRadius: '16px',
            padding: '18px',
            fontSize: '16px',
            fontWeight: '800',
            color: 'white',
            cursor: 'pointer',
            marginTop: '8px',
            fontFamily: 'inherit',
            boxShadow: '0 8px 24px rgba(20,211,196,0.25)'
          }}
        >
          🚌 &nbsp;Démarrer le trajet
        </button>

      </div>
    </div>
  )
}