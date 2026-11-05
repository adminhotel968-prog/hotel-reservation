import { useState, useEffect } from 'react'

export default function LoginModal({ onLogin, onGoogleLogin, onSignup, authError, onClose }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape' && onClose) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function submit(event) {
    event.preventDefault()
    setError('')

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        await onSignup({ name, email, password })
      } else {
        await onLogin(email, password)
      }
    } catch (err) {
      console.error(err)
      setError(getFirebaseMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function googleLogin() {
    setError('')
    setLoading(true)
    try {
      await onGoogleLogin()
    } catch (err) {
      console.error(err)
      setError(getFirebaseMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center px-3 py-4"
      style={{ zIndex: 3000, background: 'rgba(8, 22, 22, 0.72)', overflowY: 'auto' }}
      onClick={onClose}
    >
      <div
        className="card border-0 shadow-lg overflow-hidden my-auto"
        style={{ maxWidth: 900, width: '100%', borderRadius: 18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row g-0">
          <div className="col-lg-5 d-none d-lg-flex flex-column justify-content-end p-5 text-white" style={{ minHeight: 560, background: 'linear-gradient(rgba(0,0,0,.15),rgba(0,0,0,.72)), url(https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=80) center/cover' }}>
            <span className="text-uppercase small fw-bold" style={{ letterSpacing: 2 }}>BONGABONG VIEW HOTEL AND BISTRO</span>
            <h1 className="display-6 fw-bold">Stay comfortable. Reserve with ease.</h1>

            <p className="mb-0">Clean rooms, simple booking, and a comfortable stay in BONGABONG.</p>
          </div>

          <div className="col-lg-7 bg-white p-4 p-md-5 position-relative">
            {onClose && (
              <button
                type="button"
                className="btn-close position-absolute top-0 end-0 m-3"
                aria-label="Close"
                onClick={onClose}
              />
            )}

            <div className="mb-4">
              <div className="fw-bold small text-uppercase" style={{ color: '#9a7430' }}>BONGABONG VIEW HOTEL AND BISTRO </div>
              <h2 className="fw-bold mb-1">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
              <p className="text-muted mb-0">{mode === 'login' ? 'Sign in to manage your room reservations.' : 'Create a customer account to reserve a room.'}</p>
            </div>

            {(error || authError) && (
              <div className="alert alert-danger py-2 small">{error || authError}</div>
            )}

            <form onSubmit={submit}>
              {mode === 'signup' && (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Full Name</label>
                  <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Juan Dela Cruz" />
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold">Email Address</label>
                <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@example.com" />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Password</label>
                <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
              </div>

              {mode === 'signup' && (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Confirm Password</label>
                  <input type="password" className="form-control" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
                </div>
              )}

              <button
                className="btn w-100 py-2 fw-semibold"
                style={{ backgroundColor: '#10292a', borderColor: '#10292a', color: '#d8b46a' }}
                disabled={loading}
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Customer Account'}
              </button>
            </form>

            <div className="d-flex align-items-center gap-2 my-3">
              <hr className="flex-grow-1" /><span className="small text-muted">OR</span><hr className="flex-grow-1" />
            </div>

            <button type="button" className="btn btn-outline-dark w-100 py-2 fw-semibold" onClick={googleLogin} disabled={loading}>
              Continue with Google
            </button>

            <div className="text-center mt-4 small">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button type="button" className="btn btn-link p-0 text-decoration-none fw-semibold" style={{ color: '#9a7430' }} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </div>

            <div className="text-center text-muted small mt-3">New accounts are created as customer accounts.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getFirebaseMessage(error) {
  const code = error?.code || ''
  const messages = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/invalid-login-credentials': 'Incorrect email or password.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in popup.',
    'auth/network-request-failed': 'Network error. Please check your internet connection.',
  }
  return messages[code] || error?.message || 'Authentication failed. Please try again.'
}