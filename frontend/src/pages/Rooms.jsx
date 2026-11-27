import { useState, useEffect, useMemo } from 'react'
import {
  BedDouble,
  DoorOpen,
  DoorClosed,
  Wrench,
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Building,
  Layers,
  ShieldAlert,
  ArrowUpDown,
  Filter,
  LayoutGrid,
  List,
} from 'lucide-react'
import { roomAPI } from '../services/api'
import SummaryCard from '../components/dashboard/SummaryCard'

export default function Rooms() {
  const [rooms, setRooms] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [apiError, setApiError] = useState(null)
  const [toast, setToast] = useState(null) // { type: 'success' | 'error', message: string }

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'cards'
  const [sortBy, setSortBy] = useState('room_number') // 'room_number' | 'price' | 'floor'
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' | 'desc'

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' | 'edit'
  const [currentRoom, setCurrentRoom] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState({})

  // Form State
  const [formData, setFormData] = useState({
    roomNumber: '',
    roomTypeId: '',
    floor: 1,
    pricePerNight: '',
    status: 'available',
  })

  // Delete Safeguard Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [roomToDelete, setRoomToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch rooms and room types concurrently
  useEffect(() => {
    let isMounted = true

    async function fetchData() {
      try {
        const [roomsRes, typesRes] = await Promise.all([
          roomAPI.getRooms(),
          roomAPI.getRoomTypes(),
        ])

        if (!isMounted) return

        const roomsData = roomsRes?.data || []
        const typesData = typesRes?.data || []

        setRooms(roomsData)
        setRoomTypes(typesData)
        setApiError(null)
      } catch (err) {
        if (isMounted) {
          setApiError(err?.message || 'Failed to fetch rooms from PostgreSQL.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    fetchData()

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
    const total = rooms.length
    const available = rooms.filter((r) => r.status === 'available').length
    const occupied = rooms.filter((r) => r.status === 'occupied').length
    const maintenance = rooms.filter((r) => r.status === 'maintenance').length
    return { total, available, occupied, maintenance }
  }, [rooms])

  // Filter & Search Logic
  const filteredRooms = useMemo(() => {
    return rooms
      .filter((room) => {
        const matchesSearch =
          searchTerm.trim() === '' ||
          room.room_number.toLowerCase().includes(searchTerm.toLowerCase().trim())
        const matchesType =
          selectedType === 'all' ||
          String(room.room_type_id) === String(selectedType) ||
          room.room_type === selectedType
        const matchesStatus =
          selectedStatus === 'all' || room.status === selectedStatus

        return matchesSearch && matchesType && matchesStatus
      })
      .sort((a, b) => {
        let valA
        let valB

        if (sortBy === 'price') {
          valA = parseFloat(a.price_per_night || 0)
          valB = parseFloat(b.price_per_night || 0)
        } else if (sortBy === 'floor') {
          valA = parseInt(a.floor || 0, 10)
          valB = parseInt(b.floor || 0, 10)
        } else {
          valA = String(a.room_number || '')
          valB = String(b.room_number || '')
        }

        if (sortOrder === 'asc') {
          return valA > valB ? 1 : -1
        } else {
          return valA < valB ? 1 : -1
        }
      })
  }, [rooms, searchTerm, selectedType, selectedStatus, sortBy, sortOrder])

  // Open Add Modal
  const openAddModal = () => {
    setModalMode('add')
    setCurrentRoom(null)
    setFormData({
      roomNumber: '',
      roomTypeId: roomTypes[0]?.id ? String(roomTypes[0].id) : '',
      floor: 1,
      pricePerNight: roomTypes[0]?.base_price ? String(roomTypes[0].base_price) : '',
      status: 'available',
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const openEditModal = (room) => {
    setModalMode('edit')
    setCurrentRoom(room)
    setFormData({
      roomNumber: room.room_number,
      roomTypeId: String(room.room_type_id || ''),
      floor: room.floor,
      pricePerNight: String(room.price_per_night),
      status: room.status,
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  // Handle Room Type Selection (Auto prefill price from room type if user hasn't set custom)
  const handleTypeChange = (typeId) => {
    const selected = roomTypes.find((t) => String(t.id) === String(typeId))
    setFormData((prev) => ({
      ...prev,
      roomTypeId: typeId,
      pricePerNight: modalMode === 'add' && selected ? String(selected.base_price) : prev.pricePerNight,
    }))
    if (formErrors.roomTypeId) {
      setFormErrors((prev) => ({ ...prev, roomTypeId: null }))
    }
  }

  // Validation
  const validateForm = () => {
    const errors = {}
    if (!formData.roomNumber.trim()) {
      errors.roomNumber = 'Room number is required (e.g. 101, 204).'
    } else if (formData.roomNumber.trim().length > 20) {
      errors.roomNumber = 'Room number cannot exceed 20 characters.'
    }

    if (!formData.roomTypeId) {
      errors.roomTypeId = 'Please select a room category.'
    }

    if (formData.floor === '' || isNaN(formData.floor) || parseInt(formData.floor, 10) < 0) {
      errors.floor = 'Floor must be a valid non-negative number.'
    }

    if (
      formData.pricePerNight === '' ||
      isNaN(formData.pricePerNight) ||
      parseFloat(formData.pricePerNight) < 0
    ) {
      errors.pricePerNight = 'Price per night must be a valid positive number.'
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
      roomNumber: formData.roomNumber.trim(),
      roomTypeId: parseInt(formData.roomTypeId, 10),
      floor: parseInt(formData.floor, 10),
      status: formData.status,
      pricePerNight: parseFloat(formData.pricePerNight),
    }

    try {
      if (modalMode === 'add') {
        const res = await roomAPI.createRoom(payload)
        setToast({
          type: 'success',
          message: `Room #${payload.roomNumber} created successfully in PostgreSQL.`,
        })
        if (res?.data) {
          setRooms((prev) => [...prev, res.data].sort((a, b) => a.room_number.localeCompare(b.room_number)))
        } else {
          setRefreshTrigger((prev) => prev + 1)
        }
      } else {
        const res = await roomAPI.updateRoom(currentRoom.id, payload)
        setToast({
          type: 'success',
          message: `Room #${payload.roomNumber} updated successfully.`,
        })
        if (res?.data) {
          setRooms((prev) =>
            prev.map((r) => (r.id === currentRoom.id ? res.data : r))
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

  // Open Delete Safeguard Modal
  const openDeleteModal = (room) => {
    setRoomToDelete(room)
    setDeleteModalOpen(true)
  }

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!roomToDelete) return

    // Safeguard check: If room is occupied, block deletion
    if (roomToDelete.status === 'occupied') {
      setToast({
        type: 'error',
        message: `Deletion Safeguard: Cannot delete Room #${roomToDelete.room_number} because it is currently Occupied.`,
      })
      setDeleteModalOpen(false)
      return
    }

    setIsDeleting(true)
    try {
      await roomAPI.deleteRoom(roomToDelete.id)
      setRooms((prev) => prev.filter((r) => r.id !== roomToDelete.id))
      setToast({
        type: 'success',
        message: `Room #${roomToDelete.room_number} has been permanently deleted from database.`,
      })
      setDeleteModalOpen(false)
      setRoomToDelete(null)
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to delete room. It may have booking records.',
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
            <Building size={14} color="#fef08a" />
            <span>ROOM INVENTORY MANAGEMENT</span>
          </div>
          <h1 style={styles.headerTitle}>Rooms & Suites Directory</h1>
          <p style={styles.headerSubtitle}>
            Configure guest room availability, pricing tiers, and maintenance status with real-time PostgreSQL synchronization.
          </p>
        </div>

        <div style={styles.headerRight}>
          <button style={styles.addBtn} onClick={openAddModal}>
            <Plus size={18} color="#070a12" />
            <span>Add New Room</span>
          </button>
          <button
            style={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh from PostgreSQL"
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
          title="Total Rooms"
          value={metrics.total}
          subtitle="Registered in PostgreSQL"
          icon={BedDouble}
          gradient="linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)"
          bgSoft="rgba(212, 175, 55, 0.15)"
          iconColor="#fbbf24"
          badge="Total Inventory"
          badgeColor="#fef08a"
          badgeBg="rgba(212, 175, 55, 0.2)"
          loading={loading}
          delay={50}
        />
        <SummaryCard
          title="Available Rooms"
          value={metrics.available}
          subtitle="Ready for guest check-in"
          icon={DoorOpen}
          gradient="linear-gradient(135deg, #a7f3d0 0%, #10b981 50%, #047857 100%)"
          bgSoft="rgba(16, 185, 129, 0.15)"
          iconColor="#34d399"
          badge={metrics.total > 0 ? `${Math.round((metrics.available / metrics.total) * 100)}% Free` : '0%'}
          badgeColor="#6ee7b7"
          badgeBg="rgba(16, 185, 129, 0.2)"
          loading={loading}
          delay={100}
        />
        <SummaryCard
          title="Occupied Rooms"
          value={metrics.occupied}
          subtitle="In-house guest occupancy"
          icon={DoorClosed}
          gradient="linear-gradient(135deg, #fed7aa 0%, #f59e0b 50%, #b45309 100%)"
          bgSoft="rgba(245, 158, 11, 0.15)"
          iconColor="#fbbf24"
          badge={metrics.total > 0 ? `${Math.round((metrics.occupied / metrics.total) * 100)}% Booked` : '0%'}
          badgeColor="#fde047"
          badgeBg="rgba(245, 158, 11, 0.2)"
          loading={loading}
          delay={150}
        />
        <SummaryCard
          title="Under Maintenance"
          value={metrics.maintenance}
          subtitle="Repair or cleaning hold"
          icon={Wrench}
          gradient="linear-gradient(135deg, #fecdd3 0%, #f43f5e 50%, #9f1239 100%)"
          bgSoft="rgba(244, 63, 94, 0.15)"
          iconColor="#fb7185"
          badge={metrics.maintenance > 0 ? 'Action Needed' : 'All Clear'}
          badgeColor="#fda4af"
          badgeBg="rgba(244, 63, 94, 0.2)"
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

      {/* Control Bar: Search, Category Filter, Status Filter, View Mode */}
      <div style={styles.controlsCard}>
        <div style={styles.searchWrapper}>
          <Search size={18} color="#94a3b8" style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by Room Number (e.g. 101, 202)..."
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
          {/* Room Type Filter */}
          <div style={styles.filterGroup}>
            <Layers size={14} color="#d4af37" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={styles.selectFilter}
            >
              <option value="all">All Room Types ({roomTypes.length})</option>
              {roomTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} (₹{parseFloat(type.base_price).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={styles.filterGroup}>
            <Filter size={14} color="#d4af37" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={styles.selectFilter}
            >
              <option value="all">All Statuses</option>
              <option value="available">Available ({metrics.available})</option>
              <option value="occupied">Occupied ({metrics.occupied})</option>
              <option value="maintenance">Maintenance ({metrics.maintenance})</option>
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
              <option value="room_number-asc">Room # (Low to High)</option>
              <option value="room_number-desc">Room # (High to Low)</option>
              <option value="price-asc">Price (Low to High)</option>
              <option value="price-desc">Price (High to Low)</option>
              <option value="floor-asc">Floor Level (Ascending)</option>
            </select>
          </div>

          {/* View Toggle */}
          <div style={styles.viewToggleGroup}>
            <button
              style={{
                ...styles.viewBtn,
                ...(viewMode === 'table' ? styles.viewBtnActive : {}),
              }}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <List size={16} />
            </button>
            <button
              style={{
                ...styles.viewBtn,
                ...(viewMode === 'cards' ? styles.viewBtnActive : {}),
              }}
              onClick={() => setViewMode('cards')}
              title="Card Grid View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Data Section */}
      <div style={styles.tableCard}>
        <div style={styles.tableCardHeader}>
          <div>
            <h2 style={styles.tableCardTitle}>
              Active Room Registry ({filteredRooms.length}{' '}
              {filteredRooms.length === 1 ? 'room' : 'rooms'} listed)
            </h2>
            <span style={styles.tableCardSubtitle}>
              {searchTerm || selectedType !== 'all' || selectedStatus !== 'all'
                ? 'Filtered results based on active criteria'
                : 'Showing all registered units in database'}
            </span>
          </div>

          {(searchTerm || selectedType !== 'all' || selectedStatus !== 'all') && (
            <button
              style={styles.resetFiltersBtn}
              onClick={() => {
                setSearchTerm('')
                setSelectedType('all')
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
            <span>Loading rooms from PostgreSQL...</span>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div style={styles.emptyState}>
            <BedDouble size={48} color="#94a3b8" style={{ opacity: 0.5 }} />
            <h3 style={styles.emptyTitle}>No Rooms Match Your Criteria</h3>
            <p style={styles.emptyText}>
              Try adjusting your search query, room category, or status filter.
            </p>
            <button
              style={styles.emptyActionBtn}
              onClick={() => {
                setSearchTerm('')
                setSelectedType('all')
                setSelectedStatus('all')
              }}
            >
              Clear All Filters
            </button>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Room Number</th>
                  <th style={styles.th}>Room Category</th>
                  <th style={styles.th}>Floor</th>
                  <th style={styles.th}>Rate / Night</th>
                  <th style={styles.th}>Current Status</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((room) => {
                  const isOccupied = room.status === 'occupied'
                  const isAvailable = room.status === 'available'

                  return (
                    <tr key={room.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.roomPill}>
                          <span style={styles.roomPillText}>#{room.room_number}</span>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.typeCol}>
                          <span style={styles.typeName}>{room.room_type || 'Standard Suite'}</span>
                          {room.capacity && (
                            <span style={styles.capacityBadge}>Up to {room.capacity} Guests</span>
                          )}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.floorText}>Floor {room.floor}</span>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.priceContainer}>
                          <span style={styles.priceValue}>
                            ₹{parseFloat(room.price_per_night || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <span style={styles.priceUnit}>/ night</span>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            backgroundColor: isAvailable
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isOccupied
                              ? 'rgba(245, 158, 11, 0.18)'
                              : 'rgba(244, 63, 94, 0.15)',
                            borderColor: isAvailable
                              ? 'rgba(16, 185, 129, 0.4)'
                              : isOccupied
                              ? 'rgba(245, 158, 11, 0.45)'
                              : 'rgba(244, 63, 94, 0.4)',
                            color: isAvailable ? '#6ee7b7' : isOccupied ? '#fde047' : '#fda4af',
                          }}
                        >
                          <span
                            style={{
                              ...styles.statusDot,
                              backgroundColor: isAvailable
                                ? '#10b981'
                                : isOccupied
                                ? '#f59e0b'
                                : '#f43f5e',
                            }}
                          />
                          {room.status.toUpperCase()}
                        </span>
                      </td>

                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <div style={styles.actionGroup}>
                          <button
                            style={styles.editBtn}
                            onClick={() => openEditModal(room)}
                            title="Edit room configuration"
                          >
                            <Pencil size={15} color="#d4af37" />
                            <span>Edit</span>
                          </button>

                          <button
                            style={{
                              ...styles.deleteBtn,
                              ...(isOccupied ? styles.deleteBtnDisabled : {}),
                            }}
                            onClick={() => openDeleteModal(room)}
                            title={
                              isOccupied
                                ? 'Occupied rooms cannot be deleted (Safeguard active)'
                                : 'Delete room record'
                            }
                          >
                            <Trash2 size={15} color={isOccupied ? '#64748b' : '#f87171'} />
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
        ) : (
          /* Cards Grid View */
          <div style={styles.cardsGrid}>
            {filteredRooms.map((room) => {
              const isOccupied = room.status === 'occupied'
              const isAvailable = room.status === 'available'

              return (
                <div key={room.id} style={styles.roomCard}>
                  <div style={styles.roomCardTop}>
                    <div style={styles.roomPill}>
                      <span style={styles.roomPillText}>Room #{room.room_number}</span>
                    </div>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: isAvailable
                          ? 'rgba(16, 185, 129, 0.15)'
                          : isOccupied
                          ? 'rgba(245, 158, 11, 0.18)'
                          : 'rgba(244, 63, 94, 0.15)',
                        borderColor: isAvailable
                          ? 'rgba(16, 185, 129, 0.4)'
                          : isOccupied
                          ? 'rgba(245, 158, 11, 0.45)'
                          : 'rgba(244, 63, 94, 0.4)',
                        color: isAvailable ? '#6ee7b7' : isOccupied ? '#fde047' : '#fda4af',
                      }}
                    >
                      <span
                        style={{
                          ...styles.statusDot,
                          backgroundColor: isAvailable ? '#10b981' : isOccupied ? '#f59e0b' : '#f43f5e',
                        }}
                      />
                      {room.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={styles.roomCardBody}>
                    <h3 style={styles.cardTypeName}>{room.room_type || 'Standard Room'}</h3>
                    <div style={styles.cardDetailsRow}>
                      <span style={styles.cardDetailItem}>Floor {room.floor}</span>
                      {room.capacity && (
                        <span style={styles.cardDetailItem}>• Max {room.capacity} Guests</span>
                      )}
                    </div>
                    <div style={styles.cardPriceRow}>
                      <span style={styles.cardPrice}>
                        ₹{parseFloat(room.price_per_night || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span style={styles.cardPriceUnit}>/ night</span>
                    </div>
                  </div>

                  <div style={styles.roomCardActions}>
                    <button
                      style={styles.cardEditBtn}
                      onClick={() => openEditModal(room)}
                    >
                      <Pencil size={14} color="#d4af37" />
                      <span>Edit Room</span>
                    </button>
                    <button
                      style={{
                        ...styles.cardDeleteBtn,
                        ...(isOccupied ? styles.deleteBtnDisabled : {}),
                      }}
                      onClick={() => openDeleteModal(room)}
                      title={isOccupied ? 'Occupied room cannot be deleted' : 'Delete'}
                    >
                      <Trash2 size={14} color={isOccupied ? '#64748b' : '#f87171'} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Room Modal */}
      {isModalOpen && (
        <div style={styles.modalOverlay} onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalHeaderLeft}>
                <div style={styles.modalIconWrap}>
                  <BedDouble size={20} color="#d4af37" />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>
                    {modalMode === 'add' ? 'Add New Room Unit' : `Edit Room #${currentRoom?.room_number}`}
                  </h3>
                  <span style={styles.modalSubtitle}>
                    {modalMode === 'add'
                      ? 'Register a new room unit into PostgreSQL inventory'
                      : 'Modify room rate, category, or operational status'}
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
                {/* Room Number */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Room Number <span style={styles.requiredMark}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 101, 204, 301"
                    value={formData.roomNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, roomNumber: e.target.value })
                      if (formErrors.roomNumber) {
                        setFormErrors({ ...formErrors, roomNumber: null })
                      }
                    }}
                    style={{
                      ...styles.input,
                      borderColor: formErrors.roomNumber ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                    }}
                  />
                  {formErrors.roomNumber && (
                    <span style={styles.errorText}>{formErrors.roomNumber}</span>
                  )}
                </div>

                {/* Floor */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Floor Level <span style={styles.requiredMark}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 1, 2"
                    value={formData.floor}
                    onChange={(e) => {
                      setFormData({ ...formData, floor: e.target.value })
                      if (formErrors.floor) {
                        setFormErrors({ ...formErrors, floor: null })
                      }
                    }}
                    style={{
                      ...styles.input,
                      borderColor: formErrors.floor ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                    }}
                  />
                  {formErrors.floor && <span style={styles.errorText}>{formErrors.floor}</span>}
                </div>
              </div>

              {/* Room Type */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Room Category / Suite Tier <span style={styles.requiredMark}>*</span>
                </label>
                <select
                  value={formData.roomTypeId}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  style={{
                    ...styles.select,
                    borderColor: formErrors.roomTypeId ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                  }}
                >
                  <option value="">Select Room Type...</option>
                  {roomTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} (Base Price: ₹{parseFloat(type.base_price).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
                {formErrors.roomTypeId && (
                  <span style={styles.errorText}>{formErrors.roomTypeId}</span>
                )}
              </div>

              <div style={styles.formRow}>
                {/* Price Per Night */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Price Per Night (₹) <span style={styles.requiredMark}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 2500"
                    value={formData.pricePerNight}
                    onChange={(e) => {
                      setFormData({ ...formData, pricePerNight: e.target.value })
                      if (formErrors.pricePerNight) {
                        setFormErrors({ ...formErrors, pricePerNight: null })
                      }
                    }}
                    style={{
                      ...styles.input,
                      borderColor: formErrors.pricePerNight ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                    }}
                  />
                  {formErrors.pricePerNight && (
                    <span style={styles.errorText}>{formErrors.pricePerNight}</span>
                  )}
                </div>

                {/* Status */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Initial Operational Status <span style={styles.requiredMark}>*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={styles.select}
                  >
                    <option value="available">Available (Ready for check-in)</option>
                    <option value="occupied">Occupied (Guest in-house)</option>
                    <option value="maintenance">Maintenance (Out of service)</option>
                  </select>
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
                      <span>Saving Room...</span>
                    </>
                  ) : (
                    <span>{modalMode === 'add' ? 'Create Room' : 'Save Changes'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Safeguard Confirmation Modal */}
      {deleteModalOpen && roomToDelete && (
        <div style={styles.modalOverlay} onClick={() => !isDeleting && setDeleteModalOpen(false)}>
          <div style={styles.deleteModalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.deleteHeader}>
              <div style={styles.deleteIconWrap}>
                <ShieldAlert size={24} color="#f87171" />
              </div>
              <div>
                <h3 style={styles.deleteTitle}>Delete Room #{roomToDelete.room_number}</h3>
                <span style={styles.deleteSubtitle}>
                  PostgreSQL database record permanent removal confirmation
                </span>
              </div>
            </div>

            {roomToDelete.status === 'occupied' ? (
              /* Blocked Safeguard Alert */
              <div style={styles.safeguardBlockedBox}>
                <AlertCircle size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={styles.blockedTitle}>Deletion Blocked by System Safeguard</h4>
                  <p style={styles.blockedDesc}>
                    Room #{roomToDelete.room_number} is currently marked as <strong>OCCUPIED</strong>.
                    Active guest accommodations cannot be removed from inventory. Please process guest
                    check-out or room reassignment before deletion.
                  </p>
                </div>
              </div>
            ) : (
              /* Standard Warning */
              <div style={styles.deleteContent}>
                <p style={styles.deleteWarningText}>
                  Are you sure you want to delete <strong>Room #{roomToDelete.room_number}</strong> (
                  {roomToDelete.room_type || 'Standard'}, Floor {roomToDelete.floor})?
                </p>
                <div style={styles.deleteMetaPill}>
                  <span>Current Status: <strong>{roomToDelete.status.toUpperCase()}</strong></span>
                  <span>•</span>
                  <span>Rate: ₹{parseFloat(roomToDelete.price_per_night).toLocaleString('en-IN')}/night</span>
                </div>
                <p style={styles.deleteSubtext}>
                  This operation cannot be undone. Rooms with active past reservations cannot be deleted if foreign key restrictions apply.
                </p>
              </div>
            )}

            <div style={styles.modalActions}>
              <button
                style={styles.cancelBtn}
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                {roomToDelete.status === 'occupied' ? 'Close' : 'Cancel'}
              </button>

              {roomToDelete.status !== 'occupied' && (
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
    flex: '1 1 280px',
    maxWidth: '420px',
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
  viewToggleGroup: {
    display: 'flex',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: '10px',
    padding: '3px',
  },
  viewBtn: {
    padding: '6px 10px',
    borderRadius: '7px',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  viewBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
    color: '#fef08a',
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
    maxWidth: '400px',
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
  roomPill: {
    display: 'inline-flex',
    padding: '5px 12px',
    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(180, 83, 9, 0.15) 100%)',
    borderRadius: '10px',
    border: '1px solid rgba(212, 175, 55, 0.4)',
  },
  roomPillText: {
    fontWeight: '900',
    color: '#fef08a',
    fontSize: '14px',
    letterSpacing: '0.5px',
  },
  typeCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  typeName: {
    fontWeight: '700',
    color: '#ffffff',
    fontSize: '14px',
  },
  capacityBadge: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '500',
  },
  floorText: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  priceContainer: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
  },
  priceValue: {
    fontSize: '15px',
    fontWeight: '900',
    color: '#fde047',
    textShadow: '0 0 10px rgba(212, 175, 55, 0.2)',
  },
  priceUnit: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '800',
    border: '1px solid',
    letterSpacing: '0.5px',
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
    gap: '8px',
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
  deleteBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: 'rgba(148, 163, 184, 0.05)',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '18px',
  },
  roomCard: {
    backgroundColor: '#070c18',
    borderRadius: '14px',
    border: '1px solid rgba(212, 175, 55, 0.22)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
  },
  roomCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomCardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardTypeName: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#ffffff',
    margin: 0,
  },
  cardDetailsRow: {
    display: 'flex',
    gap: '8px',
    fontSize: '12px',
    color: '#94a3b8',
  },
  cardDetailItem: {
    fontWeight: '500',
  },
  cardPriceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
    marginTop: '6px',
  },
  cardPrice: {
    fontSize: '18px',
    fontWeight: '900',
    color: '#fde047',
  },
  cardPriceUnit: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  roomCardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    paddingTop: '14px',
  },
  cardEditBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    borderRadius: '8px',
    color: '#fef08a',
    fontSize: '12px',
    fontWeight: '700',
  },
  cardDeleteBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '12px',
    fontWeight: '700',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
    maxWidth: '560px',
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
