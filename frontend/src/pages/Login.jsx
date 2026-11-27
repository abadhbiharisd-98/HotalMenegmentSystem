import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import HotelLogo from '../components/common/HotelLogo'

export default function Login() {
  const [email, setEmail] = useState('admin@hotel.com')
  const [password, setPassword] = useState('Admin@1947')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectPath = location.state?.from?.pathname || '/dashboard'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login(email, password)
      navigate(redirectPath, { replace: true })
    } catch (err) {
      setError(err?.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.loginCard}>
        {/* Brand Header with Custom Royal Logo */}
        <div style={styles.header}>
          <HotelLogo size={64} showText={true} textVariant="large" />
          <span style={styles.badge}>Administrator & Staff Portal</span>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={styles.errorAlert}>
            <AlertCircle size={16} color="#f87171" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email Address</label>
            <div style={styles.inputWrapper}>
              <Mail size={18} color="#d4af37" style={styles.inputIcon} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hotel.com"
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <Lock size={18} color="#d4af37" style={styles.inputIcon} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                style={styles.input}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Footer Note */}
        <div style={styles.footerNote}>
          <span>Secured with PostgreSQL 18 & Enterprise JWT Encryption</span>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#070a12',
    backgroundImage: `
      radial-gradient(circle at 50% 20%, rgba(212, 175, 55, 0.12) 0%, transparent 60%),
      linear-gradient(180deg, #070a12 0%, #0a0f1d 100%)
    `,
    padding: '20px',
  },
  loginCard: {
    width: '100%',
    maxWidth: '430px',
    backgroundColor: '#0f172a',
    borderRadius: '20px',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    padding: '40px 34px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(212, 175, 55, 0.12)',
    animation: 'cardEntrance 0.5s ease-out',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '26px',
  },
  logoBadge: {
    width: '60px',
    height: '60px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 0 20px rgba(212, 175, 55, 0.4)',
  },
  title: {
    fontSize: '22px',
    fontWeight: '900',
    color: '#fef08a',
    letterSpacing: '1px',
    textShadow: '0 0 14px rgba(212, 175, 55, 0.3)',
  },
  hotelSubtitle: {
    fontSize: '13px',
    color: '#cbd5e1',
    marginTop: '4px',
  },
  badge: {
    marginTop: '8px',
    fontSize: '10.5px',
    fontWeight: '800',
    color: '#fbbf24',
    padding: '3px 10px',
    borderRadius: '9999px',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    borderRadius: '10px',
    color: '#fca5a5',
    fontSize: '13px',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#d4af37',
    letterSpacing: '0.4px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
  },
  input: {
    width: '100%',
    padding: '11px 12px 11px 40px',
    fontSize: '14px',
    borderRadius: '10px',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(7, 10, 18, 0.8)',
    color: '#f8fafc',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '13px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    color: '#070a12',
    borderRadius: '10px',
    fontSize: '14.5px',
    fontWeight: '800',
    marginTop: '8px',
    boxShadow: '0 0 20px rgba(212, 175, 55, 0.35)',
    transition: 'all 0.2s ease',
  },
  footerNote: {
    marginTop: '26px',
    textAlign: 'center',
    fontSize: '11px',
    color: '#94a3b8',
  },
}
