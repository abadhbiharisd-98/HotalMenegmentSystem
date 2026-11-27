import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarCheck,
  Search,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Eye,
  ShieldAlert,
  ArrowUpDown,
  Filter,
  IndianRupee,
  Users,
  BedDouble,
  Clock,
  Check,
  FileText,
} from 'lucide-react'
import { reservationAPI, guestAPI, roomAPI } from '../services/api'
import SummaryCard from '../components/dashboard/SummaryCard'

export default function Reservations() {
  const navigate = useNavigate()

  const [reservations, setReservations] = useState([])
  const [guestsList, setGuestsList] = useState([])
  const [roomsList, setRoomsList] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [apiError, setApiError] = useState(null)
  const [toast, setToast] = useState(null) // { type: 'success' | 'error', message: string }

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [sortBy, setSortBy] = useState('created_at') // 'created_at' | 'check_in' | 'amount'
  const [sortOrder, setSortOrder] = useState('desc') // 'asc' | 'desc'

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const [selectedReservation, setSelectedReservation] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState({})

  // Dynamic available rooms for date picker in Create/Edit modal
  const [availableRooms, setAvailableRooms] = useState([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  // Form State for Create Reservation
  const todayStr = new Date().toISOString().split('T')[0]
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    guestId: '',
    roomId: '',
    checkInDate: todayStr,
    checkOutDate: tomorrowStr,
    numberOfGuests: 1,
    specialRequests: '',
    advanceAmount: '',
    paymentMethod: 'cash',
  })

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    roomId: '',
    checkInDate: '',
    checkOutDate: '',
    numberOfGuests: 1,
    specialRequests: '',
  })

  // Load All Reservations, Guests, and Rooms
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        const [resRes, guestsRes, roomsRes] = await Promise.all([
          reservationAPI.getReservations(),
          guestAPI.getGuests(),
          roomAPI.getRooms(),
        ])

        if (!isMounted) return

        setReservations(resRes?.data || [])
        setGuestsList(guestsRes?.data || [])
        setRoomsList(roomsRes?.data || [])
        setApiError(null)
      } catch (err) {
        if (isMounted) {
          setApiError(err?.message || 'Failed to fetch reservations from PostgreSQL.')
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

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleRefresh = () => {
    setRefreshing(true)
    setRefreshTrigger((prev) => prev + 1)
  }

  // Live room availability check when dates change in Create Modal
  useEffect(() => {
    if (!isCreateModalOpen) return
    if (!formData.checkInDate || !formData.checkOutDate) return
    if (new Date(formData.checkOutDate) <= new Date(formData.checkInDate)) return

    let isMounted = true

    async function fetchAvailable() {
      setCheckingAvailability(true)
      try {
        const res = await reservationAPI.getAvailableRooms({
          checkInDate: formData.checkInDate,
          checkOutDate: formData.checkOutDate,
        })
        if (isMounted) {
          setAvailableRooms(res?.data || [])
          // If previously selected room is no longer available, reset
          if (formData.roomId && !res?.data?.some((r) => String(r.id) === String(formData.roomId))) {
            setFormData((prev) => ({ ...prev, roomId: '' }))
          }
        }
      } catch {
        if (isMounted) setAvailableRooms([])
      } finally {
        if (isMounted) setCheckingAvailability(false)
      }
    }

    fetchAvailable()

    return () => {
      isMounted = false
    }
  }, [isCreateModalOpen, formData.checkInDate, formData.checkOutDate, formData.roomId])

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = reservations.length
    const confirmed = reservations.filter((r) => r.status === 'confirmed').length
    const pending = reservations.filter((r) => r.status === 'pending').length
    const totalRevenue = reservations
      .filter((r) => r.status !== 'cancelled')
      .reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0)

    return { total, confirmed, pending, totalRevenue }
  }, [reservations])

  // Filter & Search Logic
  const filteredReservations = useMemo(() => {
    return reservations
      .filter((res) => {
        const query = searchTerm.trim().toLowerCase()
        const guestName = `${res.first_name || ''} ${res.last_name || ''}`.toLowerCase()
        const matchesSearch =
          query === '' ||
          guestName.includes(query) ||
          (res.phone || '').toLowerCase().includes(query) ||
          (res.room_number || '').toLowerCase().includes(query) ||
          String(res.id) === query

        const matchesStatus =
          selectedStatus === 'all' || res.status === selectedStatus

        return matchesSearch && matchesStatus
      })
      .sort((a, b) => {
        let valA
        let valB

        if (sortBy === 'check_in') {
          valA = new Date(a.check_in_date || 0).getTime()
          valB = new Date(b.check_in_date || 0).getTime()
        } else if (sortBy === 'amount') {
          valA = parseFloat(a.total_amount || 0)
          valB = parseFloat(b.total_amount || 0)
        } else {
          // created_at
          valA = new Date(a.created_at || 0).getTime()
          valB = new Date(b.created_at || 0).getTime()
        }

        if (sortOrder === 'asc') {
          return valA > valB ? 1 : -1
        } else {
          return valA < valB ? 1 : -1
        }
      })
  }, [reservations, searchTerm, selectedStatus, sortBy, sortOrder])

  // Calculate nights and estimated total for Create Modal
  const calculatedNights = useMemo(() => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0
    const inDate = new Date(formData.checkInDate)
    const outDate = new Date(formData.checkOutDate)
    if (outDate <= inDate) return 0
    return Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24))
  }, [formData.checkInDate, formData.checkOutDate])

  const selectedRoomObj = useMemo(() => {
    if (!formData.roomId) return null
    return roomsList.find((r) => String(r.id) === String(formData.roomId))
  }, [formData.roomId, roomsList])

  const calculatedTotalAmount = useMemo(() => {
    if (!selectedRoomObj || calculatedNights <= 0) return 0
    return calculatedNights * parseFloat(selectedRoomObj.price_per_night || 0)
  }, [selectedRoomObj, calculatedNights])

  const remainingBalance = useMemo(() => {
    const advance = parseFloat(formData.advanceAmount || 0)
    return Math.max(0, calculatedTotalAmount - advance)
  }, [calculatedTotalAmount, formData.advanceAmount])

  // Open Create Modal
  const openCreateModal = () => {
    setFormData({
      guestId: guestsList[0]?.id ? String(guestsList[0].id) : '',
      roomId: '',
      checkInDate: todayStr,
      checkOutDate: tomorrowStr,
      numberOfGuests: 1,
      specialRequests: '',
      advanceAmount: '',
      paymentMethod: 'cash',
    })
    setFormErrors({})
    setIsCreateModalOpen(true)
  }

  // Open Edit Modal
  const openEditModal = (reservation) => {
    setSelectedReservation(reservation)
    setEditFormData({
      roomId: String(reservation.room_id || ''),
      checkInDate: reservation.check_in_date ? reservation.check_in_date.split('T')[0] : '',
      checkOutDate: reservation.check_out_date ? reservation.check_out_date.split('T')[0] : '',
      numberOfGuests: reservation.number_of_guests || 1,
      specialRequests: reservation.special_requests || '',
    })
    setFormErrors({})
    setIsEditModalOpen(true)
  }

  // Open View Details Modal
  const openViewModal = (reservation) => {
    setSelectedReservation(reservation)
    setIsViewModalOpen(true)
  }

  // Open Delete Modal
  const openDeleteModal = (reservation) => {
    setSelectedReservation(reservation)
    setIsDeleteModalOpen(true)
  }

  // Validate Create Form
  const validateCreateForm = () => {
    const errors = {}
    if (!formData.guestId) {
      errors.guestId = 'Please select a registered guest.'
    }
    if (!formData.roomId) {
      errors.roomId = 'Please select an available room.'
    }
    if (!formData.checkInDate) {
      errors.checkInDate = 'Check-in date is required.'
    }
    if (!formData.checkOutDate) {
      errors.checkOutDate = 'Check-out date is required.'
    } else if (new Date(formData.checkOutDate) <= new Date(formData.checkInDate)) {
      errors.checkOutDate = 'Check-out date must be strictly after check-in date.'
    }

    if (formData.numberOfGuests < 1) {
      errors.numberOfGuests = 'Number of guests must be at least 1.'
    }

    if (formData.advanceAmount !== '' && parseFloat(formData.advanceAmount) < 0) {
      errors.advanceAmount = 'Advance amount cannot be negative.'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Submit Create Reservation
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!validateCreateForm()) return

    setIsSubmitting(true)
    setApiError(null)

    const payload = {
      guestId: parseInt(formData.guestId, 10),
      roomId: parseInt(formData.roomId, 10),
      checkInDate: formData.checkInDate,
      checkOutDate: formData.checkOutDate,
      numberOfGuests: parseInt(formData.numberOfGuests, 10),
      totalAmount: calculatedTotalAmount,
      specialRequests: formData.specialRequests.trim() || null,
      advanceAmount: formData.advanceAmount ? parseFloat(formData.advanceAmount) : 0,
      paymentMethod: formData.paymentMethod,
    }

    try {
      const res = await reservationAPI.createReservation(payload)
      setToast({
        type: 'success',
        message: `Reservation #${res?.data?.id || 'Created'} booked successfully in PostgreSQL.`,
      })
      setIsCreateModalOpen(false)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to create reservation. Please check dates or room availability.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit Edit Reservation
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!selectedReservation) return

    setIsSubmitting(true)
    try {
      const payload = {
        roomId: parseInt(editFormData.roomId, 10),
        checkInDate: editFormData.checkInDate,
        checkOutDate: editFormData.checkOutDate,
        numberOfGuests: parseInt(editFormData.numberOfGuests, 10),
        specialRequests: editFormData.specialRequests.trim() || null,
      }

      await reservationAPI.updateReservation(selectedReservation.id, payload)
      setToast({
        type: 'success',
        message: `Reservation #${selectedReservation.id} updated successfully.`,
      })
      setIsEditModalOpen(false)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to update reservation.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Status Change (Confirm, Cancel, Complete)
  const handleStatusChange = async (reservationId, newStatus) => {
    try {
      await reservationAPI.updateStatus(reservationId, newStatus)
      setToast({
        type: 'success',
        message: `Reservation #${reservationId} marked as ${newStatus.toUpperCase()}.`,
      })
      setReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, status: newStatus } : r))
      )
      if (selectedReservation?.id === reservationId) {
        setSelectedReservation((prev) => (prev ? { ...prev, status: newStatus } : null))
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.message || `Cannot change status to ${newStatus}.`,
      })
    }
  }

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!selectedReservation) return

    setIsSubmitting(true)
    try {
      await reservationAPI.deleteReservation(selectedReservation.id)
      setToast({
        type: 'success',
        message: `Reservation #${selectedReservation.id} deleted from database.`,
      })
      setReservations((prev) => prev.filter((r) => r.id !== selectedReservation.id))
      setIsDeleteModalOpen(false)
      setSelectedReservation(null)
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to delete reservation.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={styles.container}>
      {/* Toast Alert Notification */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            backgroundColor: toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            borderColor: toast.type === 'success' ? '#34d399' : '#f87171',
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} color="#ffffff" />
          ) : (
            <AlertCircle size={18} color="#ffffff" />
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
            <CalendarCheck size={14} color="#fef08a" />
            <span>RESERVATION & BOOKINGS COMMAND</span>
          </div>
          <h1 style={styles.headerTitle}>Guest Reservations Folio</h1>
          <p style={styles.headerSubtitle}>
            Manage hotel room allocations, booking schedules, advance deposits, and check-in timelines with PostgreSQL transaction safety.
          </p>
        </div>

        <div style={styles.headerRight}>
          <button style={styles.addBtn} onClick={openCreateModal}>
            <Plus size={18} color="#070a12" />
            <span>New Reservation</span>
          </button>
          <button
            style={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Fetch latest reservations from PostgreSQL"
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
          title="Total Reservations"
          value={metrics.total}
          subtitle="All-time booking folios"
          icon={CalendarCheck}
          gradient="linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)"
          bgSoft="rgba(212, 175, 55, 0.15)"
          iconColor="#fbbf24"
          badge="Folios"
          badgeColor="#fef08a"
          badgeBg="rgba(212, 175, 55, 0.2)"
          loading={loading}
          delay={50}
        />
        <SummaryCard
          title="Confirmed"
          value={metrics.confirmed}
          subtitle="Guaranteed advance bookings"
          icon={CheckCircle2}
          gradient="linear-gradient(135deg, #a7f3d0 0%, #10b981 50%, #047857 100%)"
          bgSoft="rgba(16, 185, 129, 0.15)"
          iconColor="#34d399"
          badge={metrics.total > 0 ? `${Math.round((metrics.confirmed / metrics.total) * 100)}% Locked` : '0%'}
          badgeColor="#6ee7b7"
          badgeBg="rgba(16, 185, 129, 0.2)"
          loading={loading}
          delay={100}
        />
        <SummaryCard
          title="Pending Deposit"
          value={metrics.pending}
          subtitle="Awaiting guest confirmation"
          icon={Clock}
          gradient="linear-gradient(135deg, #fed7aa 0%, #f59e0b 50%, #b45309 100%)"
          bgSoft="rgba(245, 158, 11, 0.15)"
          iconColor="#fbbf24"
          badge={metrics.pending > 0 ? 'Pending' : 'All Clear'}
          badgeColor="#fde047"
          badgeBg="rgba(245, 158, 11, 0.2)"
          loading={loading}
          delay={150}
        />
        <SummaryCard
          title="Booking Value"
          value={`₹${metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Active reservation value"
          icon={IndianRupee}
          gradient="linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)"
          bgSoft="rgba(212, 175, 55, 0.2)"
          iconColor="#fde047"
          badge="INR Net"
          badgeColor="#fef08a"
          badgeBg="rgba(212, 175, 55, 0.25)"
          loading={loading}
          delay={200}
        />
      </div>

      {/* API Error Alert if any */}
      {apiError && (
        <div style={styles.errorAlert}>
          <AlertCircle size={18} color="#f87171" />
          <span>{apiError}</span>
          <button style={styles.retryBtn} onClick={() => setRefreshTrigger((prev) => prev + 1)}>
            Retry
          </button>
        </div>
      )}

      {/* Control Bar: Search & Status Filters */}
      <div style={styles.controlsCard}>
        <div style={styles.searchWrapper}>
          <Search size={18} color="#94a3b8" style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by Guest Name, Mobile, Room #, or Booking ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button style={styles.clearSearchBtn} onClick={() => setSearchTerm('')}>
              <X size={15} color="#94a3b8" />
            </button>
          )}
        </div>

        <div style={styles.filtersWrapper}>
          {/* Status Filter */}
          <div style={styles.filterGroup}>
            <Filter size={14} color="#d4af37" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={styles.selectFilter}
            >
              <option value="all">All Statuses ({reservations.length})</option>
              <option value="pending">Pending ({metrics.pending})</option>
              <option value="confirmed">Confirmed ({metrics.confirmed})</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Sort By */}
          <div style={styles.filterGroup}>
            <ArrowUpDown size={14} color="#d4af37" />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-')
                setSortBy(by)
                setSortOrder(order)
              }}
              style={styles.selectFilter}
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="check_in-asc">Check-in (Earliest)</option>
              <option value="check_in-desc">Check-in (Latest)</option>
              <option value="amount-desc">Amount (High to Low)</option>
              <option value="amount-asc">Amount (Low to High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div style={styles.tableCard}>
        <div style={styles.tableCardHeader}>
          <div>
            <h2 style={styles.tableCardTitle}>
              Active Bookings Folio ({filteredReservations.length}{' '}
              {filteredReservations.length === 1 ? 'reservation' : 'reservations'})
            </h2>
            <span style={styles.tableCardSubtitle}>
              {searchTerm || selectedStatus !== 'all'
                ? 'Filtered database booking results'
                : 'All reservations recorded in PostgreSQL'}
            </span>
          </div>

          {(searchTerm || selectedStatus !== 'all') && (
            <button
              style={styles.resetFiltersBtn}
              onClick={() => {
                setSearchTerm('')
                setSelectedStatus('all')
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {loading ? (
          <div style={styles.loadingState}>
            <RefreshCw size={26} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Loading reservations from PostgreSQL...</span>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div style={styles.emptyState}>
            <CalendarCheck size={48} color="#94a3b8" style={{ opacity: 0.5 }} />
            <h3 style={styles.emptyTitle}>No Reservations Found</h3>
            <p style={styles.emptyText}>
              {searchTerm || selectedStatus !== 'all'
                ? 'No bookings match your active search and filter criteria.'
                : 'No reservations are registered in the hotel database yet. Click "New Reservation" to book a room.'}
            </p>
            {searchTerm || selectedStatus !== 'all' ? (
              <button
                style={styles.emptyActionBtn}
                onClick={() => {
                  setSearchTerm('')
                  setSelectedStatus('all')
                }}
              >
                Clear All Filters
              </button>
            ) : (
              <button style={styles.emptyActionBtn} onClick={openCreateModal}>
                + Create First Reservation
              </button>
            )}
          </div>
        ) : (
          /* Table View */
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Booking ID</th>
                  <th style={styles.th}>Guest Details</th>
                  <th style={styles.th}>Room Assigned</th>
                  <th style={styles.th}>Stay Dates & Nights</th>
                  <th style={styles.th}>Financial Summary</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((res) => {
                  const inDate = new Date(res.check_in_date)
                  const outDate = new Date(res.check_out_date)
                  const nights =
                    outDate > inDate ? Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24)) : 1

                  const total = parseFloat(res.total_amount || 0)
                  const paid = parseFloat(res.total_paid || 0)
                  const balance = Math.max(0, total - paid)

                  const isConfirmed = res.status === 'confirmed'
                  const isPending = res.status === 'pending'
                  const isCompleted = res.status === 'completed'

                  return (
                    <tr key={res.id} style={styles.tr}>
                      {/* Booking ID & Time */}
                      <td style={styles.td}>
                        <div style={styles.bookingIdPill}>
                          <span style={styles.bookingIdText}>#{res.id}</span>
                        </div>
                      </td>

                      {/* Guest Details */}
                      <td style={styles.td}>
                        <div style={styles.guestCol}>
                          <span style={styles.guestName}>
                            {res.first_name} {res.last_name}
                          </span>
                          <span style={styles.guestPhone}>{res.phone}</span>
                        </div>
                      </td>

                      {/* Room Assigned */}
                      <td style={styles.td}>
                        <div style={styles.roomCol}>
                          <div style={styles.roomBadgePill}>
                            <BedDouble size={13} color="#fef08a" />
                            <span>Room #{res.room_number}</span>
                          </div>
                          <span style={styles.roomCategory}>{res.room_type}</span>
                        </div>
                      </td>

                      {/* Stay Dates */}
                      <td style={styles.td}>
                        <div style={styles.datesCol}>
                          <div style={styles.dateRow}>
                            <span style={styles.dateLabel}>In:</span>
                            <span style={styles.dateVal}>
                              {inDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <div style={styles.dateRow}>
                            <span style={styles.dateLabel}>Out:</span>
                            <span style={styles.dateVal}>
                              {outDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span style={styles.nightsBadge}>{nights}N</span>
                          </div>
                        </div>
                      </td>

                      {/* Financials */}
                      <td style={styles.td}>
                        <div style={styles.financeCol}>
                          <span style={styles.totalAmountVal}>
                            ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <div style={styles.balanceRow}>
                            <span style={styles.paidBadge}>Paid: ₹{paid.toLocaleString('en-IN')}</span>
                            {balance > 0 && (
                              <span style={styles.dueBadge}>Due: ₹{balance.toLocaleString('en-IN')}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            backgroundColor: isConfirmed
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isPending
                              ? 'rgba(245, 158, 11, 0.15)'
                              : isCompleted
                              ? 'rgba(56, 189, 248, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                            borderColor: isConfirmed
                              ? 'rgba(16, 185, 129, 0.4)'
                              : isPending
                              ? 'rgba(245, 158, 11, 0.45)'
                              : isCompleted
                              ? 'rgba(56, 189, 248, 0.4)'
                              : 'rgba(239, 68, 68, 0.4)',
                            color: isConfirmed
                              ? '#6ee7b7'
                              : isPending
                              ? '#fde047'
                              : isCompleted
                              ? '#7dd3fc'
                              : '#fda4af',
                          }}
                        >
                          <span
                            style={{
                              ...styles.statusDot,
                              backgroundColor: isConfirmed
                                ? '#10b981'
                                : isPending
                                ? '#f59e0b'
                                : isCompleted
                                ? '#38bdf8'
                                : '#f43f5e',
                            }}
                          />
                          {(res.status || 'PENDING').toUpperCase()}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <div style={styles.actionGroup}>
                          {/* View Details */}
                          <button
                            style={styles.viewBtn}
                            onClick={() => openViewModal(res)}
                            title="View complete booking folio"
                          >
                            <Eye size={15} color="#38bdf8" />
                            <span>Folio</span>
                          </button>

                          {/* Edit allowed only if pending or confirmed */}
                          {(isPending || isConfirmed) && (
                            <button
                              style={styles.editBtn}
                              onClick={() => openEditModal(res)}
                              title="Edit dates, room or guests"
                            >
                              <Pencil size={15} color="#d4af37" />
                              <span>Edit</span>
                            </button>
                          )}

                          {/* Quick Confirm Button if pending */}
                          {isPending && (
                            <button
                              style={styles.confirmActionBtn}
                              onClick={() => handleStatusChange(res.id, 'confirmed')}
                              title="Confirm booking"
                            >
                              <Check size={14} color="#10b981" />
                            </button>
                          )}

                          {/* Cancel allowed if pending or confirmed */}
                          {(isPending || isConfirmed) && (
                            <button
                              style={styles.cancelActionBtn}
                              onClick={() => handleStatusChange(res.id, 'cancelled')}
                              title="Cancel reservation"
                            >
                              <X size={14} color="#f87171" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            style={styles.deleteBtn}
                            onClick={() => openDeleteModal(res)}
                            title="Delete record"
                          >
                            <Trash2 size={15} color="#f87171" />
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

      {/* CREATE RESERVATION MODAL */}
      {isCreateModalOpen && (
        <div style={styles.modalOverlay} onClick={() => !isSubmitting && setIsCreateModalOpen(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalHeaderLeft}>
                <div style={styles.modalIconWrap}>
                  <CalendarCheck size={20} color="#d4af37" />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>New Reservation Folio</h3>
                  <span style={styles.modalSubtitle}>
                    Allocate room with real-time PostgreSQL date-conflict safeguards
                  </span>
                </div>
              </div>

              <button
                style={styles.modalCloseBtn}
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSubmitting}
              >
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={styles.modalForm}>
              {/* Guest Selection */}
              <div style={styles.formGroup}>
                <div style={styles.labelRow}>
                  <label style={styles.label}>
                    Registered Guest <span style={styles.requiredMark}>*</span>
                  </label>
                  <button
                    type="button"
                    style={styles.guestLinkBtn}
                    onClick={() => {
                      setIsCreateModalOpen(false)
                      navigate('/guests')
                    }}
                  >
                    + Register New Guest
                  </button>
                </div>
                <select
                  value={formData.guestId}
                  onChange={(e) => setFormData({ ...formData, guestId: e.target.value })}
                  style={{
                    ...styles.select,
                    borderColor: formErrors.guestId ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                  }}
                >
                  <option value="">Select Registered Guest...</option>
                  {guestsList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.first_name} {g.last_name} ({g.phone} • {g.id_type})
                    </option>
                  ))}
                </select>
                {formErrors.guestId && <span style={styles.errorText}>{formErrors.guestId}</span>}
              </div>

              {/* Check-in and Check-out Dates */}
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Check-In Date <span style={styles.requiredMark}>*</span>
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={formData.checkInDate}
                    onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                    style={{
                      ...styles.input,
                      borderColor: formErrors.checkInDate ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                    }}
                  />
                  {formErrors.checkInDate && <span style={styles.errorText}>{formErrors.checkInDate}</span>}
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Check-Out Date <span style={styles.requiredMark}>*</span>
                  </label>
                  <input
                    type="date"
                    min={formData.checkInDate || todayStr}
                    value={formData.checkOutDate}
                    onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                    style={{
                      ...styles.input,
                      borderColor: formErrors.checkOutDate ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                    }}
                  />
                  {formErrors.checkOutDate && (
                    <span style={styles.errorText}>{formErrors.checkOutDate}</span>
                  )}
                </div>
              </div>

              {/* Number of Guests & Available Room Selection */}
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Total Guests <span style={styles.requiredMark}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.numberOfGuests}
                    onChange={(e) => setFormData({ ...formData, numberOfGuests: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <div style={styles.labelRow}>
                    <label style={styles.label}>
                      Available Room <span style={styles.requiredMark}>*</span>
                    </label>
                    {checkingAvailability && (
                      <span style={styles.checkingNote}>Checking dates...</span>
                    )}
                  </div>
                  <select
                    value={formData.roomId}
                    onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                    style={{
                      ...styles.select,
                      borderColor: formErrors.roomId ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                    }}
                    disabled={checkingAvailability}
                  >
                    <option value="">
                      {availableRooms.length === 0
                        ? 'No rooms available for these dates'
                        : `Select Room (${availableRooms.length} available)...`}
                    </option>
                    {availableRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        Room #{room.room_number} — {room.room_type} (₹{parseFloat(room.price_per_night).toLocaleString('en-IN')}/night)
                      </option>
                    ))}
                  </select>
                  {formErrors.roomId && <span style={styles.errorText}>{formErrors.roomId}</span>}
                </div>
              </div>

              {/* Rate & Charge Calculation Card */}
              {selectedRoomObj && calculatedNights > 0 && (
                <div style={styles.calculationCard}>
                  <div style={styles.calcRow}>
                    <span style={styles.calcLabel}>Room Tier:</span>
                    <span style={styles.calcValue}>{selectedRoomObj.room_type} (Room #{selectedRoomObj.room_number})</span>
                  </div>
                  <div style={styles.calcRow}>
                    <span style={styles.calcLabel}>Duration:</span>
                    <span style={styles.calcValue}>
                      {calculatedNights} {calculatedNights === 1 ? 'Night' : 'Nights'} × ₹{parseFloat(selectedRoomObj.price_per_night).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div style={styles.calcDivider} />
                  <div style={styles.calcRow}>
                    <span style={styles.totalCalcLabel}>Total Room Amount:</span>
                    <span style={styles.totalCalcValue}>
                      ₹{calculatedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {/* Advance Payment Options */}
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Advance Deposit (₹) - Optional</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 1000"
                    value={formData.advanceAmount}
                    onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })}
                    style={styles.input}
                  />
                  {calculatedTotalAmount > 0 && (
                    <span style={styles.balanceHelper}>
                      Balance on Arrival: <strong>₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </span>
                  )}
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Deposit Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    style={styles.select}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Special Requests */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Special Requests / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Early check-in, quiet room, airport pickup requested"
                  value={formData.specialRequests}
                  onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                  style={styles.input}
                />
              </div>

              {/* Actions */}
              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} color="#070a12" style={{ animation: 'spin 0.8s linear infinite' }} />
                      <span>Creating Booking...</span>
                    </>
                  ) : (
                    <span>Confirm & Book Room</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RESERVATION MODAL */}
      {isEditModalOpen && selectedReservation && (
        <div style={styles.modalOverlay} onClick={() => !isSubmitting && setIsEditModalOpen(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalHeaderLeft}>
                <div style={styles.modalIconWrap}>
                  <Pencil size={18} color="#d4af37" />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>Edit Reservation #{selectedReservation.id}</h3>
                  <span style={styles.modalSubtitle}>
                    Guest: {selectedReservation.first_name} {selectedReservation.last_name}
                  </span>
                </div>
              </div>

              <button
                style={styles.modalCloseBtn}
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
              >
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.modalForm}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Check-In Date</label>
                  <input
                    type="date"
                    value={editFormData.checkInDate}
                    onChange={(e) => setEditFormData({ ...editFormData, checkInDate: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Check-Out Date</label>
                  <input
                    type="date"
                    min={editFormData.checkInDate}
                    value={editFormData.checkOutDate}
                    onChange={(e) => setEditFormData({ ...editFormData, checkOutDate: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Room Number</label>
                  <select
                    value={editFormData.roomId}
                    onChange={(e) => setEditFormData({ ...editFormData, roomId: e.target.value })}
                    style={styles.select}
                  >
                    {roomsList.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room #{r.room_number} ({r.room_type} • ₹{parseFloat(r.price_per_night).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Number of Guests</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editFormData.numberOfGuests}
                    onChange={(e) => setEditFormData({ ...editFormData, numberOfGuests: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Special Requests / Notes</label>
                <input
                  type="text"
                  value={editFormData.specialRequests}
                  onChange={(e) => setEditFormData({ ...editFormData, specialRequests: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} color="#070a12" style={{ animation: 'spin 0.8s linear infinite' }} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW BOOKING FOLIO MODAL */}
      {isViewModalOpen && selectedReservation && (
        <div style={styles.modalOverlay} onClick={() => setIsViewModalOpen(false)}>
          <div style={styles.viewModalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.viewHeader}>
              <div style={styles.viewHeaderLeft}>
                <div style={styles.folioIconWrap}>
                  <FileText size={22} color="#070a12" />
                </div>
                <div>
                  <h3 style={styles.viewTitle}>Booking Folio #{selectedReservation.id}</h3>
                  <span style={styles.viewSubtitle}>
                    PostgreSQL Verified Hospitality Ledger Record
                  </span>
                </div>
              </div>

              <button style={styles.modalCloseBtn} onClick={() => setIsViewModalOpen(false)}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <div style={styles.viewBody}>
              {/* Guest & Room Grid */}
              <div style={styles.folioGrid}>
                {/* Guest Card */}
                <div style={styles.folioCard}>
                  <div style={styles.folioCardHeader}>
                    <Users size={15} color="#d4af37" />
                    <span>Guest Profile</span>
                  </div>
                  <div style={styles.folioCardContent}>
                    <span style={styles.guestMainName}>
                      {selectedReservation.first_name} {selectedReservation.last_name}
                    </span>
                    <span style={styles.folioMetaItem}>Phone: {selectedReservation.phone}</span>
                    {selectedReservation.email && (
                      <span style={styles.folioMetaItem}>Email: {selectedReservation.email}</span>
                    )}
                    {selectedReservation.id_number && (
                      <span style={styles.folioMetaItem}>
                        ID: {selectedReservation.id_type || 'Govt ID'} ({selectedReservation.id_number})
                      </span>
                    )}
                  </div>
                </div>

                {/* Room Card */}
                <div style={styles.folioCard}>
                  <div style={styles.folioCardHeader}>
                    <BedDouble size={15} color="#d4af37" />
                    <span>Room Accommodation</span>
                  </div>
                  <div style={styles.folioCardContent}>
                    <span style={styles.roomMainNum}>
                      Room #{selectedReservation.room_number}
                    </span>
                    <span style={styles.folioMetaItem}>Category: {selectedReservation.room_type}</span>
                    <span style={styles.folioMetaItem}>
                      Rate: ₹{parseFloat(selectedReservation.price_per_night || 0).toLocaleString('en-IN')}/night
                    </span>
                    {selectedReservation.floor && (
                      <span style={styles.folioMetaItem}>Floor Level: {selectedReservation.floor}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Schedule and Financials */}
              <div style={styles.folioDetailsSection}>
                <div style={styles.folioSectionTitle}>Schedule & Financial Folio</div>

                <div style={styles.folioRow}>
                  <span style={styles.folioLabel}>Check-In Date:</span>
                  <span style={styles.folioValue}>
                    {new Date(selectedReservation.check_in_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div style={styles.folioRow}>
                  <span style={styles.folioLabel}>Check-Out Date:</span>
                  <span style={styles.folioValue}>
                    {new Date(selectedReservation.check_out_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div style={styles.folioRow}>
                  <span style={styles.folioLabel}>Total Amount:</span>
                  <span style={styles.folioValueGold}>
                    ₹{parseFloat(selectedReservation.total_amount || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div style={styles.folioRow}>
                  <span style={styles.folioLabel}>Advance Deposit Paid:</span>
                  <span style={styles.folioValueGreen}>
                    ₹{parseFloat(selectedReservation.total_paid || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div style={styles.folioRow}>
                  <span style={styles.folioLabel}>Balance Due on Check-out:</span>
                  <span style={styles.folioValueDue}>
                    ₹{Math.max(
                      0,
                      parseFloat(selectedReservation.total_amount || 0) -
                        parseFloat(selectedReservation.total_paid || 0)
                    ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {selectedReservation.special_requests && (
                  <div style={styles.folioRow}>
                    <span style={styles.folioLabel}>Special Requests:</span>
                    <span style={styles.folioValue}>{selectedReservation.special_requests}</span>
                  </div>
                )}
              </div>

              {/* Quick Status Control Buttons */}
              <div style={styles.statusUpdateRow}>
                <span style={styles.statusRowLabel}>Update Booking Status:</span>
                <div style={styles.statusBtnsGroup}>
                  {selectedReservation.status !== 'confirmed' && selectedReservation.status !== 'completed' && selectedReservation.status !== 'cancelled' && (
                    <button
                      style={styles.quickConfirmBtn}
                      onClick={() => handleStatusChange(selectedReservation.id, 'confirmed')}
                    >
                      <Check size={14} /> Confirm Booking
                    </button>
                  )}
                  {selectedReservation.status !== 'completed' && selectedReservation.status !== 'cancelled' && (
                    <button
                      style={styles.quickCancelBtn}
                      onClick={() => handleStatusChange(selectedReservation.id, 'cancelled')}
                    >
                      <X size={14} /> Cancel Booking
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={styles.viewFooter}>
              <button style={styles.cancelBtn} onClick={() => setIsViewModalOpen(false)}>
                Close Folio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SAFEGUARD MODAL */}
      {isDeleteModalOpen && selectedReservation && (
        <div style={styles.modalOverlay} onClick={() => !isSubmitting && setIsDeleteModalOpen(false)}>
          <div style={styles.deleteModalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.deleteHeader}>
              <div style={styles.deleteIconWrap}>
                <ShieldAlert size={24} color="#f87171" />
              </div>
              <div>
                <h3 style={styles.deleteTitle}>Delete Reservation #{selectedReservation.id}</h3>
                <span style={styles.deleteSubtitle}>
                  Permanent database removal confirmation
                </span>
              </div>
            </div>

            <div style={styles.deleteContent}>
              <p style={styles.deleteWarningText}>
                Are you sure you want to permanently delete Reservation <strong>#{selectedReservation.id}</strong> for guest{' '}
                <strong>{selectedReservation.first_name} {selectedReservation.last_name}</strong> (Room #{selectedReservation.room_number})?
              </p>
              <div style={styles.deleteMetaPill}>
                <span>Status: <strong>{selectedReservation.status?.toUpperCase()}</strong></span>
                <span>•</span>
                <span>Amount: ₹{parseFloat(selectedReservation.total_amount).toLocaleString('en-IN')}</span>
              </div>
              <p style={styles.deleteSubtext}>
                This action cannot be undone. Active reservations with checked-in guests cannot be deleted.
              </p>
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.cancelBtn}
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                style={styles.confirmDeleteBtn}
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} color="#ffffff" style={{ animation: 'spin 0.8s linear infinite' }} />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} color="#ffffff" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    animation: 'cardEntrance 0.35s ease-out',
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
    borderRadius: '12px',
    border: '1px solid',
    color: '#ffffff',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
    animation: 'cardEntrance 0.3s ease-out',
  },
  toastText: {
    fontSize: '13.5px',
    fontWeight: '700',
  },
  toastClose: {
    display: 'flex',
    alignItems: 'center',
    padding: '2px',
    borderRadius: '4px',
  },
  headerCard: {
    background: 'linear-gradient(135deg, #060913 0%, #0c1326 40%, #131f3c 75%, #080d1a 100%)',
    borderRadius: '20px',
    border: '1px solid rgba(212, 175, 55, 0.4)',
    boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(254, 240, 138, 0.25)',
    padding: '30px 34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '20px',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '680px',
  },
  headerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 14px',
    borderRadius: '20px',
    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.22) 0%, rgba(180, 83, 9, 0.18) 100%)',
    border: '1px solid rgba(212, 175, 55, 0.45)',
    color: '#fef08a',
    fontSize: '11px',
    fontWeight: '800',
    width: 'fit-content',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: '28px',
    fontWeight: '900',
    color: '#fef08a',
    letterSpacing: '0.5px',
    textShadow: '0 0 20px rgba(212, 175, 55, 0.4), 0 2px 10px rgba(0, 0, 0, 0.7)',
    margin: 0,
  },
  headerSubtitle: {
    fontSize: '13.5px',
    color: '#cbd5e1',
    lineHeight: '1.5',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 22px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    border: '1px solid #fef08a',
    borderRadius: '12px',
    fontSize: '13.5px',
    fontWeight: '800',
    color: '#070a12',
    boxShadow: '0 0 20px rgba(212, 175, 55, 0.4), 0 4px 12px rgba(0, 0, 0, 0.6)',
    transition: 'all 0.2s ease',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    backgroundColor: '#0a1020',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '700',
    color: '#fef08a',
    transition: 'all 0.2s ease',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '18px',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '12px',
    color: '#fca5a5',
    fontSize: '13.5px',
  },
  retryBtn: {
    padding: '4px 12px',
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '700',
  },
  controlsCard: {
    backgroundColor: '#0a1020',
    borderRadius: '16px',
    border: '1px solid rgba(212, 175, 55, 0.22)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    padding: '18px 22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  },
  searchWrapper: {
    position: 'relative',
    flex: '1 1 300px',
    maxWidth: '460px',
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '11px 40px 11px 42px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '13.5px',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(212, 175, 55, 0.22)',
    borderRadius: '10px',
    padding: '4px 12px',
  },
  selectFilter: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#fef08a',
    fontSize: '12.5px',
    fontWeight: '700',
    outline: 'none',
    cursor: 'pointer',
    padding: '6px 0',
  },
  tableCard: {
    backgroundColor: '#0a1020',
    borderRadius: '18px',
    border: '1px solid rgba(212, 175, 55, 0.22)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  tableCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  tableCardTitle: {
    fontSize: '17px',
    fontWeight: '800',
    color: '#ffffff',
    margin: 0,
  },
  tableCardSubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  resetFiltersBtn: {
    padding: '6px 14px',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    borderRadius: '8px',
    color: '#fef08a',
    fontSize: '12px',
    fontWeight: '700',
  },
  loadingState: {
    padding: '60px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    color: '#cbd5e1',
    fontSize: '14px',
    fontWeight: '600',
  },
  emptyState: {
    padding: '60px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px',
  },
  emptyTitle: {
    fontSize: '17px',
    fontWeight: '800',
    color: '#fef08a',
    margin: '6px 0 0 0',
  },
  emptyText: {
    fontSize: '13px',
    color: '#94a3b8',
    maxWidth: '460px',
    margin: 0,
  },
  emptyActionBtn: {
    marginTop: '10px',
    padding: '8px 18px',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    border: '1px solid rgba(212, 175, 55, 0.4)',
    borderRadius: '10px',
    color: '#fef08a',
    fontSize: '13px',
    fontWeight: '700',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13.5px',
    textAlign: 'left',
  },
  th: {
    padding: '14px 16px',
    borderBottom: '1px solid rgba(212, 175, 55, 0.25)',
    color: '#d4af37',
    fontWeight: '800',
    fontSize: '11.5px',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  },
  tr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '16px',
    verticalAlign: 'middle',
  },
  bookingIdPill: {
    display: 'inline-flex',
    padding: '4px 10px',
    borderRadius: '8px',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
  },
  bookingIdText: {
    fontWeight: '900',
    color: '#fef08a',
    fontSize: '13px',
  },
  guestCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  guestName: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#ffffff',
  },
  guestPhone: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  roomCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  roomBadgePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12.5px',
    fontWeight: '800',
    color: '#fef08a',
  },
  roomCategory: {
    fontSize: '11.5px',
    color: '#94a3b8',
  },
  datesCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  dateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
  },
  dateLabel: {
    color: '#94a3b8',
    fontWeight: '600',
    width: '26px',
  },
  dateVal: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  nightsBadge: {
    fontSize: '10px',
    fontWeight: '800',
    padding: '1px 6px',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    borderRadius: '4px',
    color: '#fef08a',
  },
  financeCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  totalAmountVal: {
    fontSize: '14.5px',
    fontWeight: '900',
    color: '#fde047',
  },
  balanceRow: {
    display: 'flex',
    gap: '6px',
    fontSize: '11px',
  },
  paidBadge: {
    color: '#6ee7b7',
    fontWeight: '600',
  },
  dueBadge: {
    color: '#fca5a5',
    fontWeight: '600',
  },
  statusBadge: {
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
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '6px',
  },
  viewBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.35)',
    borderRadius: '8px',
    color: '#7dd3fc',
    fontSize: '12px',
    fontWeight: '700',
  },
  editBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    borderRadius: '8px',
    color: '#fef08a',
    fontSize: '12px',
    fontWeight: '700',
  },
  confirmActionBtn: {
    padding: '6px 8px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelActionBtn: {
    padding: '6px 8px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: '6px 8px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalBox: {
    backgroundColor: '#0a1020',
    borderRadius: '20px',
    border: '1px solid rgba(212, 175, 55, 0.45)',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(212, 175, 55, 0.15)',
    width: '100%',
    maxWidth: '640px',
    maxHeight: '90vh',
    overflowY: 'auto',
    animation: 'cardEntrance 0.25s ease-out',
  },
  modalHeader: {
    padding: '22px 26px',
    borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    backgroundColor: '#0a1020',
    zIndex: 10,
  },
  modalHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  modalIconWrap: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#fef08a',
    margin: 0,
  },
  modalSubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  modalCloseBtn: {
    padding: '6px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalForm: {
    padding: '24px 26px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#cbd5e1',
  },
  requiredMark: {
    color: '#f87171',
  },
  guestLinkBtn: {
    fontSize: '11px',
    color: '#d4af37',
    fontWeight: '700',
    textDecoration: 'underline',
  },
  checkingNote: {
    fontSize: '11px',
    color: '#38bdf8',
    fontWeight: '600',
  },
  input: {
    padding: '11px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
  },
  select: {
    padding: '11px 14px',
    backgroundColor: '#0a1020',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '10px',
    color: '#fef08a',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  errorText: {
    fontSize: '11px',
    color: '#f87171',
    fontWeight: '600',
  },
  calculationCard: {
    padding: '14px 18px',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  calcRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12.5px',
  },
  calcLabel: {
    color: '#cbd5e1',
  },
  calcValue: {
    color: '#ffffff',
    fontWeight: '700',
  },
  calcDivider: {
    height: '1px',
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
    margin: '4px 0',
  },
  totalCalcLabel: {
    fontSize: '13.5px',
    fontWeight: '800',
    color: '#fef08a',
  },
  totalCalcValue: {
    fontSize: '16px',
    fontWeight: '900',
    color: '#fde047',
  },
  balanceHelper: {
    fontSize: '11px',
    color: '#cbd5e1',
    marginTop: '2px',
  },
  modalActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '10px',
  },
  cancelBtn: {
    padding: '10px 20px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '10px',
    color: '#cbd5e1',
    fontSize: '13px',
    fontWeight: '700',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 22px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    border: '1px solid #fef08a',
    borderRadius: '10px',
    color: '#070a12',
    fontSize: '13px',
    fontWeight: '800',
    boxShadow: '0 0 16px rgba(212, 175, 55, 0.35)',
  },
  // View Folio Modal
  viewModalBox: {
    backgroundColor: '#0a1020',
    borderRadius: '20px',
    border: '1px solid rgba(212, 175, 55, 0.45)',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.95), 0 0 35px rgba(212, 175, 55, 0.2)',
    width: '100%',
    maxWidth: '680px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'cardEntrance 0.25s ease-out',
  },
  viewHeader: {
    padding: '22px 28px',
    borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'linear-gradient(135deg, #090e1c 0%, #0d1527 100%)',
  },
  viewHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  folioIconWrap: {
    width: '46px',
    height: '46px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewTitle: {
    fontSize: '19px',
    fontWeight: '900',
    color: '#fef08a',
    margin: 0,
  },
  viewSubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  viewBody: {
    padding: '24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  folioGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  folioCard: {
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(212, 175, 55, 0.22)',
    borderRadius: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  folioCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11.5px',
    fontWeight: '800',
    color: '#d4af37',
    textTransform: 'uppercase',
  },
  folioCardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  guestMainName: {
    fontSize: '15px',
    fontWeight: '800',
    color: '#ffffff',
  },
  roomMainNum: {
    fontSize: '16px',
    fontWeight: '900',
    color: '#fef08a',
  },
  folioMetaItem: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  folioDetailsSection: {
    padding: '16px 20px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  folioSectionTitle: {
    fontSize: '13px',
    fontWeight: '800',
    color: '#fef08a',
    borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
    paddingBottom: '8px',
  },
  folioRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  folioLabel: {
    color: '#94a3b8',
  },
  folioValue: {
    color: '#ffffff',
    fontWeight: '600',
  },
  folioValueGold: {
    color: '#fde047',
    fontWeight: '800',
  },
  folioValueGreen: {
    color: '#6ee7b7',
    fontWeight: '800',
  },
  folioValueDue: {
    color: '#fca5a5',
    fontWeight: '800',
  },
  statusUpdateRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '12px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  statusRowLabel: {
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#fef08a',
  },
  statusBtnsGroup: {
    display: 'flex',
    gap: '8px',
  },
  quickConfirmBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    border: '1px solid rgba(16, 185, 129, 0.45)',
    borderRadius: '8px',
    color: '#6ee7b7',
    fontSize: '12px',
    fontWeight: '700',
  },
  quickCancelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.45)',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '12px',
    fontWeight: '700',
  },
  viewFooter: {
    padding: '16px 26px',
    borderTop: '1px solid rgba(212, 175, 55, 0.2)',
    display: 'flex',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  // Delete Modal
  deleteModalBox: {
    backgroundColor: '#0a1020',
    borderRadius: '20px',
    border: '1px solid rgba(239, 68, 68, 0.45)',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(239, 68, 68, 0.15)',
    width: '100%',
    maxWidth: '520px',
    padding: '26px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    animation: 'cardEntrance 0.25s ease-out',
  },
  deleteHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  deleteIconWrap: {
    width: '46px',
    height: '46px',
    borderRadius: '14px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#ffffff',
    margin: 0,
  },
  deleteSubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  deleteContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  deleteWarningText: {
    fontSize: '14px',
    color: '#ffffff',
    lineHeight: '1.5',
    margin: 0,
  },
  deleteMetaPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    fontSize: '12px',
    color: '#fef08a',
  },
  deleteSubtext: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: 0,
  },
  confirmDeleteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#dc2626',
    border: '1px solid #ef4444',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '800',
    boxShadow: '0 0 16px rgba(239, 68, 68, 0.35)',
  },
}
