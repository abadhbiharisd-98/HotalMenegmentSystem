import { useState, useEffect, useMemo } from 'react'
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  CreditCard,
  Calendar,
  History,
  Eye,
  ShieldAlert,
  ArrowUpDown,
  Filter,
  Globe,
  BedDouble,
  Clock,
  IndianRupee,
} from 'lucide-react'
import { guestAPI } from '../services/api'
import SummaryCard from '../components/dashboard/SummaryCard'

const VALID_ID_TYPES = ['Aadhar Card', 'Passport', 'Driving License', 'National ID', 'Other']

export default function Guests() {
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [apiError, setApiError] = useState(null)
  const [toast, setToast] = useState(null) // { type: 'success' | 'error', message: string }

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIdType, setSelectedIdType] = useState('all')
  const [selectedNationality, setSelectedNationality] = useState('all')
  const [sortBy, setSortBy] = useState('created_at') // 'created_at' | 'name' | 'id'
  const [sortOrder, setSortOrder] = useState('desc') // 'asc' | 'desc'

  // Add / Edit Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' | 'edit'
  const [currentGuest, setCurrentGuest] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState({})

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idType: 'Aadhar Card',
    idNumber: '',
    address: '',
    nationality: 'Indian',
  })

  // View Profile & History Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [guestHistory, setGuestHistory] = useState([])

  // Delete Safeguard Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [guestToDelete, setGuestToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeStayWarning, setActiveStayWarning] = useState(false)

  // Fetch all guests
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        const res = await guestAPI.getGuests()
        if (!isMounted) return

        const list = res?.data || []
        setGuests(list)
        setApiError(null)
      } catch (err) {
        if (isMounted) {
          setApiError(err?.message || 'Failed to fetch guest registry from PostgreSQL.')
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

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = guests.length
    const indian = guests.filter((g) => (g.nationality || '').toLowerCase() === 'indian').length
    const international = total - indian
    const aadharVerified = guests.filter((g) => g.id_type === 'Aadhar Card').length
    return { total, indian, international, aadharVerified }
  }, [guests])

  // Filter & Search Logic
  const filteredGuests = useMemo(() => {
    return guests
      .filter((guest) => {
        const query = searchTerm.trim().toLowerCase()
        const fullName = `${guest.first_name || ''} ${guest.last_name || ''}`.toLowerCase()
        const matchesSearch =
          query === '' ||
          fullName.includes(query) ||
          (guest.phone || '').toLowerCase().includes(query) ||
          (guest.email || '').toLowerCase().includes(query) ||
          (guest.id_number || '').toLowerCase().includes(query) ||
          String(guest.id) === query

        const matchesIdType =
          selectedIdType === 'all' || guest.id_type === selectedIdType

        const matchesNat =
          selectedNationality === 'all' ||
          (selectedNationality === 'Indian'
            ? (guest.nationality || '').toLowerCase() === 'indian'
            : (guest.nationality || '').toLowerCase() !== 'indian')

        return matchesSearch && matchesIdType && matchesNat
      })
      .sort((a, b) => {
        let valA
        let valB

        if (sortBy === 'name') {
          valA = `${a.first_name} ${a.last_name}`.toLowerCase()
          valB = `${b.first_name} ${b.last_name}`.toLowerCase()
        } else if (sortBy === 'id') {
          valA = parseInt(a.id, 10)
          valB = parseInt(b.id, 10)
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
  }, [guests, searchTerm, selectedIdType, selectedNationality, sortBy, sortOrder])

  // Open Add Modal
  const openAddModal = () => {
    setModalMode('add')
    setCurrentGuest(null)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      idType: 'Aadhar Card',
      idNumber: '',
      address: '',
      nationality: 'Indian',
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const openEditModal = (guest) => {
    setModalMode('edit')
    setCurrentGuest(guest)
    setFormData({
      firstName: guest.first_name || '',
      lastName: guest.last_name || '',
      email: guest.email || '',
      phone: guest.phone || '',
      idType: guest.id_type || 'Aadhar Card',
      idNumber: guest.id_number || '',
      address: guest.address || '',
      nationality: guest.nationality || 'Indian',
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  // Open Profile & History Modal
  const openProfileModal = async (guest) => {
    setSelectedProfile(guest)
    setProfileModalOpen(true)
    setHistoryLoading(true)
    setGuestHistory([])

    try {
      const res = await guestAPI.getGuestHistory(guest.id)
      setGuestHistory(res?.data || [])
    } catch {
      setGuestHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  // Open Delete Safeguard Modal
  const openDeleteModal = async (guest) => {
    setGuestToDelete(guest)
    setActiveStayWarning(false)
    setDeleteModalOpen(true)

    // Check if guest has active stay/reservations
    try {
      const historyRes = await guestAPI.getGuestHistory(guest.id)
      const records = historyRes?.data || []
      const hasActive = records.some(
        (r) =>
          r.reservation_status === 'pending' ||
          r.reservation_status === 'confirmed' ||
          (r.actual_check_in && !r.actual_check_out)
      )
      if (hasActive) {
        setActiveStayWarning(true)
      }
    } catch {
      // Safe fallback
    }
  }

  // Validation
  const validateForm = () => {
    const errors = {}
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required.'
    } else if (formData.firstName.trim().length > 60) {
      errors.firstName = 'First name cannot exceed 60 characters.'
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required.'
    } else if (formData.lastName.trim().length > 60) {
      errors.lastName = 'Last name cannot exceed 60 characters.'
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Mobile number is required.'
    } else if (!/^[0-9+\s-]{7,20}$/.test(formData.phone.trim())) {
      errors.phone = 'Please enter a valid phone number (min 7 digits).'
    }

    if (!formData.idNumber.trim()) {
      errors.idNumber = 'Government ID number is required.'
    }

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address.'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Submit Add / Edit Form
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    setApiError(null)

    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim(),
      idType: formData.idType,
      idNumber: formData.idNumber.trim(),
      address: formData.address.trim() || null,
      nationality: formData.nationality.trim() || 'Indian',
    }

    try {
      if (modalMode === 'add') {
        const res = await guestAPI.createGuest(payload)
        setToast({
          type: 'success',
          message: `Guest "${payload.firstName} ${payload.lastName}" registered successfully in PostgreSQL.`,
        })
        if (res?.data) {
          setGuests((prev) => [res.data, ...prev])
        } else {
          setRefreshTrigger((prev) => prev + 1)
        }
      } else {
        const res = await guestAPI.updateGuest(currentGuest.id, payload)
        setToast({
          type: 'success',
          message: `Guest profile #${currentGuest.id} updated successfully.`,
        })
        if (res?.data) {
          setGuests((prev) =>
            prev.map((g) => (g.id === currentGuest.id ? res.data : g))
          )
        } else {
          setRefreshTrigger((prev) => prev + 1)
        }
      }
      setIsModalOpen(false)
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.message || 'Operation failed. Please verify your input.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!guestToDelete) return

    if (activeStayWarning) {
      setToast({
        type: 'error',
        message: `Deletion Safeguard: Cannot delete guest #${guestToDelete.id} because they have active bookings or an ongoing hotel stay.`,
      })
      setDeleteModalOpen(false)
      return
    }

    setIsDeleting(true)
    try {
      await guestAPI.deleteGuest(guestToDelete.id)
      setGuests((prev) => prev.filter((g) => g.id !== guestToDelete.id))
      setToast({
        type: 'success',
        message: `Guest profile for ${guestToDelete.first_name} ${guestToDelete.last_name} deleted from database.`,
      })
      setDeleteModalOpen(false)
      setGuestToDelete(null)
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to delete guest profile.',
      })
    } finally {
      setIsDeleting(false)
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
            <Users size={14} color="#fef08a" />
            <span>GUEST INTELLIGENCE & DIRECTORY</span>
          </div>
          <h1 style={styles.headerTitle}>Guest Profiles & Stay Registry</h1>
          <p style={styles.headerSubtitle}>
            Manage registered hotel guests, government ID verifications, and historical reservation records synchronized with PostgreSQL 18.
          </p>
        </div>

        <div style={styles.headerRight}>
          <button style={styles.addBtn} onClick={openAddModal}>
            <UserPlus size={18} color="#070a12" />
            <span>Register New Guest</span>
          </button>
          <button
            style={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Fetch latest guests from PostgreSQL"
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
          title="Total Guests"
          value={metrics.total}
          subtitle="Registered in PostgreSQL"
          icon={Users}
          gradient="linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)"
          bgSoft="rgba(212, 175, 55, 0.15)"
          iconColor="#fbbf24"
          badge="Lifetime Profiles"
          badgeColor="#fef08a"
          badgeBg="rgba(212, 175, 55, 0.2)"
          loading={loading}
          delay={50}
        />
        <SummaryCard
          title="Indian Nationals"
          value={metrics.indian}
          subtitle="Domestic guest records"
          icon={Globe}
          gradient="linear-gradient(135deg, #a7f3d0 0%, #10b981 50%, #047857 100%)"
          bgSoft="rgba(16, 185, 129, 0.15)"
          iconColor="#34d399"
          badge={metrics.total > 0 ? `${Math.round((metrics.indian / metrics.total) * 100)}% Local` : '0%'}
          badgeColor="#6ee7b7"
          badgeBg="rgba(16, 185, 129, 0.2)"
          loading={loading}
          delay={100}
        />
        <SummaryCard
          title="International"
          value={metrics.international}
          subtitle="Passport verified guests"
          icon={ShieldCheck}
          gradient="linear-gradient(135deg, #fed7aa 0%, #f59e0b 50%, #b45309 100%)"
          bgSoft="rgba(245, 158, 11, 0.15)"
          iconColor="#fbbf24"
          badge={metrics.international > 0 ? 'International' : 'None active'}
          badgeColor="#fde047"
          badgeBg="rgba(245, 158, 11, 0.2)"
          loading={loading}
          delay={150}
        />
        <SummaryCard
          title="Aadhar Verified"
          value={metrics.aadharVerified}
          subtitle="UIDAI verified IDs"
          icon={CreditCard}
          gradient="linear-gradient(135deg, #ddd6fe 0%, #8b5cf6 50%, #5b21b6 100%)"
          bgSoft="rgba(139, 92, 246, 0.15)"
          iconColor="#a78bfa"
          badge="Aadhar Card"
          badgeColor="#c4b5fd"
          badgeBg="rgba(139, 92, 246, 0.2)"
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

      {/* Control Bar: Search, ID Type Filter, Nationality Filter, Sorting */}
      <div style={styles.controlsCard}>
        <div style={styles.searchWrapper}>
          <Search size={18} color="#94a3b8" style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by Name, Phone, Email, or Guest ID..."
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
          {/* ID Type Filter */}
          <div style={styles.filterGroup}>
            <CreditCard size={14} color="#d4af37" />
            <select
              value={selectedIdType}
              onChange={(e) => setSelectedIdType(e.target.value)}
              style={styles.selectFilter}
            >
              <option value="all">All ID Types</option>
              {VALID_ID_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Nationality Filter */}
          <div style={styles.filterGroup}>
            <Filter size={14} color="#d4af37" />
            <select
              value={selectedNationality}
              onChange={(e) => setSelectedNationality(e.target.value)}
              style={styles.selectFilter}
            >
              <option value="all">All Nationalities</option>
              <option value="Indian">Indian</option>
              <option value="International">International</option>
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
              <option value="name-asc">Name (A to Z)</option>
              <option value="name-desc">Name (Z to A)</option>
              <option value="id-asc">Guest ID (Asc)</option>
              <option value="id-desc">Guest ID (Desc)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div style={styles.tableCard}>
        <div style={styles.tableCardHeader}>
          <div>
            <h2 style={styles.tableCardTitle}>
              Registered Guests Directory ({filteredGuests.length}{' '}
              {filteredGuests.length === 1 ? 'profile' : 'profiles'})
            </h2>
            <span style={styles.tableCardSubtitle}>
              {searchTerm || selectedIdType !== 'all' || selectedNationality !== 'all'
                ? 'Filtered guest database query results'
                : 'All guest profile records stored in PostgreSQL'}
            </span>
          </div>

          {(searchTerm || selectedIdType !== 'all' || selectedNationality !== 'all') && (
            <button
              style={styles.resetFiltersBtn}
              onClick={() => {
                setSearchTerm('')
                setSelectedIdType('all')
                setSelectedNationality('all')
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {loading ? (
          <div style={styles.loadingState}>
            <RefreshCw size={26} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Loading guest profiles from PostgreSQL...</span>
          </div>
        ) : filteredGuests.length === 0 ? (
          <div style={styles.emptyState}>
            <Users size={48} color="#94a3b8" style={{ opacity: 0.5 }} />
            <h3 style={styles.emptyTitle}>No Guest Profiles Found</h3>
            <p style={styles.emptyText}>
              {searchTerm || selectedIdType !== 'all' || selectedNationality !== 'all'
                ? 'No guests match your active search and filter criteria.'
                : 'No guests are registered in the hotel database yet. Click "Register New Guest" to create your first profile.'}
            </p>
            {searchTerm || selectedIdType !== 'all' || selectedNationality !== 'all' ? (
              <button
                style={styles.emptyActionBtn}
                onClick={() => {
                  setSearchTerm('')
                  setSelectedIdType('all')
                  setSelectedNationality('all')
                }}
              >
                Clear All Filters
              </button>
            ) : (
              <button style={styles.emptyActionBtn} onClick={openAddModal}>
                + Register First Guest
              </button>
            )}
          </div>
        ) : (
          /* Table View */
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Guest Name</th>
                  <th style={styles.th}>Contact Info</th>
                  <th style={styles.th}>Government ID</th>
                  <th style={styles.th}>Nationality & Address</th>
                  <th style={styles.th}>Registered</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuests.map((guest) => {
                  const initials = `${guest.first_name?.[0] || ''}${guest.last_name?.[0] || ''}`.toUpperCase()
                  const idNum = guest.id_number || ''
                  // Privacy masking: show only last 4 digits
                  const maskedId =
                    idNum.length > 4 ? `•••• •••• ${idNum.slice(-4)}` : idNum

                  return (
                    <tr key={guest.id} style={styles.tr}>
                      {/* Guest Name & Avatar */}
                      <td style={styles.td}>
                        <div style={styles.guestCell}>
                          <div style={styles.avatarPill}>
                            <span>{initials}</span>
                          </div>
                          <div style={styles.nameBlock}>
                            <span style={styles.guestName}>
                              {guest.first_name} {guest.last_name}
                            </span>
                            <span style={styles.guestIdBadge}>ID #{guest.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td style={styles.td}>
                        <div style={styles.contactBlock}>
                          <div style={styles.contactRow}>
                            <Phone size={13} color="#d4af37" />
                            <span style={styles.contactText}>{guest.phone}</span>
                          </div>
                          {guest.email && (
                            <div style={styles.contactRow}>
                              <Mail size={13} color="#94a3b8" />
                              <span style={styles.emailText}>{guest.email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Government ID with privacy masking */}
                      <td style={styles.td}>
                        <div style={styles.idBlock}>
                          <span style={styles.idTypeBadge}>{guest.id_type || 'Aadhar Card'}</span>
                          <span style={styles.idNumberText} title={`Full ID: ${idNum}`}>
                            {maskedId}
                          </span>
                        </div>
                      </td>

                      {/* Nationality & Address */}
                      <td style={styles.td}>
                        <div style={styles.locationBlock}>
                          <div style={styles.natBadgeRow}>
                            <Globe size={12} color="#10b981" />
                            <span style={styles.natBadge}>{guest.nationality || 'Indian'}</span>
                          </div>
                          {guest.address && (
                            <div style={styles.addressRow} title={guest.address}>
                              <MapPin size={12} color="#94a3b8" />
                              <span style={styles.addressText}>{guest.address}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Registered Date */}
                      <td style={styles.td}>
                        <div style={styles.dateBlock}>
                          <Calendar size={13} color="#d4af37" />
                          <span style={styles.dateText}>
                            {guest.created_at
                              ? new Date(guest.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Recent'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <div style={styles.actionGroup}>
                          <button
                            style={styles.viewBtn}
                            onClick={() => openProfileModal(guest)}
                            title="View full profile & stay history"
                          >
                            <Eye size={15} color="#38bdf8" />
                            <span>History</span>
                          </button>

                          <button
                            style={styles.editBtn}
                            onClick={() => openEditModal(guest)}
                            title="Edit guest profile"
                          >
                            <Pencil size={15} color="#d4af37" />
                            <span>Edit</span>
                          </button>

                          <button
                            style={styles.deleteBtn}
                            onClick={() => openDeleteModal(guest)}
                            title="Delete guest record"
                          >
                            <Trash2 size={15} color="#f87171" />
                            <span>Delete</span>
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

      {/* Add / Edit Guest Modal */}
      {isModalOpen && (
        <div style={styles.modalOverlay} onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalHeaderLeft}>
                <div style={styles.modalIconWrap}>
                  <Users size={20} color="#d4af37" />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>
                    {modalMode === 'add' ? 'Register New Guest' : `Edit Profile: ${currentGuest?.first_name} ${currentGuest?.last_name}`}
                  </h3>
                  <span style={styles.modalSubtitle}>
                    {modalMode === 'add'
                      ? 'Add verified guest profile into PostgreSQL directory'
                      : 'Update contact details or government ID record'}
                  </span>
                </div>
              </div>

              <button
                style={styles.modalCloseBtn}
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={styles.modalForm}>
              <div style={styles.formRow}>
                {/* First Name */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    First Name <span style={styles.requiredMark}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul, Priya"
                    value={formData.firstName}
                    onChange={(e) => {
                      setFormData({ ...formData, firstName: e.target.value })
                      if (formErrors.firstName) setFormErrors({ ...formErrors, firstName: null })
                    }}
                    style={{
                      ...styles.input,
                      borderColor: formErrors.firstName ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                    }}
                  />
                  {formErrors.firstName && (
                    <span style={styles.errorText}>{formErrors.firstName}</span>
                  )}
                </div>

                {/* Last Name */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Last Name <span style={styles.requiredMark}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma, Verma"
                    value={formData.lastName}
                    onChange={(e) => {
                      setFormData({ ...formData, lastName: e.target.value })
                      if (formErrors.lastName) setFormErrors({ ...formErrors, lastName: null })
                    }}
                    style={{
                      ...styles.input,
                      borderColor: formErrors.lastName ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                    }}
                  />
                  {formErrors.lastName && (
                    <span style={styles.errorText}>{formErrors.lastName}</span>
                  )}
                </div>
              </div>

              <div style={styles.formRow}>
                {/* Mobile / Phone */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Mobile Number <span style={styles.requiredMark}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value })
                      if (formErrors.phone) setFormErrors({ ...formErrors, phone: null })
                    }}
                    style={{
                      ...styles.input,
                      borderColor: formErrors.phone ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                    }}
                  />
                  {formErrors.phone && <span style={styles.errorText}>{formErrors.phone}</span>}
                </div>

                {/* Email */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="e.g. guest@example.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value })
                      if (formErrors.email) setFormErrors({ ...formErrors, email: null })
                    }}
                    style={{
                      ...styles.input,
                      borderColor: formErrors.email ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                    }}
                  />
                  {formErrors.email && <span style={styles.errorText}>{formErrors.email}</span>}
                </div>
              </div>

              <div style={styles.formRow}>
                {/* ID Type */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Government ID Document <span style={styles.requiredMark}>*</span>
                  </label>
                  <select
                    value={formData.idType}
                    onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                    style={styles.select}
                  >
                    {VALID_ID_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ID Number */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    ID Document Number <span style={styles.requiredMark}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1234-5678-9012 or Passport #"
                    value={formData.idNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, idNumber: e.target.value })
                      if (formErrors.idNumber) setFormErrors({ ...formErrors, idNumber: null })
                    }}
                    style={{
                      ...styles.input,
                      borderColor: formErrors.idNumber ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                    }}
                  />
                  {formErrors.idNumber && (
                    <span style={styles.errorText}>{formErrors.idNumber}</span>
                  )}
                </div>
              </div>

              <div style={styles.formRow}>
                {/* Nationality */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Nationality</label>
                  <input
                    type="text"
                    placeholder="e.g. Indian, American, British"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    style={styles.input}
                  />
                </div>

                {/* Address */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Residential Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 12/B Park Street, Kolkata, WB"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} color="#070a12" style={{ animation: 'spin 0.8s linear infinite' }} />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <span>{modalMode === 'add' ? 'Register Guest' : 'Save Changes'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guest Profile & Stay History Drawer/Modal */}
      {profileModalOpen && selectedProfile && (
        <div style={styles.modalOverlay} onClick={() => setProfileModalOpen(false)}>
          <div style={styles.profileModalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.profileHeader}>
              <div style={styles.profileHeaderLeft}>
                <div style={styles.profileAvatarBig}>
                  <span>
                    {`${selectedProfile.first_name?.[0] || ''}${selectedProfile.last_name?.[0] || ''}`.toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 style={styles.profileTitle}>
                    {selectedProfile.first_name} {selectedProfile.last_name}
                  </h3>
                  <div style={styles.profileMetaLine}>
                    <span style={styles.profileGuestId}>Guest ID #{selectedProfile.id}</span>
                    <span>•</span>
                    <span style={styles.profileNatPill}>{selectedProfile.nationality || 'Indian'}</span>
                  </div>
                </div>
              </div>

              <button style={styles.modalCloseBtn} onClick={() => setProfileModalOpen(false)}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <div style={styles.profileBody}>
              {/* Profile Details Cards */}
              <div style={styles.profileDetailsGrid}>
                <div style={styles.profileDetailCard}>
                  <span style={styles.detailCardLabel}>Mobile Contact</span>
                  <div style={styles.detailCardValRow}>
                    <Phone size={14} color="#d4af37" />
                    <span style={styles.detailCardValue}>{selectedProfile.phone}</span>
                  </div>
                </div>

                <div style={styles.profileDetailCard}>
                  <span style={styles.detailCardLabel}>Email Address</span>
                  <div style={styles.detailCardValRow}>
                    <Mail size={14} color="#d4af37" />
                    <span style={styles.detailCardValue}>{selectedProfile.email || 'Not provided'}</span>
                  </div>
                </div>

                <div style={styles.profileDetailCard}>
                  <span style={styles.detailCardLabel}>{selectedProfile.id_type || 'ID Document'}</span>
                  <div style={styles.detailCardValRow}>
                    <CreditCard size={14} color="#d4af37" />
                    <span style={styles.detailCardValue}>{selectedProfile.id_number}</span>
                  </div>
                </div>

                <div style={styles.profileDetailCard}>
                  <span style={styles.detailCardLabel}>Residential Address</span>
                  <div style={styles.detailCardValRow}>
                    <MapPin size={14} color="#d4af37" />
                    <span style={styles.detailCardValue}>{selectedProfile.address || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              {/* Stay & Booking History Section */}
              <div style={styles.historySection}>
                <div style={styles.historySectionHeader}>
                  <div style={styles.historyTitleWrap}>
                    <History size={17} color="#d4af37" />
                    <h4 style={styles.historyTitle}>Booking & Stay History</h4>
                  </div>
                  <span style={styles.historyCountBadge}>
                    {guestHistory.length} {guestHistory.length === 1 ? 'Record' : 'Records'} in PostgreSQL
                  </span>
                </div>

                {historyLoading ? (
                  <div style={styles.historyLoading}>
                    <RefreshCw size={20} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Retrieving booking records...</span>
                  </div>
                ) : guestHistory.length === 0 ? (
                  <div style={styles.historyEmpty}>
                    <BedDouble size={36} color="#94a3b8" style={{ opacity: 0.4 }} />
                    <p style={styles.historyEmptyText}>
                      No reservation or check-in records on file for this guest yet.
                    </p>
                  </div>
                ) : (
                  <div style={styles.historyList}>
                    {guestHistory.map((item) => (
                      <div key={item.reservation_id} style={styles.historyCard}>
                        <div style={styles.historyCardTop}>
                          <div style={styles.historyRoomBadge}>
                            <BedDouble size={14} color="#fef08a" />
                            <span>Room #{item.room_number || 'TBD'} ({item.room_type || 'Suite'})</span>
                          </div>
                          <span
                            style={{
                              ...styles.historyStatusBadge,
                              backgroundColor:
                                item.reservation_status === 'confirmed'
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : item.reservation_status === 'completed'
                                  ? 'rgba(56, 189, 248, 0.2)'
                                  : 'rgba(245, 158, 11, 0.2)',
                              color:
                                item.reservation_status === 'confirmed'
                                  ? '#6ee7b7'
                                  : item.reservation_status === 'completed'
                                  ? '#7dd3fc'
                                  : '#fde047',
                              borderColor:
                                item.reservation_status === 'confirmed'
                                  ? 'rgba(16, 185, 129, 0.4)'
                                  : item.reservation_status === 'completed'
                                  ? 'rgba(56, 189, 248, 0.4)'
                                  : 'rgba(245, 158, 11, 0.4)',
                            }}
                          >
                            {(item.reservation_status || 'PENDING').toUpperCase()}
                          </span>
                        </div>

                        <div style={styles.historyCardBody}>
                          <div style={styles.historyDateRow}>
                            <Clock size={13} color="#94a3b8" />
                            <span>
                              Check-In: <strong>{item.check_in_date ? new Date(item.check_in_date).toLocaleDateString() : 'N/A'}</strong>
                            </span>
                            <span>→</span>
                            <span>
                              Check-Out: <strong>{item.check_out_date ? new Date(item.check_out_date).toLocaleDateString() : 'N/A'}</strong>
                            </span>
                          </div>

                          <div style={styles.historyPriceRow}>
                            <IndianRupee size={14} color="#fde047" />
                            <span style={styles.historyAmount}>
                              ₹{parseFloat(item.total_amount || 0).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                            {item.room_key_status && (
                              <span style={styles.keyBadge}>Key: {item.room_key_status}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={styles.profileFooter}>
              <button style={styles.cancelBtn} onClick={() => setProfileModalOpen(false)}>
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Safeguard Modal */}
      {deleteModalOpen && guestToDelete && (
        <div style={styles.modalOverlay} onClick={() => !isDeleting && setDeleteModalOpen(false)}>
          <div style={styles.deleteModalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.deleteHeader}>
              <div style={styles.deleteIconWrap}>
                <ShieldAlert size={24} color="#f87171" />
              </div>
              <div>
                <h3 style={styles.deleteTitle}>Delete Guest Profile</h3>
                <span style={styles.deleteSubtitle}>
                  PostgreSQL database record permanent removal confirmation
                </span>
              </div>
            </div>

            {activeStayWarning ? (
              /* Blocked by Safeguard Alert */
              <div style={styles.safeguardBlockedBox}>
                <AlertCircle size={22} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={styles.blockedTitle}>Deletion Blocked by System Safeguard</h4>
                  <p style={styles.blockedDesc}>
                    Guest <strong>{guestToDelete.first_name} {guestToDelete.last_name}</strong> (ID #{guestToDelete.id})
                    currently has active reservations or an in-house room accommodation.
                    The system strictly prevents deletion of guests with live hotel stays.
                    Please process room check-out or cancel active bookings prior to deletion.
                  </p>
                </div>
              </div>
            ) : (
              /* Confirmation */
              <div style={styles.deleteContent}>
                <p style={styles.deleteWarningText}>
                  Are you sure you want to permanently delete the profile for{' '}
                  <strong>{guestToDelete.first_name} {guestToDelete.last_name}</strong> (ID #{guestToDelete.id}, Mobile: {guestToDelete.phone})?
                </p>
                <div style={styles.deleteMetaPill}>
                  <span>ID Document: <strong>{guestToDelete.id_type}</strong> ({guestToDelete.id_number})</span>
                  <span>•</span>
                  <span>Nationality: <strong>{guestToDelete.nationality}</strong></span>
                </div>
                <p style={styles.deleteSubtext}>
                  This operation removes the guest directory profile from PostgreSQL. It cannot be undone.
                </p>
              </div>
            )}

            <div style={styles.modalActions}>
              <button
                style={styles.cancelBtn}
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                {activeStayWarning ? 'Close' : 'Cancel'}
              </button>

              {!activeStayWarning && (
                <button
                  style={styles.confirmDeleteBtn}
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
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
              )}
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
  guestCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatarPill: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.25) 0%, rgba(180, 83, 9, 0.2) 100%)',
    border: '1px solid rgba(212, 175, 55, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '900',
    color: '#fef08a',
    fontSize: '14px',
    flexShrink: 0,
  },
  nameBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  guestName: {
    fontSize: '14.5px',
    fontWeight: '800',
    color: '#ffffff',
  },
  guestIdBadge: {
    fontSize: '11px',
    color: '#d4af37',
    fontWeight: '700',
  },
  contactBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  contactRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  contactText: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  emailText: {
    fontSize: '11.5px',
    color: '#94a3b8',
  },
  idBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  idTypeBadge: {
    display: 'inline-flex',
    fontSize: '10.5px',
    fontWeight: '800',
    color: '#fef08a',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    padding: '2px 8px',
    borderRadius: '6px',
    width: 'fit-content',
  },
  idNumberText: {
    fontSize: '12.5px',
    fontWeight: '600',
    color: '#cbd5e1',
    letterSpacing: '0.4px',
  },
  locationBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  natBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  natBadge: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#6ee7b7',
  },
  addressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    maxWidth: '220px',
  },
  addressText: {
    fontSize: '11.5px',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dateBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  dateText: {
    fontSize: '12.5px',
    color: '#cbd5e1',
    fontWeight: '500',
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  viewBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.35)',
    borderRadius: '8px',
    color: '#7dd3fc',
    fontSize: '12px',
    fontWeight: '700',
    transition: 'all 0.15s ease',
  },
  editBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    borderRadius: '8px',
    color: '#fef08a',
    fontSize: '12px',
    fontWeight: '700',
    transition: 'all 0.15s ease',
  },
  deleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '12px',
    fontWeight: '700',
    transition: 'all 0.15s ease',
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
    maxWidth: '620px',
    overflow: 'hidden',
    animation: 'cardEntrance 0.25s ease-out',
  },
  modalHeader: {
    padding: '22px 26px',
    borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    gap: '18px',
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
  label: {
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#cbd5e1',
  },
  requiredMark: {
    color: '#f87171',
  },
  input: {
    padding: '11px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '13.5px',
    outline: 'none',
  },
  select: {
    padding: '11px 14px',
    backgroundColor: '#0a1020',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '10px',
    color: '#fef08a',
    fontSize: '13.5px',
    outline: 'none',
    cursor: 'pointer',
  },
  errorText: {
    fontSize: '11.5px',
    color: '#f87171',
    fontWeight: '600',
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
  // Profile Modal Specific
  profileModalBox: {
    backgroundColor: '#0a1020',
    borderRadius: '20px',
    border: '1px solid rgba(212, 175, 55, 0.45)',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.95), 0 0 35px rgba(212, 175, 55, 0.2)',
    width: '100%',
    maxWidth: '720px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'cardEntrance 0.25s ease-out',
  },
  profileHeader: {
    padding: '24px 28px',
    borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'linear-gradient(135deg, #090e1c 0%, #0d1527 100%)',
  },
  profileHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  profileAvatarBig: {
    width: '54px',
    height: '54px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: '900',
    color: '#070a12',
    boxShadow: '0 0 15px rgba(212, 175, 55, 0.4)',
  },
  profileTitle: {
    fontSize: '20px',
    fontWeight: '900',
    color: '#fef08a',
    margin: 0,
  },
  profileMetaLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  profileGuestId: {
    fontWeight: '700',
    color: '#d4af37',
  },
  profileNatPill: {
    fontWeight: '600',
    color: '#6ee7b7',
  },
  profileBody: {
    padding: '26px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  profileDetailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '14px',
  },
  profileDetailCard: {
    padding: '14px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  detailCardLabel: {
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#94a3b8',
    letterSpacing: '0.6px',
  },
  detailCardValRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  detailCardValue: {
    fontSize: '13.5px',
    fontWeight: '700',
    color: '#ffffff',
  },
  historySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  historySectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
    paddingBottom: '10px',
  },
  historyTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  historyTitle: {
    fontSize: '15px',
    fontWeight: '800',
    color: '#fef08a',
    margin: 0,
  },
  historyCountBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#d4af37',
    padding: '3px 10px',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderRadius: '20px',
    border: '1px solid rgba(212, 175, 55, 0.3)',
  },
  historyLoading: {
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    color: '#94a3b8',
    fontSize: '13px',
  },
  historyEmpty: {
    padding: '36px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '12px',
    border: '1px dashed rgba(212, 175, 55, 0.2)',
  },
  historyEmptyText: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: 0,
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  historyCard: {
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  historyCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyRoomBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: '800',
    color: '#fef08a',
  },
  historyStatusBadge: {
    fontSize: '10px',
    fontWeight: '800',
    padding: '3px 9px',
    borderRadius: '20px',
    border: '1px solid',
  },
  historyCardBody: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '8px',
  },
  historyDateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#cbd5e1',
  },
  historyPriceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  historyAmount: {
    fontSize: '14px',
    fontWeight: '900',
    color: '#fde047',
  },
  keyBadge: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#94a3b8',
    padding: '2px 6px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: '4px',
  },
  profileFooter: {
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
  safeguardBlockedBox: {
    display: 'flex',
    gap: '14px',
    padding: '16px',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    borderRadius: '12px',
  },
  blockedTitle: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#fde047',
    margin: '0 0 6px 0',
  },
  blockedDesc: {
    fontSize: '12.5px',
    color: '#cbd5e1',
    lineHeight: '1.5',
    margin: 0,
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
