import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin() {
    if (!email || !password) {
      setError('Veuillez entrer votre courriel et mot de passe')
      return
    }
    setLoading(true)
    setError('')

    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const userEmail = result.user.email
      console.log('Login success:', userEmail)

      if (userEmail === 'admin@movigo.ca') {
        navigate('/admin')
      } else {
        navigate('/driver')
      }
    } catch (err) {
      console.log('Login error:', err.code)
      setError('Courriel ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B1220',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
          <div style={{
            width: '44px', height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #14D3C4, #4DA3FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: '800', color: 'white'
          }}>M</div>
          <span style={{ fontSize: '26px', fontWeight: '700', color: 'white' }}>movigo</span>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>
          Bienvenue
        </h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '36px' }}>
          Connectez-vous à votre compte
        </p>

        {/* Email */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block', marginBottom: '8px',
            fontSize: '11px', fontWeight: '600',
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.08em', textTransform: 'uppercase'
          }}>Courriel</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="vous@example.com"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '15px',
              color: 'white',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block', marginBottom: '8px',
            fontSize: '11px', fontWeight: '600',
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.08em', textTransform: 'uppercase'
          }}>Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '15px',
              color: 'white',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <p style={{
            color: '#ff4d4d', fontSize: '13px',
            marginBottom: '16px', textAlign: 'center',
            background: 'rgba(255,77,77,0.08)',
            border: '1px solid rgba(255,77,77,0.2)',
            borderRadius: '8px', padding: '10px'
          }}>
            {error}
          </p>
        )}

        {/* Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #14D3C4, #4DA3FF)',
            border: 'none',
            borderRadius: '14px',
            padding: '16px',
            fontSize: '16px',
            fontWeight: '700',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            transition: 'opacity 0.2s'
          }}
        >
          {loading ? 'Connexion...' : 'Se connecter →'}
        </button>

        <p style={{
          textAlign: 'center', marginTop: '32px',
          fontSize: '12px', color: 'rgba(255,255,255,0.2)'
        }}>
          Movigo · Transport adapté sécurisé
        </p>

      </div>
    </div>
  )
}