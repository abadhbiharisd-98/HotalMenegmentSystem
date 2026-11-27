import { useState, useEffect, useMemo, useRef } from 'react'
import {
  CreditCard,
  IndianRupee,
  Search,
  RefreshCw,
  Plus,
  RotateCcw,
  Receipt,
  Printer,
  X,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Banknote,
  QrCode,
  Building2,
  Check,
  CalendarCheck,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { paymentAPI } from '../services/api'
import SummaryCard from '../components/dashboard/SummaryCard'
import HotelLogo from '../components/common/HotelLogo'

export default function Payments() {
  // Data states
  const [payments, setPayments] = useState([])
  const [stats, setStats] = useState({
    totalReceived: 0,
    todayCollections: 0,
    monthlyCollections: 0,
    totalRefunds: 0,
    pendingBalances: 0,
    countCompleted: 0,
    countRefunded: 0,
    methodTotals: {
      cash: 0,
      upi: 0,
      credit_card: 0,
      debit_card: 0,
      bank_transfer: 0,
    },
  })
  const [pendingReservations, setPendingReservations] = useState([])

  // Loading & refresh
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('latest')

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [refundTargetPayment, setRefundTargetPayment] = useState(null)
  const [refundReason, setRefundReason] = useState('')
  const [refundSubmitting, setRefundSubmitting] = useState(false)

  // Record Payment Form
  const [formData, setFormData] = useState({
    reservationId: '',
    amount: '',
    paymentMethod: 'cash',
    transactionId: '',
    notes: '',
  })
  const [formErrors, setFormErrors] = useState({})
  const [recordSubmitting, setRecordSubmitting] = useState(false)

  // Toast feedback
  const [toast, setToast] = useState(null)

  const printAreaRef = useRef(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4500)
  }

  // Load all payments data concurrently from backend
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        const [paymentsRes, statsRes, pendingRes] = await Promise.all([
          paymentAPI.getAllPayments(),
          paymentAPI.getPaymentStats(),
          paymentAPI.getPendingReservations(),
        ])

        if (isMounted) {
          setPayments(paymentsRes?.data || [])
          if (statsRes?.data) setStats(statsRes.data)
          setPendingReservations(pendingRes?.data || [])
        }
      } catch (err) {
        if (isMounted) {
          showToast(err.message || 'Failed to sync payments from PostgreSQL.', 'error')
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

  // Filtered and Sorted Payments
  const filteredPayments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return payments
      .filter((p) => {
        const guestName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase()
        const matchesSearch =
          !q ||
          guestName.includes(q) ||
          (p.phone || '').toLowerCase().includes(q) ||
          (p.room_number || '').toLowerCase().includes(q) ||
          String(p.id) === q ||
          String(p.reservation_id) === q ||
          (p.transaction_id || '').toLowerCase().includes(q)

        const matchesMethod = methodFilter === 'all' || p.payment_method === methodFilter
        const matchesStatus = statusFilter === 'all' || p.payment_status === statusFilter

        return matchesSearch && matchesMethod && matchesStatus
      })
      .sort((a, b) => {
        const timeA = new Date(a.payment_date || 0).getTime()
        const timeB = new Date(b.payment_date || 0).getTime()
        return sortBy === 'oldest' ? timeA - timeB : timeB - timeA
      })
  }, [payments, searchTerm, methodFilter, statusFilter, sortBy])

  // Selected reservation details in Record Payment Modal
  const selectedReservation = useMemo(() => {
    if (!formData.reservationId) return null
    return pendingReservations.find((r) => String(r.reservation_id) === String(formData.reservationId))
  }, [formData.reservationId, pendingReservations])

  // Open Record Modal
  const openRecordModal = () => {
    setFormData({
      reservationId: pendingReservations.length > 0 ? String(pendingReservations[0].reservation_id) : '',
      amount: '',
      paymentMethod: 'cash',
      transactionId: '',
      notes: '',
    })
    setFormErrors({})
    setIsRecordModalOpen(true)
  }

  // Auto-fill full balance shortcut
  const handlePayFullBalance = () => {
    if (selectedReservation) {
      setFormData((prev) => ({
        ...prev,
        amount: String(selectedReservation.outstanding_balance),
      }))
    }
  }

  // Submit New Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault()

    const errors = {}
    if (!formData.reservationId) {
      errors.reservationId = 'Please select a reservation.'
    }
    const numAmount = parseFloat(formData.amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      errors.amount = 'Please enter a valid amount greater than ₹0.'
    } else if (selectedReservation && numAmount > parseFloat(selectedReservation.outstanding_balance)) {
      errors.amount = `Amount cannot exceed the remaining balance of ₹${parseFloat(selectedReservation.outstanding_balance).toLocaleString('en-IN')}.`
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setRecordSubmitting(true)
    try {
      const payload = {
        reservationId: parseInt(formData.reservationId, 10),
        amount: numAmount,
        paymentMethod: formData.paymentMethod,
        transactionId: formData.transactionId.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      }

      await paymentAPI.createPayment(payload)
      showToast(
        `Payment of ₹${numAmount.toLocaleString('en-IN')} recorded successfully!`,
        'success'
      )
      setIsRecordModalOpen(false)
      handleRefresh()
    } catch (err) {
      showToast(err.message || 'Failed to record payment.', 'error')
    } finally {
      setRecordSubmitting(false)
    }
  }

  // Open Refund Modal
  const openRefundModal = (payment) => {
    setRefundTargetPayment(payment)
    setRefundReason('')
  }

  // Process Refund
  const handleProcessRefund = async (e) => {
    e.preventDefault()
    if (!refundTargetPayment) return

    setRefundSubmitting(true)
    try {
      await paymentAPI.processRefund(refundTargetPayment.id, {
        reason: refundReason.trim() || 'Guest refund request',
      })
      showToast(
        `Payment #${refundTargetPayment.id} of ₹${parseFloat(refundTargetPayment.amount).toLocaleString('en-IN')} refunded successfully.`,
        'success'
      )
      setRefundTargetPayment(null)
      handleRefresh()
    } catch (err) {
      showToast(err.message || 'Refund processing failed.', 'error')
    } finally {
      setRefundSubmitting(false)
    }
  }

  // View Receipt
  const handleViewReceipt = async (paymentId) => {
    try {
      const res = await paymentAPI.getPaymentById(paymentId)
      if (res?.data) {
        setReceiptData(res.data)
      }
    } catch (err) {
      showToast(err.message || 'Failed to load receipt details.', 'error')
    }
  }

  // Print Receipt Trigger
  const handlePrint = () => {
    window.print()
  }

  // Helper for Method Icon & Label
  const renderMethodBadge = (method) => {
    switch (method) {
      case 'cash':
        return (
          <span style={styles.methodBadgeCash}>
            <Banknote size={12} color="#34d399" />
            <span>Cash</span>
          </span>
        )
      case 'upi':
        return (
          <span style={styles.methodBadgeUpi}>
            <QrCode size={12} color="#38bdf8" />
            <span>UPI</span>
          </span>
        )
      case 'credit_card':
        return (
          <span style={styles.methodBadgeCard}>
            <CreditCard size={12} color="#fef08a" />
            <span>Credit Card</span>
          </span>
        )
      case 'debit_card':
        return (
          <span style={styles.methodBadgeCard}>
            <CreditCard size={12} color="#fde047" />
            <span>Debit Card</span>
          </span>
        )
      case 'bank_transfer':
        return (
          <span style={styles.methodBadgeBank}>
            <Building2 size={12} color="#c084fc" />
            <span>Bank Transfer</span>
          </span>
        )
      default:
        return <span>{method}</span>
    }
  }

  return (
    <div style={styles.container}>
      {/* Print-specific style rules */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt-card, #printable-receipt-card * {
            visibility: visible;
          }
          #printable-receipt-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background-color: #ffffff !important;
            color: #000000 !important;
            border: none !important;
            box-shadow: none !important;
            padding: 30px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

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
            <Wallet size={14} color="#fef08a" />
            <span>FINANCIAL TREASURY & COLLECTIONS</span>
          </div>
          <h1 style={styles.headerTitle}>Payments & Revenue Ledger</h1>
          <p style={styles.headerSubtitle}>
            Track real-time room collections, advance deposits, multi-channel payment settlements, official printable guest receipts, and controlled refund audits.
          </p>
        </div>

        <div style={styles.headerRight}>
          <button style={styles.recordBtn} onClick={openRecordModal}>
            <Plus size={18} color="#070a12" />
            <span>Record Payment</span>
          </button>
          <button
            style={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Sync live payments ledger from PostgreSQL"
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

      {/* 4 Summary Metric Cards */}
      <div style={styles.summaryGrid}>
        <SummaryCard
          title="Total Payments Received"
          value={`₹${stats.totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle={`${stats.countCompleted} completed transactions`}
          icon={IndianRupee}
        />
        <SummaryCard
          title="Today's Collections"
          value={`₹${stats.todayCollections.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Collections recorded today"
          icon={TrendingUp}
        />
        <SummaryCard
          title="Monthly Collections"
          value={`₹${stats.monthlyCollections.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Current calendar month"
          icon={CalendarCheck}
        />
        <SummaryCard
          title="Pending Balances"
          value={`₹${stats.pendingBalances.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Outstanding active stay dues"
          icon={Wallet}
        />
      </div>

      {/* Secondary Channels Breakdown Strip */}
      <div style={styles.channelStrip}>
        <div style={styles.channelItem}>
          <Banknote size={15} color="#34d399" />
          <span style={styles.channelLabel}>Cash:</span>
          <span style={styles.channelValue}>
            ₹{(stats.methodTotals?.cash || 0).toLocaleString('en-IN')}
          </span>
        </div>
        <div style={styles.channelDivider} />

        <div style={styles.channelItem}>
          <QrCode size={15} color="#38bdf8" />
          <span style={styles.channelLabel}>UPI / QR:</span>
          <span style={styles.channelValue}>
            ₹{(stats.methodTotals?.upi || 0).toLocaleString('en-IN')}
          </span>
        </div>
        <div style={styles.channelDivider} />

        <div style={styles.channelItem}>
          <CreditCard size={15} color="#fef08a" />
          <span style={styles.channelLabel}>Credit Card:</span>
          <span style={styles.channelValue}>
            ₹{(stats.methodTotals?.credit_card || 0).toLocaleString('en-IN')}
          </span>
        </div>
        <div style={styles.channelDivider} />

        <div style={styles.channelItem}>
          <CreditCard size={15} color="#fde047" />
          <span style={styles.channelLabel}>Debit Card:</span>
          <span style={styles.channelValue}>
            ₹{(stats.methodTotals?.debit_card || 0).toLocaleString('en-IN')}
          </span>
        </div>
        <div style={styles.channelDivider} />

        <div style={styles.channelItem}>
          <Building2 size={15} color="#c084fc" />
          <span style={styles.channelLabel}>Bank Transfer:</span>
          <span style={styles.channelValue}>
            ₹{(stats.methodTotals?.bank_transfer || 0).toLocaleString('en-IN')}
          </span>
        </div>
        <div style={styles.channelDivider} />

        <div style={styles.channelItem}>
          <RotateCcw size={15} color="#f87171" />
          <span style={styles.channelLabel}>Refunds:</span>
          <span style={{ ...styles.channelValue, color: '#f87171' }}>
            ₹{stats.totalRefunds.toLocaleString('en-IN')} ({stats.countRefunded})
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={styles.filterBarCard}>
        <div style={styles.searchWrapper}>
          <Search size={16} color="#94a3b8" style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by Payment ID, Guest, Phone, Room #, Ref #..."
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

        <div style={styles.filtersGroup}>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">All Payment Channels</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI / QR</option>
            <option value="credit_card">Credit Card</option>
            <option value="debit_card">Debit Card</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
            <option value="pending">Pending</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="latest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
          </select>
        </div>
      </div>

      {/* Main Payment Directory Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeaderSection}>
          <div style={styles.tableHeading}>
            <Receipt size={18} color="#d4af37" />
            <h2 style={styles.tableTitleText}>Transaction History Ledger</h2>
          </div>
          <span style={styles.tableSubtitleText}>
            Showing {filteredPayments.length} transactions
          </span>
        </div>

        {loading ? (
          <div style={styles.loadingBox}>
            <RefreshCw size={24} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={styles.loadingText}>Synchronizing payments from PostgreSQL...</span>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div style={styles.emptyBox}>
            <Wallet size={48} color="#d4af37" style={{ opacity: 0.4 }} />
            <h3 style={styles.emptyTitle}>No Payment Transactions Found</h3>
            <p style={styles.emptyDesc}>
              {searchTerm || methodFilter !== 'all' || statusFilter !== 'all'
                ? 'No transactions matched your active search or filters.'
                : 'No payments have been recorded yet. Click "Record Payment" to post a guest payment.'}
            </p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Payment ID</th>
                  <th style={styles.th}>Guest & Room</th>
                  <th style={styles.th}>Date & Time</th>
                  <th style={styles.th}>Channel / Method</th>
                  <th style={styles.th}>Reference / Txn ID</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => {
                  const payDate = new Date(p.payment_date)
                  const isRefunded = p.payment_status === 'refunded'
                  const isCompleted = p.payment_status === 'completed'
                  const amt = parseFloat(p.amount || 0)

                  return (
                    <tr key={p.id} style={styles.tr}>
                      {/* Payment ID */}
                      <td style={styles.td}>
                        <div style={styles.payIdPill}>
                          <span>#{p.id}</span>
                        </div>
                      </td>

                      {/* Guest & Room */}
                      <td style={styles.td}>
                        <div style={styles.guestCol}>
                          <span style={styles.guestName}>
                            {p.first_name} {p.last_name}
                          </span>
                          <span style={styles.roomSub}>
                            Room #{p.room_number} • Res #{p.reservation_id}
                          </span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td style={styles.td}>
                        <div style={styles.dateCol}>
                          <span style={styles.dateVal}>
                            {payDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span style={styles.timeVal}>
                            {payDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td style={styles.td}>{renderMethodBadge(p.payment_method)}</td>

                      {/* Reference / Txn ID */}
                      <td style={styles.td}>
                        <span style={styles.txIdText} title={p.transaction_id || 'Direct front desk'}>
                          {p.transaction_id || 'Direct front desk'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.amountText,
                            color: isRefunded ? '#f87171' : '#fef08a',
                            textDecoration: isRefunded ? 'line-through' : 'none',
                          }}
                        >
                          ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={styles.td}>
                        {isCompleted ? (
                          <span style={styles.completedBadge}>
                            <CheckCircle2 size={12} color="#34d399" />
                            <span>Completed</span>
                          </span>
                        ) : isRefunded ? (
                          <span style={styles.refundedBadge}>
                            <RotateCcw size={12} color="#f87171" />
                            <span>Refunded</span>
                          </span>
                        ) : (
                          <span style={styles.pendingBadge}>
                            <span>{p.payment_status}</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <div style={styles.actionBtnsGroup}>
                          <button
                            style={styles.receiptActionBtn}
                            onClick={() => handleViewReceipt(p.id)}
                            title="Generate Official Receipt"
                          >
                            <Receipt size={14} color="#fef08a" />
                            <span>Receipt</span>
                          </button>

                          {isCompleted && (
                            <button
                              style={styles.refundActionBtn}
                              onClick={() => openRefundModal(p)}
                              title="Process Controlled Refund"
                            >
                              <RotateCcw size={14} color="#f87171" />
                            </button>
                          )}
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

      {/* ==================================================================== */}
      {/* MODAL 1: RECORD NEW PAYMENT */}
      {/* ==================================================================== */}
      {isRecordModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <div style={styles.modalIconWrap}>
                  <IndianRupee size={20} color="#070a12" />
                </div>
                <div>
                  <h3 style={styles.modalHeading}>Record Guest Payment</h3>
                  <span style={styles.modalSubheading}>
                    Post settlement into live PostgreSQL payments ledger
                  </span>
                </div>
              </div>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setIsRecordModalOpen(false)}
                disabled={recordSubmitting}
              >
                <X size={18} color="#94a3b8" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div style={styles.modalBody}>
                {/* Reservation Selector */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Select Guest Reservation / Folio *</label>
                  {pendingReservations.length === 0 ? (
                    <div style={styles.noPendingBox}>
                      <AlertCircle size={16} color="#fbbf24" />
                      <span>No reservations with outstanding balance found in database.</span>
                    </div>
                  ) : (
                    <select
                      value={formData.reservationId}
                      onChange={(e) =>
                        setFormData({ ...formData, reservationId: e.target.value })
                      }
                      style={styles.select}
                    >
                      <option value="">-- Select Active / Pending Reservation --</option>
                      {pendingReservations.map((res) => (
                        <option key={res.reservation_id} value={res.reservation_id}>
                          Res #{res.reservation_id} - {res.first_name} {res.last_name} (Room #{res.room_number}) • Due: ₹{parseFloat(res.outstanding_balance).toLocaleString('en-IN')}
                        </option>
                      ))}
                    </select>
                  )}
                  {formErrors.reservationId && (
                    <span style={styles.errorText}>{formErrors.reservationId}</span>
                  )}
                </div>

                {/* Selected Reservation Folio Summary */}
                {selectedReservation && (
                  <div style={styles.folioSummaryCard}>
                    <div style={styles.folioSummaryRow}>
                      <div>
                        <span style={styles.folioSumLabel}>Guest</span>
                        <span style={styles.folioSumVal}>
                          {selectedReservation.first_name} {selectedReservation.last_name} ({selectedReservation.phone})
                        </span>
                      </div>
                      <div>
                        <span style={styles.folioSumLabel}>Room</span>
                        <span style={styles.folioSumVal}>
                          #{selectedReservation.room_number} ({selectedReservation.room_type})
                        </span>
                      </div>
                    </div>
                    <div style={{ ...styles.folioSummaryRow, marginTop: '10px' }}>
                      <div>
                        <span style={styles.folioSumLabel}>Total Bill</span>
                        <span style={styles.folioSumVal}>
                          ₹{parseFloat(selectedReservation.booking_total).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span style={styles.folioSumLabel}>Paid so far</span>
                        <span style={{ ...styles.folioSumVal, color: '#34d399' }}>
                          ₹{parseFloat(selectedReservation.total_paid).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span style={styles.folioSumLabel}>Outstanding Due</span>
                        <span style={{ ...styles.folioSumVal, color: '#f87171' }}>
                          ₹{parseFloat(selectedReservation.outstanding_balance).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount Field with Quick Pay Full Balance */}
                <div style={styles.formGroup}>
                  <div style={styles.labelWithAction}>
                    <label style={styles.label}>Payment Amount (₹) *</label>
                    {selectedReservation && (
                      <button
                        type="button"
                        style={styles.quickFillBtn}
                        onClick={handlePayFullBalance}
                      >
                        Pay Full Balance (₹{parseFloat(selectedReservation.outstanding_balance).toLocaleString('en-IN')})
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="Enter amount to collect..."
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    style={styles.input}
                  />
                  {formErrors.amount && <span style={styles.errorText}>{formErrors.amount}</span>}
                </div>

                {/* Payment Method Selector */}
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Payment Channel / Method *</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) =>
                        setFormData({ ...formData, paymentMethod: e.target.value })
                      }
                      style={styles.select}
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI / QR Payment</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="debit_card">Debit Card</option>
                      <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Transaction / UTR / Auth Ref</label>
                    <input
                      type="text"
                      placeholder="e.g. UPI-12345678 / AUTH-99"
                      value={formData.transactionId}
                      onChange={(e) =>
                        setFormData({ ...formData, transactionId: e.target.value })
                      }
                      style={styles.input}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Payment Notes / Remarks</label>
                  <textarea
                    rows={2}
                    placeholder="Front desk deposit, settlement remark..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    style={styles.textarea}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setIsRecordModalOpen(false)}
                  disabled={recordSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.submitBtn}
                  disabled={recordSubmitting}
                >
                  <Check size={16} color="#070a12" />
                  <span>
                    {recordSubmitting ? 'Recording Payment...' : 'Confirm & Save Payment'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: PRINTABLE OFFICIAL PAYMENT RECEIPT */}
      {/* ==================================================================== */}
      {receiptData && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalBox, maxWidth: '680px' }}>
            <div style={styles.modalHeader} className="no-print">
              <div style={styles.modalTitleGroup}>
                <div style={styles.modalIconWrap}>
                  <Receipt size={20} color="#070a12" />
                </div>
                <div>
                  <h3 style={styles.modalHeading}>Guest Payment Receipt</h3>
                  <span style={styles.modalSubheading}>
                    Receipt #{receiptData.id} • Official Tax Invoice/Voucher
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={styles.printBtn} onClick={handlePrint}>
                  <Printer size={16} color="#070a12" />
                  <span>Print Receipt / PDF</span>
                </button>
                <button
                  style={styles.modalCloseBtn}
                  onClick={() => setReceiptData(null)}
                >
                  <X size={18} color="#94a3b8" />
                </button>
              </div>
            </div>

            {/* Printable Receipt Card Body */}
            <div
              id="printable-receipt-card"
              ref={printAreaRef}
              style={styles.receiptContainer}
            >
              {/* Hotel Header */}
              <div style={styles.receiptHeader}>
                <div style={styles.receiptBrandRow}>
                  <HotelLogo size={42} showText={true} />
                  <div style={styles.receiptMetaRight}>
                    <div style={styles.receiptNumberBadge}>RECEIPT #{receiptData.id}</div>
                    <span style={styles.receiptDate}>
                      Date: {new Date(receiptData.payment_date).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div style={styles.hotelAddressBlock}>
                  <span>GITA DEVI HOTEL — Luxury Palace, Suites & Conventions</span>
                  <span>Station Road, Civil Lines • Contact: +91 98765 43210</span>
                </div>
              </div>

              <div style={styles.receiptDivider} />

              {/* Guest & Reservation Details */}
              <div style={styles.receiptGrid}>
                <div>
                  <span style={styles.rcptSecHeading}>BILLED TO:</span>
                  <span style={styles.rcptValBold}>
                    {receiptData.first_name} {receiptData.last_name}
                  </span>
                  <span style={styles.rcptSubText}>Phone: {receiptData.phone}</span>
                  {receiptData.email && (
                    <span style={styles.rcptSubText}>Email: {receiptData.email}</span>
                  )}
                  {receiptData.id_number && (
                    <span style={styles.rcptSubText}>
                      ID: {receiptData.id_type} - {receiptData.id_number}
                    </span>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={styles.rcptSecHeading}>BOOKING DETAILS:</span>
                  <span style={styles.rcptValBold}>
                    Room #{receiptData.room_number} ({receiptData.room_type})
                  </span>
                  <span style={styles.rcptSubText}>Reservation #{receiptData.reservation_id}</span>
                  <span style={styles.rcptSubText}>
                    Stay:{' '}
                    {new Date(receiptData.check_in_date).toLocaleDateString()} —{' '}
                    {new Date(receiptData.check_out_date).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div style={styles.receiptDivider} />

              {/* Payment Breakdown Table */}
              <div style={styles.rcptTableBox}>
                <table style={styles.rcptTable}>
                  <thead>
                    <tr style={styles.rcptThRow}>
                      <th style={styles.rcptTh}>Particulars / Description</th>
                      <th style={styles.rcptTh}>Payment Channel</th>
                      <th style={styles.rcptTh}>Reference ID</th>
                      <th style={{ ...styles.rcptTh, textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={styles.rcptTd}>Room Accommodation Payment</td>
                      <td style={styles.rcptTd}>
                        {receiptData.payment_method?.toUpperCase()}
                      </td>
                      <td style={styles.rcptTd}>
                        {receiptData.transaction_id || 'Front-Desk Counter'}
                      </td>
                      <td style={{ ...styles.rcptTd, textAlign: 'right', fontWeight: '700' }}>
                        ₹{parseFloat(receiptData.amount).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary Balances */}
              <div style={styles.rcptSummaryBox}>
                <div style={styles.rcptSummaryRow}>
                  <span>Total Booking Charges:</span>
                  <span>
                    ₹{parseFloat(receiptData.booking_total || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div style={styles.rcptSummaryRow}>
                  <span>Cumulative Paid To Date:</span>
                  <span style={{ color: '#10b981', fontWeight: '700' }}>
                    ₹{parseFloat(receiptData.total_paid_so_far || receiptData.amount).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div style={styles.rcptSummaryRow}>
                  <span>Remaining Folio Balance:</span>
                  <span style={{ fontWeight: '700' }}>
                    ₹{Math.max(
                      0,
                      parseFloat(receiptData.booking_total || 0) -
                        parseFloat(receiptData.total_paid_so_far || receiptData.amount)
                    ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Verification Stamp & Signature */}
              <div style={styles.rcptFooterRow}>
                <div style={styles.rcptSealBadge}>
                  <ShieldCheck size={20} color="#d4af37" />
                  <div>
                    <span style={styles.sealTitle}>PAYMENT RECEIVED & VERIFIED</span>
                    <span style={styles.sealSub}>
                      Status: {receiptData.payment_status?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div style={styles.signatureBlock}>
                  <div style={styles.sigLine} />
                  <span style={styles.sigText}>Authorized Front-Desk Cashier</span>
                  <span style={styles.sigSub}>
                    Recorded by: {receiptData.recorded_by_name || 'System Admin'}
                  </span>
                </div>
              </div>

              <div style={styles.rcptNotice}>
                Thank you for choosing GITA DEVI HOTEL. This is an official computer-generated receipt.
              </div>
            </div>

            <div style={styles.modalFooter} className="no-print">
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={() => setReceiptData(null)}
              >
                Close Receipt
              </button>
              <button type="button" style={styles.printBtn} onClick={handlePrint}>
                <Printer size={16} color="#070a12" />
                <span>Print / Save PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: CONTROLLED REFUND CONFIRMATION */}
      {/* ==================================================================== */}
      {refundTargetPayment && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <div style={{ ...styles.modalIconWrap, backgroundColor: '#f87171' }}>
                  <RotateCcw size={20} color="#070a12" />
                </div>
                <div>
                  <h3 style={styles.modalHeading}>Process Payment Refund</h3>
                  <span style={styles.modalSubheading}>
                    Authorized reversal of Payment #{refundTargetPayment.id}
                  </span>
                </div>
              </div>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setRefundTargetPayment(null)}
                disabled={refundSubmitting}
              >
                <X size={18} color="#94a3b8" />
              </button>
            </div>

            <form onSubmit={handleProcessRefund}>
              <div style={styles.modalBody}>
                <div style={styles.refundWarningBox}>
                  <AlertCircle size={20} color="#f87171" style={{ flexShrink: 0 }} />
                  <div>
                    <span style={styles.refundWarnTitle}>Confirm Refund Reversal</span>
                    <p style={styles.refundWarnDesc}>
                      You are about to refund Payment #{refundTargetPayment.id} for{' '}
                      <strong>
                        ₹{parseFloat(refundTargetPayment.amount).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </strong>{' '}
                      received from {refundTargetPayment.first_name} {refundTargetPayment.last_name} (Room #{refundTargetPayment.room_number}).
                      This action will update the payment status to <em>'refunded'</em> and restore the reservation's outstanding balance.
                    </p>
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Refund Reason / Authority *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Booking cancellation, accidental duplicate charge..."
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setRefundTargetPayment(null)}
                  disabled={refundSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ ...styles.submitBtn, backgroundColor: '#f87171' }}
                  disabled={refundSubmitting}
                >
                  <RotateCcw size={16} color="#070a12" />
                  <span>{refundSubmitting ? 'Processing Refund...' : 'Authorize Refund'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// GITA DEVI HOTEL Luxury Dark & Gold Styling
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
  recordBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 22px',
    backgroundColor: '#d4af37',
    border: 'none',
    borderRadius: '10px',
    color: '#070a12',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
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
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
    marginBottom: '20px',
  },
  channelStrip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    backgroundColor: '#0a1020',
    padding: '14px 24px',
    borderRadius: '12px',
    border: '1px solid rgba(212, 175, 55, 0.18)',
    marginBottom: '24px',
  },
  channelItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
  },
  channelLabel: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  channelValue: {
    color: '#ffffff',
    fontWeight: '700',
  },
  channelDivider: {
    width: '1px',
    height: '18px',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  filterBarCard: {
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
  searchWrapper: {
    position: 'relative',
    flex: '1',
    minWidth: '280px',
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
  filtersGroup: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
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
  payIdPill: {
    display: 'inline-block',
    padding: '4px 8px',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderRadius: '4px',
    color: '#fef08a',
    fontWeight: '700',
    fontSize: '12px',
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
  roomSub: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  dateCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  dateVal: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#ffffff',
  },
  timeVal: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  methodBadgeCash: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 8px',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    color: '#34d399',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
  },
  methodBadgeUpi: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 8px',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    color: '#38bdf8',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
  },
  methodBadgeCard: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 8px',
    backgroundColor: 'rgba(254, 240, 138, 0.1)',
    color: '#fef08a',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
  },
  methodBadgeBank: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 8px',
    backgroundColor: 'rgba(192, 132, 252, 0.1)',
    color: '#c084fc',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
  },
  txIdText: {
    fontSize: '12px',
    color: '#94a3b8',
    maxWidth: '180px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  amountText: {
    fontSize: '14px',
    fontWeight: '700',
  },
  completedBadge: {
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
  refundedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderRadius: '4px',
    color: '#f87171',
    fontSize: '12px',
    fontWeight: '600',
  },
  pendingBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: '4px',
    color: '#fbbf24',
    fontSize: '12px',
    fontWeight: '600',
  },
  actionBtnsGroup: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  receiptActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '6px',
    color: '#fef08a',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  refundActionBtn: {
    padding: '6px',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    border: '1px solid rgba(248, 113, 113, 0.25)',
    borderRadius: '6px',
    color: '#f87171',
    cursor: 'pointer',
    display: 'flex',
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
    maxWidth: '600px',
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
  labelWithAction: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickFillBtn: {
    background: 'none',
    border: 'none',
    color: '#fef08a',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
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
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  errorText: {
    fontSize: '12px',
    color: '#f87171',
  },
  noPendingBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '8px',
    color: '#fde047',
    fontSize: '13px',
  },
  folioSummaryCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '10px',
    padding: '14px',
  },
  folioSummaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    flexWrap: 'wrap',
  },
  folioSumLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    display: 'block',
    marginBottom: '2px',
  },
  folioSumVal: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#ffffff',
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
    padding: '10px 22px',
    backgroundColor: '#d4af37',
    border: 'none',
    borderRadius: '8px',
    color: '#070a12',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  printBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#d4af37',
    border: 'none',
    borderRadius: '6px',
    color: '#070a12',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  // Printable Receipt Styles
  receiptContainer: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    padding: '32px',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  receiptHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  receiptBrandRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptMetaRight: {
    textAlign: 'right',
  },
  receiptNumberBadge: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: '0.05em',
  },
  receiptDate: {
    fontSize: '12px',
    color: '#64748b',
    display: 'block',
    marginTop: '2px',
  },
  hotelAddressBlock: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '12px',
    color: '#475569',
    marginTop: '4px',
  },
  receiptDivider: {
    height: '1px',
    backgroundColor: '#e2e8f0',
    margin: '20px 0',
  },
  receiptGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
  },
  rcptSecHeading: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '6px',
  },
  rcptValBold: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#0f172a',
    display: 'block',
  },
  rcptSubText: {
    fontSize: '12px',
    color: '#475569',
    display: 'block',
    marginTop: '2px',
  },
  rcptTableBox: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  rcptTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  rcptThRow: {
    backgroundColor: '#f8fafc',
  },
  rcptTh: {
    padding: '10px 14px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    borderBottom: '1px solid #e2e8f0',
  },
  rcptTd: {
    padding: '12px 14px',
    fontSize: '13px',
    color: '#1e293b',
    borderBottom: '1px solid #f1f5f9',
  },
  rcptSummaryBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-end',
    marginTop: '16px',
  },
  rcptSummaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '260px',
    fontSize: '13px',
    color: '#334155',
  },
  rcptFooterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: '32px',
    paddingTop: '20px',
    borderTop: '1px dashed #cbd5e1',
  },
  rcptSealBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 14px',
    border: '2px solid #d97706',
    borderRadius: '8px',
    backgroundColor: '#fffbeb',
  },
  sealTitle: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#92400e',
    display: 'block',
    letterSpacing: '0.04em',
  },
  sealSub: {
    fontSize: '10px',
    color: '#b45309',
    display: 'block',
  },
  signatureBlock: {
    textAlign: 'center',
    width: '200px',
  },
  sigLine: {
    height: '1px',
    backgroundColor: '#0f172a',
    marginBottom: '6px',
  },
  sigText: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#0f172a',
    display: 'block',
  },
  sigSub: {
    fontSize: '10px',
    color: '#64748b',
    display: 'block',
  },
  rcptNotice: {
    textAlign: 'center',
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '28px',
  },
  // Refund Warning Card
  refundWarningBox: {
    display: 'flex',
    gap: '14px',
    padding: '16px',
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    border: '1px solid rgba(248, 113, 113, 0.3)',
    borderRadius: '10px',
  },
  refundWarnTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#f87171',
    display: 'block',
    marginBottom: '4px',
  },
  refundWarnDesc: {
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: '1.5',
    margin: 0,
  },
}
