import { useState, useEffect } from 'react'
import { Menu, Bell, Crown, Clock, CheckCircle } from 'lucide-react'
import { healthAPI } from '../../services/api'
import { useAuth } from '../../context/useAuth'
import HotelLogo from '../common/HotelLogo'

export default function Navbar({ onToggleSidebar }) {
  const { user } = useAuth()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [dbHealthy, setDbHealthy] = useState(true)

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Health status check
  useEffect(() => {
    let isMounted = true
    const checkHealth = async () => {
      try {
        const res = await healthAPI.checkHealth()
        if (isMounted) setDbHealthy(res?.database?.connected ?? true)
      } catch {
        if (isMounted) setDbHealthy(false)
      }
    }
    checkHealth()
    const healthInterval = setInterval(checkHealth, 30000)
    return () => {
      isMounted = false
      clearInterval(healthInterval)
    }
  }, [])

  return (
    <header style={styles.header}>
      <div style={styles.leftSection}>
        <button style={styles.menuBtn} onClick={onToggleSidebar} aria-label="Toggle Menu">
          <Menu size={20} color="#d4af37" />
        </button>
        <div style={styles.breadcrumb}>
          <div style={styles.hotelPill}>
            <HotelLogo size={26} />
            <span style={styles.hotelName}>GITA DEVI HOTEL</span>
          </div>
          <span style={styles.breadcrumbDivider}>›</span>
          <span style={styles.breadcrumbCurrent}>Operations Dashboard</span>
        </div>
      </div>

      <div style={styles.rightSection}>
        {/* Live Date and Time in Gold digital styling */}
        <div style={styles.timeBadge}>
          <Clock size={14} color="#d4af37" />
          <span style={styles.timeText}>
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}{' '}
            • {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Database Health Badge with live glowing pulse */}
        <div
          style={{
            ...styles.statusBadge,
            backgroundColor: dbHealthy ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)',
            borderColor: dbHealthy ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
            color: dbHealthy ? '#6ee7b7' : '#fca5a5',
          }}
          title={dbHealthy ? 'PostgreSQL 18 Connected on Port 5432' : 'Database disconnected'}
        >
          <div
            style={{
              ...styles.statusDot,
              backgroundColor: dbHealthy ? '#10b981' : '#ef4444',
              animation: dbHealthy ? 'liveDotGlow 2s infinite' : 'none',
            }}
          />
          <span>{dbHealthy ? 'DB Active' : 'DB Offline'}</span>
          {dbHealthy && <CheckCircle size={13} color="#10b981" />}
        </div>

        {/* Notification Bell */}
        <div style={styles.notificationBtn} title="System Notifications">
          <Bell size={17} color="#d4af37" />
          <div style={styles.notificationDot} />
        </div>

        {/* Admin Profile Pill with Gold Ring */}
        <div style={styles.profilePill}>
          <div style={styles.profileAvatar}>
            <Crown size={15} color="#070a12" />
          </div>
          <div style={styles.profileText}>
            <span style={styles.profileName}>{user?.full_name || 'Administrator'}</span>
            <span style={styles.profileRole}>{(user?.role || 'admin').toUpperCase()}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

const styles = {
  header: {
    height: '70px',
    backgroundColor: 'rgba(9, 13, 23, 0.94)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(212, 175, 55, 0.22)',
    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 15px rgba(212, 175, 55, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 28px',
    position: 'sticky',
    top: 0,
    zIndex: 30,
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  menuBtn: {
    padding: '8px',
    borderRadius: '10px',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13.5px',
  },
  hotelPill: {
    padding: '4px 12px 4px 6px',
    borderRadius: '24px',
    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(180, 83, 9, 0.15) 100%)',
    border: '1px solid rgba(212, 175, 55, 0.4)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 0 12px rgba(212, 175, 55, 0.15)',
  },
  hotelName: {
    color: '#fef08a',
    fontWeight: '800',
    fontSize: '13px',
    letterSpacing: '1px',
    textShadow: '0 0 10px rgba(212, 175, 55, 0.3)',
  },
  breadcrumbDivider: {
    color: '#d4af37',
    fontSize: '14px',
    opacity: 0.6,
  },
  breadcrumbCurrent: {
    color: '#cbd5e1',
    fontWeight: '500',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  timeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12.5px',
    fontWeight: '500',
    color: '#cbd5e1',
    backgroundColor: 'rgba(16, 23, 42, 0.8)',
    padding: '6px 14px',
    borderRadius: '9999px',
    border: '1px solid rgba(212, 175, 55, 0.25)',
  },
  timeText: {
    color: '#e2e8f0',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '5px 12px',
    borderRadius: '9999px',
    border: '1px solid',
    fontSize: '12px',
    fontWeight: '700',
    boxShadow: '0 0 10px rgba(16, 185, 129, 0.15)',
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
  },
  notificationBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    backgroundColor: 'rgba(16, 23, 42, 0.8)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.2s ease',
  },
  notificationDot: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#f59e0b',
    boxShadow: '0 0 6px #f59e0b',
  },
  profilePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '4px 12px 4px 6px',
    borderRadius: '9999px',
    backgroundColor: 'rgba(16, 23, 42, 0.9)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    boxShadow: '0 0 12px rgba(212, 175, 55, 0.15)',
  },
  profileAvatar: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 8px rgba(212, 175, 55, 0.5)',
  },
  profileText: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: '1.2',
  },
  profileName: {
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  profileRole: {
    fontSize: '9px',
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: '0.6px',
  },
}
