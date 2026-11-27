import { useState, useEffect, useMemo } from 'react'
import {
  LogIn,
  LogOut,
  Key,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  BedDouble,
  IndianRupee,
  FileText,
  X,
  ShieldCheck,
  Eye,
  DoorOpen,
  CalendarCheck,
} from 'lucide-react'
import { checkInOutAPI } from '../services/api'
import SummaryCard from '../components/dashboard/SummaryCard'

export default function CheckInOut() {
  // Navigation / Tabs: 'active' (in-house), 'eligible' (pending check-ins), 'history'
  const [activeTab, setActiveTab] = useState('active')

  // Data states
  const [activeStays, setActiveStays] = useState([])
  const [eligibleReservations, setEligibleReservations] = useState([])
  const [historyRecords, setHistoryRecords] = useState([])
  const [summaryMetrics, setSummaryMetrics] = useState({
    activeStays: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
    pendingArrivals: 0,
  })

  // Loading & Refreshing states
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('')
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all')

  // Modals state
  const [checkInModalData, setCheckInModalData] = useState(null) // reservation obj
  const [checkOutModalData, setCheckOutModalData] = useState(null) // stay obj
  const [viewFolioData, setViewFolioData] = useState(null) // stay obj

  // Form states for Check-in Modal
  const [checkInForm, setCheckInForm] = useState({
    roomKeyStatus: 'issued',
    keyNumber: '',
    idVerified: true,
    notes: '',
  })
  const [checkInSubmitting, setCheckInSubmitting] = useState(false)

  // Form states for Check-out Modal
  const [checkOutForm, setCheckOutForm] = useState({
    roomKeyStatus: 'returned',
    settleBalance: true,
    paymentMethod: 'cash',
    notes: '',
  })
  const [checkOutSubmitting, setCheckOutSubmitting] = useState(false)

  // Toast feedback
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4500)
  }

  // Fetch all live data from backend
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        const [staysRes, eligibleRes, historyRes, summaryRes] = await Promise.all([
          checkInOutAPI.getActiveStays(),
          checkInOutAPI.getEligible(),
          checkInOutAPI.getHistory(),
          checkInOutAPI.getSummary(),
        ])

        if (isMounted) {
          setActiveStays(staysRes?.data || [])
          setEligibleReservations(eligibleRes?.data || [])
          setHistoryRecords(historyRes?.data || [])
          setSummaryMetrics(
            summaryRes?.data || {
              activeStays: 0,
              todayCheckIns: 0,
              todayCheckOuts: 0,
              pendingArrivals: 0,
            }
          )
        }
      } catch (err) {
        if (isMounted) {
          showToast(err.message || 'Failed to load check-in/out records from server.', 'error')
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

  // Filtered Active Stays
  const filteredActiveStays = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return activeStays
    return activeStays.filter((stay) => {
      const name = `${stay.first_name || ''} ${stay.last_name || ''}`.toLowerCase()
      return (
        name.includes(q) ||
        (stay.phone || '').toLowerCase().includes(q) ||
        (stay.room_number || '').toLowerCase().includes(q) ||
        String(stay.reservation_id) === q ||
        String(stay.id) === q
      )
    })
  }, [activeStays, searchTerm])

  // Filtered Eligible Reservations
  const filteredEligible = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return eligibleReservations
    return eligibleReservations.filter((res) => {
      const name = `${res.first_name || ''} ${res.last_name || ''}`.toLowerCase()
      return (
        name.includes(q) ||
        (res.phone || '').toLowerCase().includes(q) ||
        (res.room_number || '').toLowerCase().includes(q) ||
        String(res.id) === q
      )
    })
  }, [eligibleReservations, searchTerm])

  // Filtered History
  const filteredHistory = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return historyRecords.filter((rec) => {
      const name = `${rec.first_name || ''} ${rec.last_name || ''}`.toLowerCase()
      const matchesSearch =
        !q ||
        name.includes(q) ||
        (rec.phone || '').toLowerCase().includes(q) ||
        (rec.room_number || '').toLowerCase().includes(q) ||
        String(rec.reservation_id) === q ||
        String(rec.id) === q

      const matchesStatus =
        historyStatusFilter === 'all' || rec.stay_status === historyStatusFilter

      return matchesSearch && matchesStatus
    })
  }, [historyRecords, searchTerm, historyStatusFilter])

  // Check-in Modal Handlers
  const openCheckInModal = (reservation) => {
    setCheckInModalData(reservation)
    setCheckInForm({
      roomKeyStatus: 'issued',
      keyNumber: `KEY-${reservation.room_number}`,
      idVerified: true,
      notes: reservation.special_requests ? `Requests: ${reservation.special_requests}` : '',
    })
  }

  const handleConfirmCheckIn = async (e) => {
    e.preventDefault()
    if (!checkInModalData) return
    if (!checkInForm.idVerified) {
      showToast('Please confirm guest identity verification before proceeding.', 'error')
      return
    }

    setCheckInSubmitting(true)
    try {
      const payload = {
        reservationId: checkInModalData.id,
        roomKeyStatus: checkInForm.roomKeyStatus,
        notes: [
          checkInForm.keyNumber ? `Key: ${checkInForm.keyNumber}` : null,
          checkInForm.notes.trim() || null,
        ]
          .filter(Boolean)
          .join(' | '),
      }

      await checkInOutAPI.checkIn(payload)
      showToast(
        `Guest ${checkInModalData.first_name} ${checkInModalData.last_name} checked into Room #${checkInModalData.room_number} successfully!`,
        'success'
      )
      setCheckInModalData(null)
      handleRefresh()
    } catch (err) {
      showToast(err.message || 'Check-in failed. Please verify room status.', 'error')
    } finally {
      setCheckInSubmitting(false)
    }
  }

  // Check-out Modal Handlers
  const openCheckOutModal = (stay) => {
    const total = parseFloat(stay.total_amount || 0)
    const paid = parseFloat(stay.total_paid || 0)
    const balance = Math.max(0, total - paid)

    setCheckOutModalData(stay)
    setCheckOutForm({
      roomKeyStatus: 'returned',
      settleBalance: balance > 0,
      paymentMethod: 'cash',
      notes: '',
    })
  }

  const handleConfirmCheckOut = async (e) => {
    e.preventDefault()
    if (!checkOutModalData) return

    const total = parseFloat(checkOutModalData.total_amount || 0)
    const paid = parseFloat(checkOutModalData.total_paid || 0)
    const balance = Math.max(0, total - paid)

    setCheckOutSubmitting(true)
    try {
      const payload = {
        checkInOutId: checkOutModalData.id,
        reservationId: checkOutModalData.reservation_id,
        roomKeyStatus: checkOutForm.roomKeyStatus,
        notes: checkOutForm.notes.trim() || null,
      }

      if (checkOutForm.settleBalance && balance > 0) {
        payload.settlePayment = balance
        payload.paymentMethod = checkOutForm.paymentMethod
      }

      await checkInOutAPI.checkOut(payload)
      showToast(
        `Guest ${checkOutModalData.first_name} ${checkOutModalData.last_name} checked out. Room #${checkOutModalData.room_number} is now Available.`,
        'success'
      )
      setCheckOutModalData(null)
      handleRefresh()
    } catch (err) {
      showToast(err.message || 'Checkout failed. Please try again.', 'error')
    } finally {
      setCheckOutSubmitting(false)
    }
  }

  // Calculate elapsed stay duration
  const formatDuration = (checkInTime) => {
    if (!checkInTime) return 'Just checked in'
    const diffMs = new Date() - new Date(checkInTime)
    if (diffMs < 0) return 'Just now'
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays > 0) {
      const remHours = diffHours % 24
      return `${diffDays}d ${remHours}h`
    }
    return `${Math.max(1, diffHours)}h in-house`
  }

  return (
    <div style={styles.container}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            backgroundColor: toast.type === 'success' ? '#064e3b' : '#7f1d1d',
            borderColor: toast.type === 'success' ? '#10b981' : '#f87171',
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} color="#34d399" />
          ) : (
            <AlertCircle size={18} color="#fca5a5" />
          )}
          <span style={styles.toastText}>{toast.message}</span>
          <button style={styles.toastClose} onClick={() => setToast(null)}>
            <X size={16} color="#ffffff" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div style={styles.headerCard}>
        <div style={styles.headerLeft}>
          <div style={styles.headerBadge}>
            <Key size={14} color="#fef08a" />
            <span>FRONT DESK OPERATIONS COMMAND</span>
          </div>
          <h1 style={styles.headerTitle}>Check-in & Check-out Hub</h1>
          <p style={styles.headerSubtitle}>
            Live in-house guest tracking, express arrival key issuance, folio payment settlement, and automated room turnover.
          </p>
        </div>

        <div style={styles.headerRight}>
          <button
            style={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Sync latest stay records from PostgreSQL"
          >
            <RefreshCw
              size={16}
              color="#d4af37"
              style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}
            />
            <span>{refreshing ? 'Syncing...' : 'Sync Live DB'}</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div style={styles.summaryGrid}>
        <SummaryCard
          title="Active In-House Stays"
          value={summaryMetrics.activeStays}
          subtitle="Currently occupied rooms"
          icon={BedDouble}
        />
        <SummaryCard
          title="Today's Check-ins"
          value={summaryMetrics.todayCheckIns}
          subtitle="Physical arrivals today"
          icon={LogIn}
        />
        <SummaryCard
          title="Today's Check-outs"
          value={summaryMetrics.todayCheckOuts}
          subtitle="Departures completed today"
          icon={LogOut}
        />
        <SummaryCard
          title="Pending Arrivals"
          value={summaryMetrics.pendingArrivals}
          subtitle="Eligible bookings ready"
          icon={CalendarCheck}
        />
      </div>

      {/* Navigation Tabs & Search Bar */}
      <div style={styles.tabBarCard}>
        <div style={styles.tabButtonsGroup}>
          <button
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'active' ? styles.tabBtnActive : {}),
            }}
            onClick={() => setActiveTab('active')}
          >
            <BedDouble size={16} color={activeTab === 'active' ? '#070a12' : '#d4af37'} />
            <span>Active In-House Guests ({activeStays.length})</span>
          </button>

          <button
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'eligible' ? styles.tabBtnActive : {}),
            }}
            onClick={() => setActiveTab('eligible')}
          >
            <LogIn size={16} color={activeTab === 'eligible' ? '#070a12' : '#d4af37'} />
            <span>Pending Arrivals ({eligibleReservations.length})</span>
          </button>

          <button
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'history' ? styles.tabBtnActive : {}),
            }}
            onClick={() => setActiveTab('history')}
          >
            <Clock size={16} color={activeTab === 'history' ? '#070a12' : '#d4af37'} />
            <span>Stays & History ({historyRecords.length})</span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div style={styles.filterControlsGroup}>
          <div style={styles.searchWrapper}>
            <Search size={16} color="#94a3b8" style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search guest, mobile, room #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            {searchTerm && (
              <button style={styles.clearSearchBtn} onClick={() => setSearchTerm('')}>
                <X size={14} color="#94a3b8" />
              </button>
            )}
          </div>

          {activeTab === 'history' && (
            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">All Stays</option>
              <option value="active">Active Only</option>
              <option value="completed">Departed Only</option>
            </select>
          )}
        </div>
      </div>

      {/* TAB CONTENT 1: ACTIVE IN-HOUSE GUESTS */}
      {activeTab === 'active' && (
        <div style={styles.tableCard}>
          <div style={styles.tableHeaderSection}>
            <div style={styles.tableHeading}>
              <BedDouble size={18} color="#d4af37" />
              <h2 style={styles.tableTitleText}>Occupied Rooms & In-House Guests</h2>
            </div>
            <span style={styles.tableSubtitleText}>
              Showing {filteredActiveStays.length} active in-house stays
            </span>
          </div>

          {loading ? (
            <div style={styles.loadingBox}>
              <RefreshCw size={24} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={styles.loadingText}>Synchronizing in-house stays from PostgreSQL...</span>
            </div>
          ) : filteredActiveStays.length === 0 ? (
            <div style={styles.emptyBox}>
              <DoorOpen size={48} color="#d4af37" style={{ opacity: 0.4 }} />
              <h3 style={styles.emptyTitle}>No In-House Guests Currently</h3>
              <p style={styles.emptyDesc}>
                All hotel rooms are vacant or departures are completed. Check the "Pending Arrivals" tab to check in arriving guests.
              </p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.th}>Room</th>
                    <th style={styles.th}>Guest Info</th>
                    <th style={styles.th}>Stay Duration</th>
                    <th style={styles.th}>Expected Checkout</th>
                    <th style={styles.th}>Folio & Balance</th>
                    <th style={styles.th}>Key Status</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActiveStays.map((stay) => {
                    const total = parseFloat(stay.total_amount || 0)
                    const paid = parseFloat(stay.total_paid || 0)
                    const balance = Math.max(0, total - paid)
                    const checkInTime = new Date(stay.actual_check_in)
                    const expectedOut = new Date(stay.check_out_date)

                    return (
                      <tr key={stay.id} style={styles.tr}>
                        {/* Room Number Badge */}
                        <td style={styles.td}>
                          <div style={styles.roomCol}>
                            <div style={styles.roomBadge}>
                              <BedDouble size={14} color="#fef08a" />
                              <span style={styles.roomBadgeText}>#{stay.room_number}</span>
                            </div>
                            <span style={styles.roomTypeSub}>{stay.room_type} (Fl {stay.floor})</span>
                          </div>
                        </td>

                        {/* Guest Details */}
                        <td style={styles.td}>
                          <div style={styles.guestCol}>
                            <span style={styles.guestName}>
                              {stay.first_name} {stay.last_name}
                            </span>
                            <span style={styles.guestPhone}>{stay.phone}</span>
                            <span style={styles.guestIdBadge}>
                              {stay.id_type}: {stay.id_number}
                            </span>
                          </div>
                        </td>

                        {/* Stay Duration */}
                        <td style={styles.td}>
                          <div style={styles.durationCol}>
                            <div style={styles.durationBadge}>
                              <Clock size={12} color="#38bdf8" />
                              <span>{formatDuration(stay.actual_check_in)}</span>
                            </div>
                            <span style={styles.dateSub}>
                              In: {checkInTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                              {checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>

                        {/* Expected Departure */}
                        <td style={styles.td}>
                          <span style={styles.expectedOutText}>
                            {expectedOut.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </td>

                        {/* Financial Folio */}
                        <td style={styles.td}>
                          <div style={styles.folioCol}>
                            <span style={styles.totalAmountVal}>
                              ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <div style={styles.balanceRow}>
                              <span style={styles.paidBadge}>Paid: ₹{paid.toLocaleString('en-IN')}</span>
                              {balance > 0 ? (
                                <span style={styles.dueBadge}>Due: ₹{balance.toLocaleString('en-IN')}</span>
                              ) : (
                                <span style={styles.settledBadge}>Settled</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Room Key Status */}
                        <td style={styles.td}>
                          <span style={styles.keyBadge}>
                            <Key size={12} color="#fef08a" />
                            <span>{stay.room_key_status || 'issued'}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <div style={styles.actionBtnsGroup}>
                            <button
                              style={styles.viewBtn}
                              onClick={() => setViewFolioData(stay)}
                              title="View Stay Folio"
                            >
                              <Eye size={15} color="#94a3b8" />
                            </button>
                            <button
                              style={styles.checkoutBtn}
                              onClick={() => openCheckOutModal(stay)}
                              title="Express Checkout & Release Room"
                            >
                              <LogOut size={14} color="#070a12" />
                              <span>Checkout</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: PENDING ARRIVALS (CHECK-IN READY) */}
      {activeTab === 'eligible' && (
        <div style={styles.tableCard}>
          <div style={styles.tableHeaderSection}>
            <div style={styles.tableHeading}>
              <LogIn size={18} color="#d4af37" />
              <h2 style={styles.tableTitleText}>Confirmed Reservations Ready for Check-in</h2>
            </div>
            <span style={styles.tableSubtitleText}>
              Showing {filteredEligible.length} pending guest arrivals
            </span>
          </div>

          {loading ? (
            <div style={styles.loadingBox}>
              <RefreshCw size={24} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={styles.loadingText}>Loading eligible reservations...</span>
            </div>
          ) : filteredEligible.length === 0 ? (
            <div style={styles.emptyBox}>
              <CalendarCheck size={48} color="#d4af37" style={{ opacity: 0.4 }} />
              <h3 style={styles.emptyTitle}>No Pending Arrivals</h3>
              <p style={styles.emptyDesc}>
                There are currently no pending arrivals waiting for check-in. New bookings created in Reservations will appear here.
              </p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.th}>Booking ID</th>
                    <th style={styles.th}>Guest Profile</th>
                    <th style={styles.th}>Assigned Room</th>
                    <th style={styles.th}>Schedule</th>
                    <th style={styles.th}>Financials</th>
                    <th style={styles.th}>Room Readiness</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Check-in Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEligible.map((res) => {
                    const total = parseFloat(res.total_amount || 0)
                    const paid = parseFloat(res.total_paid || 0)
                    const inDate = new Date(res.check_in_date)
                    const outDate = new Date(res.check_out_date)
                    const isRoomAvailable = res.room_status === 'available'

                    return (
                      <tr key={res.id} style={styles.tr}>
                        {/* Booking ID */}
                        <td style={styles.td}>
                          <div style={styles.bookingPill}>
                            <span>#{res.id}</span>
                          </div>
                        </td>

                        {/* Guest Info */}
                        <td style={styles.td}>
                          <div style={styles.guestCol}>
                            <span style={styles.guestName}>
                              {res.first_name} {res.last_name}
                            </span>
                            <span style={styles.guestPhone}>{res.phone}</span>
                            <span style={styles.guestIdBadge}>
                              {res.id_type}: {res.id_number}
                            </span>
                          </div>
                        </td>

                        {/* Assigned Room */}
                        <td style={styles.td}>
                          <div style={styles.roomCol}>
                            <div style={styles.roomBadge}>
                              <BedDouble size={14} color="#fef08a" />
                              <span style={styles.roomBadgeText}>#{res.room_number}</span>
                            </div>
                            <span style={styles.roomTypeSub}>{res.room_type}</span>
                          </div>
                        </td>

                        {/* Schedule */}
                        <td style={styles.td}>
                          <div style={styles.datesCol}>
                            <div style={styles.dateRow}>
                              <span style={styles.dateLabel}>In:</span>
                              <span style={styles.dateVal}>
                                {inDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                            <div style={styles.dateRow}>
                              <span style={styles.dateLabel}>Out:</span>
                              <span style={styles.dateVal}>
                                {outDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Financials */}
                        <td style={styles.td}>
                          <div style={styles.folioCol}>
                            <span style={styles.totalAmountVal}>
                              ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span style={styles.paidBadge}>Advance: ₹{paid.toLocaleString('en-IN')}</span>
                          </div>
                        </td>

                        {/* Room Readiness */}
                        <td style={styles.td}>
                          {isRoomAvailable ? (
                            <span style={styles.readyBadge}>
                              <CheckCircle2 size={12} color="#10b981" />
                              <span>Ready & Vacant</span>
                            </span>
                          ) : (
                            <span style={styles.occupiedBadge}>
                              <AlertCircle size={12} color="#f59e0b" />
                              <span>Current: {res.room_status}</span>
                            </span>
                          )}
                        </td>

                        {/* Check-in Action Button */}
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <button
                            style={styles.checkinActionBtn}
                            onClick={() => openCheckInModal(res)}
                            title="Process Guest Check-in"
                          >
                            <LogIn size={14} color="#070a12" />
                            <span>Check-in</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: STAYS & HISTORY */}
      {activeTab === 'history' && (
        <div style={styles.tableCard}>
          <div style={styles.tableHeaderSection}>
            <div style={styles.tableHeading}>
              <Clock size={18} color="#d4af37" />
              <h2 style={styles.tableTitleText}>Complete Guest Stays Log & Archive</h2>
            </div>
            <span style={styles.tableSubtitleText}>
              Showing {filteredHistory.length} stay records
            </span>
          </div>

          {loading ? (
            <div style={styles.loadingBox}>
              <RefreshCw size={24} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={styles.loadingText}>Loading stays archive...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div style={styles.emptyBox}>
              <FileText size={48} color="#d4af37" style={{ opacity: 0.4 }} />
              <h3 style={styles.emptyTitle}>No History Records Found</h3>
              <p style={styles.emptyDesc}>No previous check-in or checkout logs match your search.</p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.th}>Stay ID</th>
                    <th style={styles.th}>Guest Name</th>
                    <th style={styles.th}>Room</th>
                    <th style={styles.th}>Check-in Date & Time</th>
                    <th style={styles.th}>Check-out Date & Time</th>
                    <th style={styles.th}>Status</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((rec) => {
                    const checkInTime = new Date(rec.actual_check_in)
                    const checkOutTime = rec.actual_check_out ? new Date(rec.actual_check_out) : null
                    const isActive = rec.stay_status === 'active'

                    return (
                      <tr key={rec.id} style={styles.tr}>
                        <td style={styles.td}>
                          <span style={styles.historyId}>#{rec.id}</span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.guestCol}>
                            <span style={styles.guestName}>
                              {rec.first_name} {rec.last_name}
                            </span>
                            <span style={styles.guestPhone}>{rec.phone}</span>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.roomHistText}>Room #{rec.room_number}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.timeVal}>
                            {checkInTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                            {checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {checkOutTime ? (
                            <span style={styles.timeVal}>
                              {checkOutTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                              {checkOutTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span style={styles.inHouseText}>In-House</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          {isActive ? (
                            <span style={styles.activePill}>Active Stay</span>
                          ) : (
                            <span style={styles.completedPill}>Departed</span>
                          )}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <button
                            style={styles.viewBtn}
                            onClick={() => setViewFolioData(rec)}
                            title="View Stay Details"
                          >
                            <Eye size={15} color="#94a3b8" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: CHECK-IN VERIFICATION & KEY ISSUANCE */}
      {/* ==================================================================== */}
      {checkInModalData && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            {/* Modal Header */}
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <div style={styles.modalIconWrap}>
                  <LogIn size={20} color="#070a12" />
                </div>
                <div>
                  <h3 style={styles.modalHeading}>Guest Arrival & Check-in</h3>
                  <span style={styles.modalSubheading}>
                    Verify guest identity and issue room access key
                  </span>
                </div>
              </div>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setCheckInModalData(null)}
                disabled={checkInSubmitting}
              >
                <X size={18} color="#94a3b8" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmCheckIn}>
              <div style={styles.modalBody}>
                {/* Guest Identity Card */}
                <div style={styles.guestVerifyCard}>
                  <div style={styles.verifyCardHeader}>
                    <ShieldCheck size={16} color="#d4af37" />
                    <span style={styles.verifyCardTitle}>Registered Guest Verification</span>
                  </div>
                  <div style={styles.verifyGrid}>
                    <div>
                      <span style={styles.verifyLabel}>Guest Full Name</span>
                      <span style={styles.verifyValue}>
                        {checkInModalData.first_name} {checkInModalData.last_name}
                      </span>
                    </div>
                    <div>
                      <span style={styles.verifyLabel}>Mobile Phone</span>
                      <span style={styles.verifyValue}>{checkInModalData.phone}</span>
                    </div>
                    <div>
                      <span style={styles.verifyLabel}>Identity Document</span>
                      <span style={styles.verifyValueHighlight}>
                        {checkInModalData.id_type}: {checkInModalData.id_number}
                      </span>
                    </div>
                    <div>
                      <span style={styles.verifyLabel}>Address</span>
                      <span style={styles.verifyValue}>{checkInModalData.address || 'Not Provided'}</span>
                    </div>
                  </div>

                  {/* Identity confirmation check */}
                  <label style={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={checkInForm.idVerified}
                      onChange={(e) =>
                        setCheckInForm({ ...checkInForm, idVerified: e.target.checked })
                      }
                      style={styles.checkboxInput}
                    />
                    <span style={styles.checkboxLabelText}>
                      I have verified the physical identity document against the records above.
                    </span>
                  </label>
                </div>

                {/* Stay Allocation Card */}
                <div style={styles.stayAllocationCard}>
                  <div style={styles.allocationRow}>
                    <div style={styles.allocationItem}>
                      <span style={styles.allocLabel}>Assigned Room</span>
                      <span style={styles.allocVal}>
                        Room #{checkInModalData.room_number} ({checkInModalData.room_type})
                      </span>
                    </div>
                    <div style={styles.allocationItem}>
                      <span style={styles.allocLabel}>Floor</span>
                      <span style={styles.allocVal}>Floor {checkInModalData.floor}</span>
                    </div>
                    <div style={styles.allocationItem}>
                      <span style={styles.allocLabel}>Check-out Date</span>
                      <span style={styles.allocVal}>
                        {new Date(checkInModalData.check_out_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Key Issuance & Notes Fields */}
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Room Key Card / Physical Key Status</label>
                    <select
                      value={checkInForm.roomKeyStatus}
                      onChange={(e) =>
                        setCheckInForm({ ...checkInForm, roomKeyStatus: e.target.value })
                      }
                      style={styles.select}
                    >
                      <option value="issued">Issued to Guest</option>
                      <option value="returned">Not Issued</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Key Card Tag / Reference</label>
                    <input
                      type="text"
                      value={checkInForm.keyNumber}
                      onChange={(e) =>
                        setCheckInForm({ ...checkInForm, keyNumber: e.target.value })
                      }
                      placeholder="e.g. KEY-101 / RFID-48"
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Check-in Notes / Special Instructions</label>
                  <textarea
                    rows={2}
                    value={checkInForm.notes}
                    onChange={(e) =>
                      setCheckInForm({ ...checkInForm, notes: e.target.value })
                    }
                    placeholder="Luggage assistance, extra bed issued, special requests..."
                    style={styles.textarea}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setCheckInModalData(null)}
                  disabled={checkInSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.submitBtn}
                  disabled={checkInSubmitting}
                >
                  <LogIn size={16} color="#070a12" />
                  <span>
                    {checkInSubmitting ? 'Confirming Arrival...' : 'Confirm Check-in & Occupy Room'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: EXPRESS CHECKOUT & FOLIO SETTLEMENT */}
      {/* ==================================================================== */}
      {checkOutModalData && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            {/* Modal Header */}
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <div style={{ ...styles.modalIconWrap, backgroundColor: '#f59e0b' }}>
                  <LogOut size={20} color="#070a12" />
                </div>
                <div>
                  <h3 style={styles.modalHeading}>Guest Departure & Checkout</h3>
                  <span style={styles.modalSubheading}>
                    Settle final folio, verify room keys, and mark room available
                  </span>
                </div>
              </div>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setCheckOutModalData(null)}
                disabled={checkOutSubmitting}
              >
                <X size={18} color="#94a3b8" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmCheckOut}>
              <div style={styles.modalBody}>
                {/* Stay Summary Info */}
                <div style={styles.stayAllocationCard}>
                  <div style={styles.allocationRow}>
                    <div style={styles.allocationItem}>
                      <span style={styles.allocLabel}>Guest Name</span>
                      <span style={styles.allocVal}>
                        {checkOutModalData.first_name} {checkOutModalData.last_name}
                      </span>
                    </div>
                    <div style={styles.allocationItem}>
                      <span style={styles.allocLabel}>Room Occupied</span>
                      <span style={styles.allocVal}>Room #{checkOutModalData.room_number}</span>
                    </div>
                    <div style={styles.allocationItem}>
                      <span style={styles.allocLabel}>Stay Duration</span>
                      <span style={styles.allocVal}>
                        {formatDuration(checkOutModalData.actual_check_in)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial Folio Settlement Card */}
                {(() => {
                  const total = parseFloat(checkOutModalData.total_amount || 0)
                  const paid = parseFloat(checkOutModalData.total_paid || 0)
                  const balance = Math.max(0, total - paid)

                  return (
                    <div style={styles.folioSettlementCard}>
                      <div style={styles.folioSettlementHeader}>
                        <IndianRupee size={16} color="#d4af37" />
                        <span style={styles.folioSettlementTitle}>Folio Settlement Balance</span>
                      </div>
                      <div style={styles.folioNumbersGrid}>
                        <div style={styles.folioNumBox}>
                          <span style={styles.folioLabel}>Total Charges</span>
                          <span style={styles.folioAmount}>
                            ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div style={styles.folioNumBox}>
                          <span style={styles.folioLabel}>Total Paid</span>
                          <span style={{ ...styles.folioAmount, color: '#34d399' }}>
                            ₹{paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div style={styles.folioNumBox}>
                          <span style={styles.folioLabel}>Outstanding Due</span>
                          <span
                            style={{
                              ...styles.folioAmount,
                              color: balance > 0 ? '#f87171' : '#34d399',
                            }}
                          >
                            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {balance > 0 ? (
                        <div style={styles.settleOptionsBox}>
                          <label style={styles.checkboxRow}>
                            <input
                              type="checkbox"
                              checked={checkOutForm.settleBalance}
                              onChange={(e) =>
                                setCheckOutForm({
                                  ...checkOutForm,
                                  settleBalance: e.target.checked,
                                })
                              }
                              style={styles.checkboxInput}
                            />
                            <span style={styles.checkboxLabelText}>
                              Collect & Settle full remaining balance of ₹{balance.toLocaleString('en-IN')} now
                            </span>
                          </label>

                          {checkOutForm.settleBalance && (
                            <div style={{ marginTop: '12px' }}>
                              <label style={styles.label}>Payment Method</label>
                              <select
                                value={checkOutForm.paymentMethod}
                                onChange={(e) =>
                                  setCheckOutForm({
                                    ...checkOutForm,
                                    paymentMethod: e.target.value,
                                  })
                                }
                                style={styles.select}
                              >
                                <option value="cash">Cash</option>
                                <option value="upi">UPI / QR Payment</option>
                                <option value="credit_card">Credit Card</option>
                                <option value="debit_card">Debit Card</option>
                                <option value="bank_transfer">Bank Transfer</option>
                              </select>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={styles.allSettledNote}>
                          <CheckCircle2 size={16} color="#34d399" />
                          <span>All stay charges are fully settled. Zero outstanding balance.</span>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Key Return Status */}
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Room Key Card Return</label>
                    <select
                      value={checkOutForm.roomKeyStatus}
                      onChange={(e) =>
                        setCheckOutForm({ ...checkOutForm, roomKeyStatus: e.target.value })
                      }
                      style={styles.select}
                    >
                      <option value="returned">Key Card Returned</option>
                      <option value="lost">Key Card Lost / Chargeable</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Checkout Notes / Minibar</label>
                    <input
                      type="text"
                      value={checkOutForm.notes}
                      onChange={(e) =>
                        setCheckOutForm({ ...checkOutForm, notes: e.target.value })
                      }
                      placeholder="Room inspected, minibar empty, luggage stored..."
                      style={styles.input}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setCheckOutModalData(null)}
                  disabled={checkOutSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ ...styles.submitBtn, backgroundColor: '#f59e0b' }}
                  disabled={checkOutSubmitting}
                >
                  <LogOut size={16} color="#070a12" />
                  <span>
                    {checkOutSubmitting
                      ? 'Processing Departure...'
                      : 'Complete Departure & Release Room'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: VIEW STAY AUDIT FOLIO */}
      {/* ==================================================================== */}
      {viewFolioData && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <div style={styles.modalIconWrap}>
                  <FileText size={20} color="#070a12" />
                </div>
                <div>
                  <h3 style={styles.modalHeading}>Guest Stay Folio & Audit Log</h3>
                  <span style={styles.modalSubheading}>
                    Permanent record of arrival, departure, and financials
                  </span>
                </div>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setViewFolioData(null)}>
                <X size={18} color="#94a3b8" />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.guestVerifyCard}>
                <div style={styles.verifyGrid}>
                  <div>
                    <span style={styles.verifyLabel}>Guest Name</span>
                    <span style={styles.verifyValue}>
                      {viewFolioData.first_name} {viewFolioData.last_name}
                    </span>
                  </div>
                  <div>
                    <span style={styles.verifyLabel}>Mobile Phone</span>
                    <span style={styles.verifyValue}>{viewFolioData.phone}</span>
                  </div>
                  <div>
                    <span style={styles.verifyLabel}>Room Allocation</span>
                    <span style={styles.verifyValueHighlight}>
                      Room #{viewFolioData.room_number} ({viewFolioData.room_type})
                    </span>
                  </div>
                  <div>
                    <span style={styles.verifyLabel}>ID Reference</span>
                    <span style={styles.verifyValue}>
                      {viewFolioData.id_type}: {viewFolioData.id_number}
                    </span>
                  </div>
                  <div>
                    <span style={styles.verifyLabel}>Actual Check-in Time</span>
                    <span style={styles.verifyValue}>
                      {new Date(viewFolioData.actual_check_in).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span style={styles.verifyLabel}>Actual Check-out Time</span>
                    <span style={styles.verifyValue}>
                      {viewFolioData.actual_check_out
                        ? new Date(viewFolioData.actual_check_out).toLocaleString()
                        : 'Currently In-House'}
                    </span>
                  </div>
                  <div>
                    <span style={styles.verifyLabel}>Key Status</span>
                    <span style={styles.verifyValue}>{viewFolioData.room_key_status}</span>
                  </div>
                  <div>
                    <span style={styles.verifyLabel}>Stay Notes</span>
                    <span style={styles.verifyValue}>{viewFolioData.notes || 'None'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={() => setViewFolioData(null)}
              >
                Close Folio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Luxury Dark & Gold Styling
const styles = {
  container: {
    padding: '24px',
    backgroundColor: '#060913',
    minHeight: '100vh',
    color: '#ffffff',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  toast: {
    position: 'fixed',
    top: '24px',
    right: '24px',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 20px',
    borderRadius: '8px',
    border: '1px solid',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    animation: 'slideIn 0.3s ease-out',
  },
  toastText: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ffffff',
  },
  toastClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
  },
  headerCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '28px 32px',
    backgroundColor: '#0a1020',
    borderRadius: '16px',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '20px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
  },
  headerLeft: {
    flex: '1',
    minWidth: '280px',
  },
  headerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderRadius: '20px',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    fontSize: '12px',
    fontWeight: '700',
    color: '#fef08a',
    letterSpacing: '0.05em',
    marginBottom: '12px',
  },
  headerTitle: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#ffffff',
    margin: '0 0 8px 0',
    letterSpacing: '-0.02em',
  },
  headerSubtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.5',
    maxWidth: '720px',
  },
  headerRight: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '10px',
    color: '#fef08a',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
    marginBottom: '28px',
  },
  tabBarCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    backgroundColor: '#0a1020',
    padding: '16px 20px',
    borderRadius: '14px',
    border: '1px solid rgba(212, 175, 55, 0.18)',
    marginBottom: '24px',
  },
  tabButtonsGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(212, 175, 55, 0.15)',
    borderRadius: '8px',
    color: '#cbd5e1',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabBtnActive: {
    backgroundColor: '#d4af37',
    borderColor: '#d4af37',
    color: '#070a12',
    boxShadow: '0 4px 14px rgba(212, 175, 55, 0.3)',
  },
  filterControlsGroup: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flex: '1',
    maxWidth: '460px',
    justifyContent: 'flex-end',
  },
  searchWrapper: {
    position: 'relative',
    flex: '1',
    minWidth: '220px',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '10px 36px 10px 38px',
    backgroundColor: '#10172a',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
  },
  filterSelect: {
    padding: '10px 14px',
    backgroundColor: '#10172a',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: '8px',
    color: '#fef08a',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  tableCard: {
    backgroundColor: '#0a1020',
    borderRadius: '16px',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  },
  tableHeaderSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(212, 175, 55, 0.12)',
    backgroundColor: '#0d152a',
  },
  tableHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  tableTitleText: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
  },
  tableSubtitleText: {
    fontSize: '13px',
    color: '#94a3b8',
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '14px',
  },
  loadingText: {
    fontSize: '14px',
    color: '#cbd5e1',
  },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    gap: '12px',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#fef08a',
    margin: '8px 0 4px 0',
  },
  emptyDesc: {
    fontSize: '14px',
    color: '#94a3b8',
    maxWidth: '480px',
    margin: 0,
    lineHeight: '1.5',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  thRow: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  th: {
    padding: '14px 20px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#d4af37',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(212, 175, 55, 0.15)',
  },
  tr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '16px 20px',
    fontSize: '13px',
    color: '#cbd5e1',
    verticalAlign: 'middle',
  },
  roomCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  roomBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    borderRadius: '6px',
    width: 'fit-content',
  },
  roomBadgeText: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#fef08a',
  },
  roomTypeSub: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  guestCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  guestName: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#ffffff',
  },
  guestPhone: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  guestIdBadge: {
    fontSize: '11px',
    color: '#d4af37',
    marginTop: '2px',
  },
  durationCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  durationBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 8px',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: '4px',
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: '600',
    width: 'fit-content',
  },
  dateSub: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  expectedOutText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#ffffff',
  },
  folioCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  totalAmountVal: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#fef08a',
  },
  balanceRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  paidBadge: {
    fontSize: '11px',
    color: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  dueBadge: {
    fontSize: '11px',
    color: '#f87171',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  settledBadge: {
    fontSize: '11px',
    color: '#34d399',
    fontWeight: '600',
  },
  keyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#cbd5e1',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  actionBtnsGroup: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  viewBtn: {
    padding: '7px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
  },
  checkoutBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    backgroundColor: '#f59e0b',
    border: 'none',
    borderRadius: '6px',
    color: '#070a12',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  checkinActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#d4af37',
    border: 'none',
    borderRadius: '6px',
    color: '#070a12',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  bookingPill: {
    display: 'inline-block',
    padding: '4px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: '4px',
    fontWeight: '700',
    fontSize: '12px',
    color: '#d4af37',
  },
  datesCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  dateRow: {
    display: 'flex',
    gap: '6px',
    fontSize: '12px',
  },
  dateLabel: {
    color: '#94a3b8',
    width: '24px',
  },
  dateVal: {
    color: '#ffffff',
    fontWeight: '500',
  },
  readyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: '4px',
    color: '#34d399',
    fontSize: '12px',
    fontWeight: '600',
  },
  occupiedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: '4px',
    color: '#fbbf24',
    fontSize: '12px',
    fontWeight: '600',
  },
  historyId: {
    fontWeight: '700',
    color: '#d4af37',
  },
  roomHistText: {
    fontWeight: '600',
    color: '#ffffff',
  },
  timeVal: {
    fontSize: '12px',
    color: '#cbd5e1',
  },
  inHouseText: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#38bdf8',
  },
  activePill: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
  },
  completedPill: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
  },
  // Modal Styles
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4, 7, 16, 0.85)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalBox: {
    backgroundColor: '#0a1020',
    borderRadius: '16px',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    width: '100%',
    maxWidth: '620px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(212, 175, 55, 0.18)',
    backgroundColor: '#0d152a',
  },
  modalTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  modalIconWrap: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: '#d4af37',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeading: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0 0 2px 0',
  },
  modalSubheading: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
  },
  modalBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  guestVerifyCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '10px',
    padding: '16px',
  },
  verifyCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  verifyCardTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#fef08a',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  verifyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '12px',
  },
  verifyLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    display: 'block',
    marginBottom: '2px',
  },
  verifyValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#ffffff',
  },
  verifyValueHighlight: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#fef08a',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    cursor: 'pointer',
    marginTop: '6px',
  },
  checkboxInput: {
    accentColor: '#d4af37',
    width: '16px',
    height: '16px',
    marginTop: '2px',
    cursor: 'pointer',
  },
  checkboxLabelText: {
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: '1.4',
  },
  stayAllocationCard: {
    backgroundColor: '#10172a',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '14px 18px',
  },
  allocationRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  allocationItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  allocLabel: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  allocVal: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#ffffff',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#cbd5e1',
  },
  input: {
    padding: '10px 14px',
    backgroundColor: '#10172a',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
  },
  select: {
    padding: '10px 14px',
    backgroundColor: '#10172a',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  textarea: {
    padding: '10px 14px',
    backgroundColor: '#10172a',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
    resize: 'vertical',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '18px 24px',
    borderTop: '1px solid rgba(212, 175, 55, 0.15)',
    backgroundColor: '#0d152a',
  },
  cancelBtn: {
    padding: '10px 18px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    color: '#94a3b8',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  submitBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#d4af37',
    border: 'none',
    borderRadius: '8px',
    color: '#070a12',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  folioSettlementCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '10px',
    padding: '16px',
  },
  folioSettlementHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  folioSettlementTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#fef08a',
    textTransform: 'uppercase',
  },
  folioNumbersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '12px',
  },
  folioNumBox: {
    backgroundColor: '#10172a',
    padding: '10px 12px',
    borderRadius: '8px',
    textAlign: 'center',
  },
  folioLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    display: 'block',
    marginBottom: '4px',
  },
  folioAmount: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#ffffff',
  },
  settleOptionsBox: {
    marginTop: '10px',
    padding: '12px',
    backgroundColor: '#10172a',
    borderRadius: '8px',
  },
  allSettledNote: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#34d399',
    marginTop: '6px',
  },
}
