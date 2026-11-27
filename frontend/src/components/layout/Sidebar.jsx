import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  BedDouble,
  Users,
  CalendarCheck,
  LogIn,
  CreditCard,
  FileText,
  Receipt,
  UserCheck,
  BarChart3,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import HotelLogo from '../common/HotelLogo'

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Rooms Management', path: '/rooms', icon: BedDouble },
  { name: 'Guest Management', path: '/guests', icon: Users },
  { name: 'Reservations', path: '/reservations', icon: CalendarCheck },
  { name: 'Check-in / Check-out', path: '/check-in-out', icon: LogIn },
  { name: 'Payments', path: '/payments', icon: CreditCard },
  { name: 'Invoices', path: '/invoices', icon: FileText },
  { name: 'Hotel Expenses', path: '/expenses', icon: Receipt },
  { name: 'Staff Management', path: '/staff', icon: UserCheck },
  { name: 'Reports & Analytics', path: '/reports', icon: BarChart3 },
  { name: 'Settings', path: '/settings', icon: Settings },
]

export default function Sidebar({ isOpen, onClose }) {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && <div style={styles.backdrop} onClick={onClose} />}

      <aside style={{ ...styles.sidebar, ...(isOpen ? styles.sidebarOpen : {}) }}>
        {/* Luxury Brand Header with Custom Logo */}
        <div style={styles.brandContainer}>
          <HotelLogo size={44} showText={true} />
          {onClose && (
            <button style={styles.closeBtn} onClick={onClose} aria-label="Close sidebar">
              <X size={20} color="#d4af37" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav style={styles.navContainer}>
          <div style={styles.navSectionLabel}>ROYAL PALACE MODULES</div>
          <ul style={styles.navList}>
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={() => onClose && onClose()}
                    style={({ isActive }) => ({
                      ...styles.navLink,
                      ...(isActive ? styles.navLinkActive : {}),
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <div
                          style={{
                            ...styles.iconBox,
                            backgroundColor: isActive ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            border: isActive ? '1px solid rgba(212, 175, 55, 0.4)' : '1px solid transparent',
                          }}
                        >
                          <Icon
                            size={18}
                            color={isActive ? '#fde047' : '#94a3b8'}
                          />
                        </div>
                        <span
                          style={{
                            ...styles.navText,
                            color: isActive ? '#fef08a' : '#cbd5e1',
                            fontWeight: isActive ? '700' : '500',
                          }}
                        >
                          {item.name}
                        </span>
                        {isActive && <div style={styles.activeGoldPill} />}
                      </>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Luxury Profile & Logout Footer */}
        <div style={styles.footerContainer}>
          <div style={styles.userInfo}>
            <div style={styles.avatar}>
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'G'}
            </div>
            <div style={styles.userMeta}>
              <div style={styles.userName}>{user?.full_name || 'Administrator'}</div>
              <div style={styles.userRole}>SUPER ADMIN</div>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={handleLogout} title="Logout">
            <LogOut size={16} color="#fca5a5" />
            <span style={styles.logoutText}>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 40,
    backdropFilter: 'blur(4px)',
  },
  sidebar: {
    width: '280px',
    backgroundColor: '#090d16',
    borderRight: '1px solid rgba(212, 175, 55, 0.2)',
    boxShadow: '4px 0 25px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'sticky',
    top: 0,
    zIndex: 50,
    flexShrink: 0,
    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  sidebarOpen: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
  },
  brandContainer: {
    padding: '20px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(212, 175, 55, 0.18)',
    background: 'linear-gradient(180deg, rgba(212, 175, 55, 0.08) 0%, transparent 100%)',
  },
  closeBtn: {
    display: 'none',
    padding: '4px',
  },
  navContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px 12px',
  },
  navSectionLabel: {
    fontSize: '10px',
    fontWeight: '800',
    color: '#d4af37',
    letterSpacing: '1px',
    padding: '0 10px 10px 10px',
    opacity: 0.85,
  },
  navList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 12px',
    borderRadius: '10px',
    position: 'relative',
    transition: 'all 0.18s ease',
    border: '1px solid transparent',
  },
  navLinkActive: {
    background: 'linear-gradient(90deg, rgba(212, 175, 55, 0.18) 0%, rgba(212, 175, 55, 0.04) 100%)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    boxShadow: '0 0 15px rgba(212, 175, 55, 0.08)',
  },
  iconBox: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '12px',
    flexShrink: 0,
    transition: 'all 0.18s ease',
  },
  navText: {
    fontSize: '13px',
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    letterSpacing: '0.2px',
  },
  activeGoldPill: {
    width: '4px',
    height: '18px',
    borderRadius: '4px',
    background: 'linear-gradient(180deg, #fef08a 0%, #d4af37 100%)',
    boxShadow: '0 0 8px #fef08a',
  },
  footerContainer: {
    padding: '16px',
    borderTop: '1px solid rgba(212, 175, 55, 0.18)',
    backgroundColor: 'rgba(7, 10, 18, 0.7)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    color: '#070a12',
    fontWeight: '900',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '15px',
    boxShadow: '0 0 10px rgba(212, 175, 55, 0.35)',
  },
  userMeta: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: '9px',
    fontWeight: '800',
    color: '#fde047',
    letterSpacing: '0.6px',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '9px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#fca5a5',
    fontSize: '12.5px',
    fontWeight: '700',
    transition: 'all 0.2s ease',
  },
  logoutText: {
    lineHeight: '1',
  },
}
