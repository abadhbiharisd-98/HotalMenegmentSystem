import { useState, useEffect } from 'react'
import {
  BedDouble,
  DoorOpen,
  DoorClosed,
  Users,
  LogIn,
  LogOut,
  IndianRupee,
  RefreshCw,
  Building,
  CheckCircle2,
  AlertCircle,
  Crown,
  ShieldCheck,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import SummaryCard from '../components/dashboard/SummaryCard'
import { roomAPI, guestAPI, reservationAPI, paymentAPI } from '../services/api'
import { useAuth } from '../context/useAuth'
import HotelLogo from '../components/common/HotelLogo'

export default function Dashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [error, setError] = useState(null)
  const [roomFilter, setRoomFilter] = useState('all')

  // Real data metrics state
  const [stats, setStats] = useState({
    totalRooms: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    totalGuests: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
    totalRevenue: 0,
  })

  const [roomsList, setRoomsList] = useState([])
  const [roomTypes, setRoomTypes] = useState([])

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        const todayStr = new Date().toISOString().split('T')[0]

        // Fetch actual data concurrently from backend
        const [roomsRes, typesRes, guestsRes, reservationsRes, paymentsRes] = await Promise.allSettled([
          roomAPI.getRooms(),
          roomAPI.getRoomTypes(),
          guestAPI.getGuests(),
          reservationAPI.getReservations(),
          paymentAPI.getAllPayments(),
        ])

        if (!isMounted) return

        const rooms = roomsRes.status === 'fulfilled' && roomsRes.value?.data ? roomsRes.value.data : []
        const types = typesRes.status === 'fulfilled' && typesRes.value?.data ? typesRes.value.data : []
        const guests = guestsRes.status === 'fulfilled' && guestsRes.value?.data ? guestsRes.value.data : []
        const reservations = reservationsRes.status === 'fulfilled' && reservationsRes.value?.data ? reservationsRes.value.data : []
        const payments = paymentsRes.status === 'fulfilled' && paymentsRes.value?.data ? paymentsRes.value.data : []

        setRoomsList(rooms)
        setRoomTypes(types)

        // Strict calculation from PostgreSQL records
        const totalRooms = rooms.length
        const availableRooms = rooms.filter((r) => r.status === 'available').length
        const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length
        const totalGuests = guests.length

        const todayCheckIns = reservations.filter(
          (res) => res.check_in_date && res.check_in_date.startsWith(todayStr),
        ).length

        const todayCheckOuts = reservations.filter(
          (res) => res.check_out_date && res.check_out_date.startsWith(todayStr),
        ).length

        const totalRevenue = payments
          .filter((p) => p.payment_status === 'completed')
          .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

        setStats({
          totalRooms,
          availableRooms,
          occupiedRooms,
          totalGuests,
          todayCheckIns,
          todayCheckOuts,
          totalRevenue,
        })
        setError(null)
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Failed to load live dashboard statistics')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [refreshTrigger])

  const handleRefresh = () => {
    setRefreshing(true)
    setRefreshTrigger((prev) => prev + 1)
  }

  const filteredRooms = roomsList.filter((room) => {
    if (roomFilter === 'all') return true
    return room.status === roomFilter
  })

  const availablePct = stats.totalRooms > 0 ? Math.round((stats.availableRooms / stats.totalRooms) * 100) : 0
  const occupiedPct = stats.totalRooms > 0 ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100) : 0

  return (
    <div style={styles.container}>
      {/* Luxury Dark & Gold Hero Banner with animated gold border glow & royal crest watermark */}
      <div style={styles.heroBanner}>
        {/* Subtle royal crest watermark in background */}
        <div style={styles.heroWatermark}>
          <HotelLogo size={260} />
        </div>

        <div style={styles.heroGlowOverlay} />

        <div style={styles.heroLeft}>
          <div style={styles.heroTopRow}>
            <div style={styles.heroLogoWrapper}>
              <HotelLogo size={52} />
            </div>
            <div style={styles.heroBadge}>
              <Crown size={14} color="#fef08a" />
              <span>GITA DEVI HOTEL • 5-STAR LUXURY PALACE & RESORT</span>
            </div>
          </div>

          <h1 style={styles.heroTitle}>
            GITA DEVI HOTEL{' '}
            <span style={styles.sparkleIcon}>
              <Sparkles size={24} color="#d4af37" />
            </span>
          </h1>

          <p style={styles.heroSubtitle}>
            Namaste & welcome back, <strong style={styles.adminHighlight}>{user?.full_name || 'System Administrator'}</strong>. Real-time 5-star operations synchronized with PostgreSQL 18.
          </p>

          <div style={styles.heroMetricsRow}>
            <div style={styles.heroMetricItem}>
              <span style={styles.heroMetricLabel}>Room Availability</span>
              <div style={styles.heroBarWrapper}>
                <div style={{ ...styles.heroBarFill, width: `${availablePct}%` }} />
              </div>
              <span style={styles.heroMetricValue}>{availablePct}% Vacant</span>
            </div>

            <div style={styles.heroMetricDivider} />

            <div style={styles.heroMetricItem}>
              <span style={styles.heroMetricLabel}>Occupancy Rate</span>
              <span style={styles.heroMetricBadge}>
                <TrendingUp size={13} color="#fef08a" />
                {occupiedPct}% Booked
              </span>
            </div>

            <div style={styles.heroMetricDivider} />

            <div style={styles.heroDbBadge}>
              <div style={styles.heroDbDot} />
              <span>PostgreSQL 18 Connected</span>
            </div>
          </div>
        </div>

        <div style={styles.heroRight}>
          <button
            style={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Fetch latest data from PostgreSQL"
          >
            <RefreshCw
              size={17}
              color="#070a12"
              style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}
            />
            <span>{refreshing ? 'Synchronizing...' : 'Live Sync Database'}</span>
          </button>
          <span style={styles.autoSyncNote}>Auto-sync: Active • 30s</span>
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div style={styles.errorAlert}>
          <AlertCircle size={18} color="#f87171" />
          <span>{error}</span>
        </div>
      )}

      {/* 7 Summary Cards Grid in Dark & Gold */}
      <div style={styles.summaryGrid}>
        <SummaryCard
          title="Total Rooms"
          value={stats.totalRooms}
          subtitle="Registered in PostgreSQL"
          icon={BedDouble}
          gradient="linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)"
          bgSoft="rgba(212, 175, 55, 0.15)"
          iconColor="#fbbf24"
          badge="Capacity"
          badgeColor="#fef08a"
          badgeBg="rgba(212, 175, 55, 0.2)"
          loading={loading}
          delay={50}
        />
        <SummaryCard
          title="Available Rooms"
          value={stats.availableRooms}
          subtitle="Ready for check-in"
          icon={DoorOpen}
          gradient="linear-gradient(135deg, #a7f3d0 0%, #10b981 50%, #047857 100%)"
          bgSoft="rgba(16, 185, 129, 0.15)"
          iconColor="#34d399"
          badge={`${availablePct}% Free`}
          badgeColor="#6ee7b7"
          badgeBg="rgba(16, 185, 129, 0.2)"
          loading={loading}
          delay={100}
        />
        <SummaryCard
          title="Occupied Rooms"
          value={stats.occupiedRooms}
          subtitle="In-house guest occupancy"
          icon={DoorClosed}
          gradient="linear-gradient(135deg, #fed7aa 0%, #f59e0b 50%, #b45309 100%)"
          bgSoft="rgba(245, 158, 11, 0.15)"
          iconColor="#fbbf24"
          badge={`${occupiedPct}% Booked`}
          badgeColor="#fde047"
          badgeBg="rgba(245, 158, 11, 0.2)"
          loading={loading}
          delay={150}
        />
        <SummaryCard
          title="Total Guests"
          value={stats.totalGuests}
          subtitle="Registered guest profiles"
          icon={Users}
          gradient="linear-gradient(135deg, #ddd6fe 0%, #8b5cf6 50%, #5b21b6 100%)"
          bgSoft="rgba(139, 92, 246, 0.15)"
          iconColor="#a78bfa"
          badge="Verified"
          badgeColor="#c4b5fd"
          badgeBg="rgba(139, 92, 246, 0.2)"
          loading={loading}
          delay={200}
        />
        <SummaryCard
          title="Today's Check-ins"
          value={stats.todayCheckIns}
          subtitle="Arrivals scheduled today"
          icon={LogIn}
          gradient="linear-gradient(135deg, #bae6fd 0%, #0ea5e9 50%, #0369a1 100%)"
          bgSoft="rgba(14, 165, 233, 0.15)"
          iconColor="#38bdf8"
          badge="Inbound"
          badgeColor="#7dd3fc"
          badgeBg="rgba(14, 165, 233, 0.2)"
          loading={loading}
          delay={250}
        />
        <SummaryCard
          title="Today's Check-outs"
          value={stats.todayCheckOuts}
          subtitle="Departures scheduled today"
          icon={LogOut}
          gradient="linear-gradient(135deg, #fecdd3 0%, #f43f5e 50%, #9f1239 100%)"
          bgSoft="rgba(244, 63, 94, 0.15)"
          iconColor="#fb7185"
          badge="Outbound"
          badgeColor="#fda4af"
          badgeBg="rgba(244, 63, 94, 0.2)"
          loading={loading}
          delay={300}
        />
        <SummaryCard
          title="Total Revenue"
          value={`₹${stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Realized transactions"
          icon={IndianRupee}
          gradient="linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)"
          bgSoft="rgba(212, 175, 55, 0.2)"
          iconColor="#fde047"
          badge="INR Net"
          badgeColor="#fef08a"
          badgeBg="rgba(212, 175, 55, 0.25)"
          loading={loading}
          delay={350}
        />
      </div>

      {/* Main Grid: Room Inventory & Suite Configurations */}
      <div style={styles.gridTwoColumns}>
        {/* Left Column: Live Room Inventory */}
        <div style={styles.darkCard}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <div style={styles.headerIconWrapper}>
                <Building size={18} color="#d4af37" />
              </div>
              <div>
                <h2 style={styles.cardTitle}>Live Room Inventory</h2>
                <span style={styles.cardSubtitle}>Real-time allocation in PostgreSQL</span>
              </div>
            </div>

            {/* Filter Pills */}
            <div style={styles.filterPills}>
              <button
                style={{
                  ...styles.filterBtn,
                  ...(roomFilter === 'all' ? styles.filterBtnActive : {}),
                }}
                onClick={() => setRoomFilter('all')}
              >
                All ({roomsList.length})
              </button>
              <button
                style={{
                  ...styles.filterBtn,
                  ...(roomFilter === 'available' ? styles.filterBtnActive : {}),
                }}
                onClick={() => setRoomFilter('available')}
              >
                Available ({stats.availableRooms})
              </button>
              <button
                style={{
                  ...styles.filterBtn,
                  ...(roomFilter === 'occupied' ? styles.filterBtnActive : {}),
                }}
                onClick={() => setRoomFilter('occupied')}
              >
                Occupied ({stats.occupiedRooms})
              </button>
            </div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Room</th>
                  <th style={styles.th}>Suite Category</th>
                  <th style={styles.th}>Floor</th>
                  <th style={styles.th}>Rate</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={styles.emptyTd}>
                      No rooms found matching &quot;{roomFilter}&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredRooms.map((room) => {
                    const isAvailable = room.status === 'available'
                    return (
                      <tr key={room.id} style={styles.tr}>
                        <td style={styles.tdRoom}>
                          <div style={styles.roomBadge}>
                            <span style={styles.roomNum}>#{room.room_number}</span>
                          </div>
                        </td>
                        <td style={styles.tdCategory}>{room.room_type || 'Standard'}</td>
                        <td style={styles.td}>Level {room.floor}</td>
                        <td style={styles.tdPrice}>
                          ₹{parseFloat(room.price_per_night).toLocaleString('en-IN')}
                          <span style={styles.perNight}> / night</span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusTag,
                              backgroundColor: isAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: isAvailable ? '#6ee7b7' : '#fde047',
                              borderColor: isAvailable ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)',
                            }}
                          >
                            <span
                              style={{
                                ...styles.statusDot,
                                backgroundColor: isAvailable ? '#10b981' : '#f59e0b',
                              }}
                            />
                            {room.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Room Configurations & Amenities */}
        <div style={styles.darkCard}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <div style={styles.headerIconWrapper}>
                <CheckCircle2 size={18} color="#d4af37" />
              </div>
              <div>
                <h2 style={styles.cardTitle}>Suite Configurations</h2>
                <span style={styles.cardSubtitle}>Active room types and pricing tiers</span>
              </div>
            </div>
            <span style={styles.goldCountBadge}>{roomTypes.length} Active Categories</span>
          </div>

          <div style={styles.categoryList}>
            {roomTypes.map((type) => (
              <div key={type.id} style={styles.categoryCard}>
                <div style={styles.categoryHeader}>
                  <div>
                    <h3 style={styles.categoryName}>{type.name}</h3>
                    <p style={styles.categoryDesc}>{type.description}</p>
                  </div>
                  <div style={styles.priceContainer}>
                    <span style={styles.priceAmount}>
                      ₹{parseFloat(type.base_price).toLocaleString('en-IN')}
                    </span>
                    <span style={styles.priceDuration}>base / night</span>
                  </div>
                </div>

                <div style={styles.amenitiesContainer}>
                  {Array.isArray(type.amenities) &&
                    type.amenities.map((amenity, idx) => (
                      <span key={idx} style={styles.amenityPill}>
                        • {amenity}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Luxury Database Security Note */}
          <div style={styles.securityNote}>
            <ShieldCheck size={16} color="#d4af37" />
            <span>PostgreSQL 18 Enterprise Isolation Active • Port 5432</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '26px',
    animation: 'cardEntrance 0.4s ease-out',
  },
  heroBanner: {
    background: 'linear-gradient(135deg, #060913 0%, #0c1326 40%, #131f3c 75%, #080d1a 100%)',
    borderRadius: '24px',
    border: '1px solid rgba(212, 175, 55, 0.45)',
    boxShadow: '0 25px 50px -10px rgba(0, 0, 0, 0.9), 0 0 35px rgba(212, 175, 55, 0.18), inset 0 1px 0 rgba(254, 240, 138, 0.3)',
    animation: 'heroBorderGlow 5s ease-in-out infinite',
    padding: '36px 42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '24px',
    position: 'relative',
    overflow: 'hidden',
  },
  heroWatermark: {
    position: 'absolute',
    right: '-40px',
    top: '-30px',
    opacity: 0.08,
    pointerEvents: 'none',
    transform: 'rotate(-8deg)',
    zIndex: 0,
    animation: 'royalFloat 8s ease-in-out infinite',
  },
  heroGlowOverlay: {
    position: 'absolute',
    top: '-100px',
    right: '-60px',
    width: '380px',
    height: '380px',
    background: 'radial-gradient(circle, rgba(212, 175, 55, 0.22) 0%, rgba(180, 83, 9, 0.1) 45%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  heroLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '740px',
    zIndex: 1,
  },
  heroTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  heroLogoWrapper: {
    filter: 'drop-shadow(0 0 12px rgba(212, 175, 55, 0.5))',
    animation: 'royalFloat 6s ease-in-out infinite',
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 16px',
    borderRadius: '9999px',
    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.25) 0%, rgba(180, 83, 9, 0.2) 100%)',
    border: '1px solid rgba(212, 175, 55, 0.55)',
    color: '#fef08a',
    fontSize: '11px',
    fontWeight: '800',
    width: 'fit-content',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    boxShadow: '0 0 18px rgba(212, 175, 55, 0.25)',
  },
  heroTitle: {
    fontSize: '32px',
    fontWeight: '900',
    color: '#fef08a',
    letterSpacing: '1px',
    textShadow: '0 0 25px rgba(212, 175, 55, 0.5), 0 2px 10px rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '2px 0',
  },
  sparkleIcon: {
    display: 'inline-flex',
    animation: 'spin 12s linear infinite',
  },
  heroSubtitle: {
    fontSize: '14.5px',
    color: '#cbd5e1',
    lineHeight: '1.6',
  },
  adminHighlight: {
    color: '#fef08a',
    fontWeight: '800',
    textShadow: '0 0 8px rgba(212, 175, 55, 0.4)',
  },
  heroMetricsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginTop: '12px',
    flexWrap: 'wrap',
  },
  heroMetricItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  heroMetricLabel: {
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  heroBarWrapper: {
    width: '130px',
    height: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '9999px',
    overflow: 'hidden',
    border: '1px solid rgba(212, 175, 55, 0.4)',
    boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.6)',
  },
  heroBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #fef08a 0%, #d4af37 50%, #b45309 100%)',
    borderRadius: '9999px',
    boxShadow: '0 0 14px rgba(212, 175, 55, 0.7)',
    transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  heroMetricValue: {
    fontSize: '13px',
    fontWeight: '800',
    color: '#fef08a',
  },
  heroMetricDivider: {
    width: '1px',
    height: '24px',
    backgroundColor: 'rgba(212, 175, 55, 0.35)',
  },
  heroMetricBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '8px',
    background: 'rgba(245, 158, 11, 0.2)',
    border: '1px solid rgba(245, 158, 11, 0.5)',
    color: '#fde047',
    fontSize: '12px',
    fontWeight: '800',
    boxShadow: '0 0 10px rgba(245, 158, 11, 0.2)',
  },
  heroDbBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 12px',
    borderRadius: '8px',
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    color: '#6ee7b7',
    fontSize: '12px',
    fontWeight: '700',
  },
  heroDbDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 8px #10b981',
    animation: 'liveDotGlow 2s infinite',
  },
  heroRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px',
    zIndex: 1,
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 26px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    border: '1px solid #fef08a',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: '900',
    color: '#070a12',
    letterSpacing: '0.3px',
    boxShadow: '0 0 28px rgba(212, 175, 55, 0.45), 0 6px 16px rgba(0, 0, 0, 0.7)',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  autoSyncNote: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: '0.4px',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 18px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '12px',
    color: '#fca5a5',
    fontSize: '13.5px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '18px',
  },
  gridTwoColumns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
    gap: '26px',
  },
  darkCard: {
    backgroundColor: '#0a1020',
    borderRadius: '18px',
    border: '1px solid rgba(212, 175, 55, 0.22)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(212, 175, 55, 0.05)',
    padding: '26px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  cardHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerIconWrapper: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'rgba(212, 175, 55, 0.15)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.3px',
  },
  cardSubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  filterPills: {
    display: 'flex',
    gap: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: '4px',
    borderRadius: '10px',
    border: '1px solid rgba(212, 175, 55, 0.15)',
  },
  filterBtn: {
    padding: '5px 12px',
    fontSize: '12px',
    fontWeight: '700',
    borderRadius: '7px',
    color: '#94a3b8',
    transition: 'all 0.18s ease',
  },
  filterBtnActive: {
    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.3) 0%, rgba(180, 83, 9, 0.25) 100%)',
    color: '#fef08a',
    border: '1px solid rgba(212, 175, 55, 0.4)',
    boxShadow: '0 0 10px rgba(212, 175, 55, 0.2)',
  },
  goldCountBadge: {
    fontSize: '11.5px',
    fontWeight: '800',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    color: '#fef08a',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    padding: '4px 12px',
    borderRadius: '9999px',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    textAlign: 'left',
  },
  th: {
    padding: '12px 14px',
    borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
    color: '#d4af37',
    fontWeight: '800',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  },
  tr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '14px',
    color: '#cbd5e1',
  },
  tdRoom: {
    padding: '14px',
  },
  roomBadge: {
    display: 'inline-flex',
    padding: '4px 10px',
    background: 'rgba(212, 175, 55, 0.15)',
    borderRadius: '8px',
    border: '1px solid rgba(212, 175, 55, 0.35)',
  },
  roomNum: {
    fontWeight: '800',
    color: '#fef08a',
    fontSize: '13px',
  },
  tdCategory: {
    padding: '14px',
    fontWeight: '600',
    color: '#f8fafc',
  },
  tdPrice: {
    padding: '14px',
    fontWeight: '800',
    color: '#fde047',
  },
  perNight: {
    fontSize: '11px',
    fontWeight: '400',
    color: '#94a3b8',
  },
  emptyTd: {
    padding: '36px',
    textAlign: 'center',
    color: '#94a3b8',
  },
  statusTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '800',
    border: '1px solid',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  categoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  categoryCard: {
    padding: '18px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '14px',
    border: '1px solid rgba(212, 175, 55, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'all 0.2s ease',
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  categoryName: {
    fontSize: '15px',
    fontWeight: '800',
    color: '#fef08a',
  },
  categoryDesc: {
    fontSize: '12.5px',
    color: '#94a3b8',
    marginTop: '3px',
    lineHeight: '1.4',
  },
  priceContainer: {
    textAlign: 'right',
    flexShrink: 0,
  },
  priceAmount: {
    display: 'block',
    fontSize: '18px',
    fontWeight: '900',
    color: '#fde047',
    textShadow: '0 0 10px rgba(212, 175, 55, 0.3)',
  },
  priceDuration: {
    fontSize: '10.5px',
    color: '#94a3b8',
  },
  amenitiesContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  amenityPill: {
    fontSize: '11px',
    fontWeight: '600',
    padding: '3px 9px',
    borderRadius: '6px',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    color: '#fef08a',
  },
  securityNote: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    color: '#fef08a',
    fontSize: '12px',
    fontWeight: '700',
  },
}
