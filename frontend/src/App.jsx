import { useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import Display from './components/AdminDashboard.jsx'
import HotelInfo from './components/HotelInfo.jsx'
import { auth, db, googleProvider } from './Firebase.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true)
      setAuthError('')

      if (!firebaseUser) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        const userRef = doc(db, 'users', firebaseUser.uid)
        const snapshot = await getDoc(userRef)
        let data

        if (snapshot.exists()) {
          data = snapshot.data()
        } else {
          const isGoogleUser = firebaseUser.providerData.some(
            (provider) => provider.providerId === 'google.com'
          )

          if (isGoogleUser) {
            data = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Customer',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || '',
              role: 'customer',
              createdAt: serverTimestamp(),
            }
            await setDoc(userRef, data)
          } else {
            await signOut(auth)
            setAuthError('Your account profile was not found. Please sign up again.')
            setUser(null)
            setProfile(null)
            setLoading(false)
            return
          }
        }

        const normalizedRole = String(data.role || '').toLowerCase()

        if (!['customer', 'admin'].includes(normalizedRole)) {
          await signOut(auth)
          setAuthError('Your account has no valid customer or admin role.')
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        setUser(firebaseUser)
        setProfile({
          ...data,
          uid: firebaseUser.uid,
          email: firebaseUser.email || data.email || '',
          name: data.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Customer',
          role: normalizedRole,
        })
      } catch (error) {
        console.error('Authentication state error:', error)
        await signOut(auth).catch(() => {})
        setUser(null)
        setProfile(null)
        setAuthError('Unable to load your account profile. Please try again.')
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  async function handleLogin(email, password) {
    setAuthError('')
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }

  async function handleGoogleLogin() {
    setAuthError('')
    await signInWithPopup(auth, googleProvider)
  }

  async function handleSignup({ name, email, password }) {
    setAuthError('')
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)

    await updateProfile(credential.user, {
      displayName: name.trim(),
    })

    await setDoc(doc(db, 'users', credential.user.uid), {
      uid: credential.user.uid,
      name: name.trim(),
      email: credential.user.email || email.trim(),
      photoURL: credential.user.photoURL || '',
      role: 'customer',
      createdAt: serverTimestamp(),
    })
  }

  async function handleLogout() {
    await signOut(auth)
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <div className="spinner-border text-warning mb-3" role="status" />
          <div className="fw-semibold">Loading...</div>
        </div>
      </div>
    )
  }

  if (user && profile && profile.role === 'admin') {
    return <Display user={profile} onLogout={handleLogout} />
  }

  return (
    <HotelInfo
      user={user && profile ? profile : null}
      onLogin={handleLogin}
      onGoogleLogin={handleGoogleLogin}
      onSignup={handleSignup}
      authError={authError}
      onLogout={handleLogout}
    />
  )
}