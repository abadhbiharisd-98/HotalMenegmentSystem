import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import HotelLogo from '../components/common/HotelLogo'

export default function PlaceholderModule({ title, description }) {
  const navigate = useNavigate()

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <HotelLogo size={64} showText={true} />
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.description}>
          {description ||
            'This luxury module is scheduled for the next development phase. The PostgreSQL database tables and backend REST APIs are already configured and ready.'}
        </p>

        <div style={styles.metaBox}>
          <span style={styles.metaLabel}>System State:</span>
          <span style={styles.metaValue}>PostgreSQL 18 Ready • UI Pending Next Phase</span>
        </div>

        <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          <span>Back to Command Center</span>
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '40px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'cardEntrance 0.4s ease-out',
  },
  card: {
    maxWidth: '540px',
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: '20px',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(212, 175, 55, 0.1)',
    padding: '40px 32px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
  },
  iconCircle: {
    width: '68px',
    height: '68px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(212, 175, 55, 0.35)',
  },
  title: {
    fontSize: '22px',
    fontWeight: '900',
    color: '#fef08a',
  },
  description: {
    fontSize: '13.5px',
    color: '#cbd5e1',
    lineHeight: '1.6',
  },
  metaBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: '10px',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    fontSize: '12px',
  },
  metaLabel: {
    fontWeight: '700',
    color: '#d4af37',
  },
  metaValue: {
    color: '#fef08a',
    fontWeight: '600',
  },
  backBtn: {
    marginTop: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 22px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    color: '#070a12',
    borderRadius: '10px',
    fontSize: '13.5px',
    fontWeight: '800',
    boxShadow: '0 0 16px rgba(212, 175, 55, 0.3)',
  },
}
