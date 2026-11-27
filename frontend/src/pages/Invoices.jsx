import { useState, useEffect, useMemo, useRef } from 'react'
import {
  FileText,
  IndianRupee,
  Search,
  RefreshCw,
  Plus,
  Printer,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  Check,
  CalendarCheck,
  ShieldCheck,
  TrendingUp,
  Receipt,
} from 'lucide-react'
import { invoiceAPI } from '../services/api'
import SummaryCard from '../components/dashboard/SummaryCard'
import HotelLogo from '../components/common/HotelLogo'

export default function Invoices() {
  // Data states
  const [invoices, setInvoices] = useState([])
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalBilled: 0,
    todayBilled: 0,
    monthlyBilled: 0,
    countPaid: 0,
    countPartial: 0,
    countUnpaid: 0,
    outstandingBalance: 0,
  })
  const [eligibleReservations, setEligibleReservations] = useState([])

  // Loading & refresh
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('latest')

  // Modals
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [invoiceFolioData, setInvoiceFolioData] = useState(null)

  // Generate Invoice Form
  const [formData, setFormData] = useState({
    reservationId: '',
    discountAmount: '0',
    taxPercent: '0',
    dueDate: '',
  })
  const [formErrors, setFormErrors] = useState({})
  const [generateSubmitting, setGenerateSubmitting] = useState(false)

  // Toast feedback
  const [toast, setToast] = useState(null)
  const printAreaRef = useRef(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4500)
  }

  // Load live data from PostgreSQL
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        const [invoicesRes, statsRes, eligibleRes] = await Promise.all([
          invoiceAPI.getAllInvoices(),
          invoiceAPI.getInvoiceStats(),
          invoiceAPI.getEligibleReservations(),
        ])

        if (isMounted) {
          setInvoices(invoicesRes?.data || [])
          if (statsRes?.data) setStats(statsRes.data)
          setEligibleReservations(eligibleRes?.data || [])
        }
      } catch (err) {
        if (isMounted) {
          showToast(err.message || 'Failed to sync invoices from PostgreSQL.', 'error')
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

  // Filtered and Sorted Invoices
  const filteredInvoices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return invoices
      .filter((inv) => {
        const guestName = `${inv.first_name || ''} ${inv.last_name || ''}`.toLowerCase()
        const matchesSearch =
          !q ||
          guestName.includes(q) ||
          (inv.phone || '').toLowerCase().includes(q) ||
          (inv.room_number || '').toLowerCase().includes(q) ||
          String(inv.id) === q ||
          String(inv.reservation_id) === q ||
          (inv.invoice_number || '').toLowerCase().includes(q)

        const matchesStatus = statusFilter === 'all' || inv.payment_status === statusFilter

        return matchesSearch && matchesStatus
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at || a.invoice_date || 0).getTime()
        const timeB = new Date(b.created_at || b.invoice_date || 0).getTime()
        return sortBy === 'oldest' ? timeA - timeB : timeB - timeA
      })
  }, [invoices, searchTerm, statusFilter, sortBy])

  // Selected reservation in Generate Modal
  const selectedReservation = useMemo(() => {
    if (!formData.reservationId) return null
    return eligibleReservations.find(
      (r) => String(r.reservation_id) === String(formData.reservationId)
    )
  }, [formData.reservationId, eligibleReservations])

  // Computed subtotal, discount, tax, grand total for Generate Modal
  const modalCalculations = useMemo(() => {
    if (!selectedReservation) return { subtotal: 0, discount: 0, tax: 0, total: 0, due: 0 }

    const subtotal = parseFloat(selectedReservation.booking_total || 0)
    const discount = Math.max(0, parseFloat(formData.discountAmount) || 0)
    const taxable = Math.max(0, subtotal - discount)
    const taxRate = Math.max(0, parseFloat(formData.taxPercent) || 0)
    const tax = (taxable * taxRate) / 100
    const total = taxable + tax
    const paid = parseFloat(selectedReservation.total_paid || 0)
    const due = Math.max(0, total - paid)

    return { subtotal, discount, tax, total, due, paid }
  }, [selectedReservation, formData.discountAmount, formData.taxPercent])

  // Open Generate Modal
  const openGenerateModal = () => {
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const defaultDue = nextWeek.toISOString().slice(0, 10)

    setFormData({
      reservationId:
        eligibleReservations.length > 0
          ? String(eligibleReservations[0].reservation_id)
          : '',
      discountAmount: '0',
      taxPercent: '0', // Rule #5, #6, #7: Defaults to 0% unconfigured; does not invent GST rates
      dueDate: defaultDue,
    })
    setFormErrors({})
    setIsGenerateModalOpen(true)
  }

  // Submit Invoice Generation
  const handleGenerateInvoice = async (e) => {
    e.preventDefault()

    const errors = {}
    if (!formData.reservationId) {
      errors.reservationId = 'Please select a reservation.'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setGenerateSubmitting(true)
    try {
      const payload = {
        reservationId: parseInt(formData.reservationId, 10),
        discountAmount: parseFloat(formData.discountAmount) || 0,
        taxPercent: parseFloat(formData.taxPercent) || 0,
        dueDate: formData.dueDate || undefined,
      }

      const res = await invoiceAPI.generateInvoice(payload)
      showToast(
        `Invoice ${res?.data?.invoice_number || ''} generated successfully!`,
        'success'
      )
      setIsGenerateModalOpen(false)
      handleRefresh()
    } catch (err) {
      showToast(err.message || 'Invoice generation failed.', 'error')
    } finally {
      setGenerateSubmitting(false)
    }
  }

  // View Printable Invoice
  const handleViewInvoice = async (invoiceId) => {
    try {
      const res = await invoiceAPI.getInvoiceById(invoiceId)
      if (res?.data) {
        setInvoiceFolioData(res.data)
      }
    } catch (err) {
      showToast(err.message || 'Failed to load invoice details.', 'error')
    }
  }

  // Print Invoice
  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={styles.container}>
      {/* Print-specific style rules */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice-card, #printable-invoice-card * {
            visibility: visible;
          }
          #printable-invoice-card {
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
            <Receipt size={14} color="#fef08a" />
            <span>FINANCIAL BILLING & INVOICING</span>
          </div>
          <h1 style={styles.headerTitle}>Invoices & Billing Hub</h1>
          <p style={styles.headerSubtitle}>
            Generate official stay invoices, reconcile payments from the live treasury, apply authorized discounts, and print branded PDF folios for GITA DEVI HOTEL.
          </p>
        </div>

        <div style={styles.headerRight}>
          <button style={styles.generateBtn} onClick={openGenerateModal}>
            <Plus size={18} color="#070a12" />
            <span>Generate Invoice</span>
          </button>
          <button
            style={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Sync live billing ledger from PostgreSQL"
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
          title="Total Billed Revenue"
          value={`₹${stats.totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle={`${stats.totalInvoices} total invoices issued`}
          icon={IndianRupee}
        />
        <SummaryCard
          title="Today's Billing"
          value={`₹${stats.todayBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Invoices generated today"
          icon={TrendingUp}
        />
        <SummaryCard
          title="Monthly Billing"
          value={`₹${stats.monthlyBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Current calendar month"
          icon={CalendarCheck}
        />
        <SummaryCard
          title="Outstanding Dues"
          value={`₹${stats.outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Uncollected invoice balances"
          icon={Clock}
        />
      </div>

      {/* Secondary Status Strip */}
      <div style={styles.statusStrip}>
        <div style={styles.statusItem}>
          <FileText size={15} color="#d4af37" />
          <span style={styles.statusLabel}>Total Invoices:</span>
          <span style={styles.statusValue}>{stats.totalInvoices}</span>
        </div>
        <div style={styles.statusDivider} />

        <div style={styles.statusItem}>
          <CheckCircle2 size={15} color="#34d399" />
          <span style={styles.statusLabel}>Paid In Full:</span>
          <span style={{ ...styles.statusValue, color: '#34d399' }}>{stats.countPaid}</span>
        </div>
        <div style={styles.statusDivider} />

        <div style={styles.statusItem}>
          <AlertCircle size={15} color="#fbbf24" />
          <span style={styles.statusLabel}>Partially Paid:</span>
          <span style={{ ...styles.statusValue, color: '#fbbf24' }}>{stats.countPartial}</span>
        </div>
        <div style={styles.statusDivider} />

        <div style={styles.statusItem}>
          <Clock size={15} color="#f87171" />
          <span style={styles.statusLabel}>Unpaid / Overdue:</span>
          <span style={{ ...styles.statusValue, color: '#f87171' }}>{stats.countUnpaid}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={styles.filterBarCard}>
        <div style={styles.searchWrapper}>
          <Search size={16} color="#94a3b8" style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by Invoice #, Guest Name, Mobile, Room #..."
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">All Payment Statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partially Paid</option>
            <option value="unpaid">Unpaid</option>
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

      {/* Main Invoices Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeaderSection}>
          <div style={styles.tableHeading}>
            <FileText size={18} color="#d4af37" />
            <h2 style={styles.tableTitleText}>Generated Invoices Ledger</h2>
          </div>
          <span style={styles.tableSubtitleText}>
            Showing {filteredInvoices.length} invoices
          </span>
        </div>

        {loading ? (
          <div style={styles.loadingBox}>
            <RefreshCw size={24} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={styles.loadingText}>Synchronizing invoices from PostgreSQL...</span>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div style={styles.emptyBox}>
            <Receipt size={48} color="#d4af37" style={{ opacity: 0.4 }} />
            <h3 style={styles.emptyTitle}>No Invoices Found</h3>
            <p style={styles.emptyDesc}>
              {searchTerm || statusFilter !== 'all'
                ? 'No invoices matched your active search or filters.'
                : 'No invoices have been generated yet. Click "Generate Invoice" to create an invoice from an existing reservation.'}
            </p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Invoice #</th>
                  <th style={styles.th}>Guest & Room</th>
                  <th style={styles.th}>Stay Schedule</th>
                  <th style={styles.th}>Subtotal</th>
                  <th style={styles.th}>Discounts & Tax</th>
                  <th style={styles.th}>Grand Total</th>
                  <th style={styles.th}>Payments & Balance</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const invDate = new Date(inv.invoice_date || inv.created_at)
                  const subtotal = parseFloat(inv.subtotal || 0)
                  const tax = parseFloat(inv.tax_amount || 0)
                  const discount = parseFloat(inv.discount_amount || 0)
                  const total = parseFloat(inv.total_amount || 0)
                  const paid = parseFloat(inv.total_paid || 0)
                  const balance = Math.max(0, total - paid)

                  const isPaid = inv.payment_status === 'paid'
                  const isPartial = inv.payment_status === 'partial'

                  return (
                    <tr key={inv.id} style={styles.tr}>
                      {/* Invoice # */}
                      <td style={styles.td}>
                        <div style={styles.invCol}>
                          <span style={styles.invNumberText}>{inv.invoice_number}</span>
                          <span style={styles.invDateText}>
                            {invDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Guest & Room */}
                      <td style={styles.td}>
                        <div style={styles.guestCol}>
                          <span style={styles.guestName}>
                            {inv.first_name} {inv.last_name}
                          </span>
                          <span style={styles.roomSub}>
                            Room #{inv.room_number} • Res #{inv.reservation_id}
                          </span>
                        </div>
                      </td>

                      {/* Stay Schedule */}
                      <td style={styles.td}>
                        <div style={styles.dateCol}>
                          <span style={styles.dateVal}>
                            {new Date(inv.check_in_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            —{' '}
                            {new Date(inv.check_out_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span style={styles.categorySub}>{inv.room_type}</span>
                        </div>
                      </td>

                      {/* Subtotal */}
                      <td style={styles.td}>
                        <span style={styles.subtotalText}>
                          ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Discounts & Tax */}
                      <td style={styles.td}>
                        <div style={styles.taxDiscCol}>
                          {discount > 0 && (
                            <span style={styles.discBadge}>-₹{discount.toLocaleString('en-IN')} disc</span>
                          )}
                          {tax > 0 ? (
                            <span style={styles.taxBadge}>+₹{tax.toLocaleString('en-IN')} tax</span>
                          ) : (
                            <span style={styles.noTaxBadge}>0% Tax</span>
                          )}
                        </div>
                      </td>

                      {/* Grand Total */}
                      <td style={styles.td}>
                        <span style={styles.grandTotalText}>
                          ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Payments & Balance */}
                      <td style={styles.td}>
                        <div style={styles.folioCol}>
                          <span style={styles.paidBadge}>Paid: ₹{paid.toLocaleString('en-IN')}</span>
                          {balance > 0 ? (
                            <span style={styles.dueBadge}>Due: ₹{balance.toLocaleString('en-IN')}</span>
                          ) : (
                            <span style={styles.settledBadge}>Settled</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={styles.td}>
                        {isPaid ? (
                          <span style={styles.statusPaid}>
                            <CheckCircle2 size={12} color="#34d399" />
                            <span>Paid</span>
                          </span>
                        ) : isPartial ? (
                          <span style={styles.statusPartial}>
                            <AlertCircle size={12} color="#fbbf24" />
                            <span>Partial</span>
                          </span>
                        ) : (
                          <span style={styles.statusUnpaid}>
                            <Clock size={12} color="#f87171" />
                            <span>Unpaid</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <button
                          style={styles.viewInvoiceBtn}
                          onClick={() => handleViewInvoice(inv.id)}
                          title="View & Print Official Invoice"
                        >
                          <Eye size={14} color="#fef08a" />
                          <span>View Invoice</span>
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

      {/* ==================================================================== */}
      {/* MODAL 1: GENERATE INVOICE */}
      {/* ==================================================================== */}
      {isGenerateModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <div style={styles.modalIconWrap}>
                  <Receipt size={20} color="#070a12" />
                </div>
                <div>
                  <h3 style={styles.modalHeading}>Generate Guest Stay Invoice</h3>
                  <span style={styles.modalSubheading}>
                    Reconcile stay room charges, configured taxes, and payments
                  </span>
                </div>
              </div>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setIsGenerateModalOpen(false)}
                disabled={generateSubmitting}
              >
                <X size={18} color="#94a3b8" />
              </button>
            </div>

            <form onSubmit={handleGenerateInvoice}>
              <div style={styles.modalBody}>
                {/* Reservation Selector */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Select Reservation (Awaiting Invoice) *</label>
                  {eligibleReservations.length === 0 ? (
                    <div style={styles.noEligibleBox}>
                      <AlertCircle size={16} color="#fbbf24" />
                      <span>All active reservations already have invoices generated.</span>
                    </div>
                  ) : (
                    <select
                      value={formData.reservationId}
                      onChange={(e) =>
                        setFormData({ ...formData, reservationId: e.target.value })
                      }
                      style={styles.select}
                    >
                      <option value="">-- Select Reservation --</option>
                      {eligibleReservations.map((res) => (
                        <option key={res.reservation_id} value={res.reservation_id}>
                          Res #{res.reservation_id} - {res.first_name} {res.last_name} (Room #{res.room_number}) • Subtotal: ₹{parseFloat(res.booking_total).toLocaleString('en-IN')}
                        </option>
                      ))}
                    </select>
                  )}
                  {formErrors.reservationId && (
                    <span style={styles.errorText}>{formErrors.reservationId}</span>
                  )}
                </div>

                {/* Selected Reservation Summary */}
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
                          Room #{selectedReservation.room_number} ({selectedReservation.room_type})
                        </span>
                      </div>
                    </div>
                    <div style={{ ...styles.folioSummaryRow, marginTop: '10px' }}>
                      <div>
                        <span style={styles.folioSumLabel}>Stay Dates</span>
                        <span style={styles.folioSumVal}>
                          {new Date(selectedReservation.check_in_date).toLocaleDateString()} — {new Date(selectedReservation.check_out_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span style={styles.folioSumLabel}>Payments Reconciled</span>
                        <span style={{ ...styles.folioSumVal, color: '#34d399' }}>
                          ₹{parseFloat(selectedReservation.total_paid).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Discounts and Taxes */}
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Discount Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.discountAmount}
                      onChange={(e) =>
                        setFormData({ ...formData, discountAmount: e.target.value })
                      }
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Tax / GST Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={formData.taxPercent}
                      onChange={(e) =>
                        setFormData({ ...formData, taxPercent: e.target.value })
                      }
                      style={styles.input}
                    />
                    <span style={styles.taxNotice}>
                      Tax settings: 0% default (no invented rates)
                    </span>
                  </div>
                </div>

                {/* Due Date */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Invoice Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    style={styles.input}
                  />
                </div>

                {/* Live Grand Total & Balance Preview */}
                {selectedReservation && (
                  <div style={styles.previewCalculationCard}>
                    <div style={styles.previewRow}>
                      <span>Room Subtotal:</span>
                      <span>₹{modalCalculations.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {modalCalculations.discount > 0 && (
                      <div style={styles.previewRow}>
                        <span>Discount Applied:</span>
                        <span style={{ color: '#f87171' }}>-₹{modalCalculations.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {modalCalculations.tax > 0 && (
                      <div style={styles.previewRow}>
                        <span>Tax Amount ({formData.taxPercent}%):</span>
                        <span>+₹{modalCalculations.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div style={styles.previewRowTotal}>
                      <span>Grand Total:</span>
                      <span style={{ color: '#fef08a' }}>
                        ₹{modalCalculations.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div style={styles.previewRowBalance}>
                      <span>Payments Already Recorded:</span>
                      <span style={{ color: '#34d399' }}>
                        ₹{modalCalculations.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div style={styles.previewRowBalance}>
                      <span>Balance Due on Invoice:</span>
                      <span style={{ color: modalCalculations.due > 0 ? '#f87171' : '#34d399', fontWeight: '700' }}>
                        ₹{modalCalculations.due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setIsGenerateModalOpen(false)}
                  disabled={generateSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.submitBtn}
                  disabled={generateSubmitting || eligibleReservations.length === 0}
                >
                  <Check size={16} color="#070a12" />
                  <span>
                    {generateSubmitting ? 'Generating Invoice...' : 'Generate & Issue Invoice'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: PRINTABLE OFFICIAL HOTEL INVOICE */}
      {/* ==================================================================== */}
      {invoiceFolioData && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalBox, maxWidth: '720px' }}>
            <div style={styles.modalHeader} className="no-print">
              <div style={styles.modalTitleGroup}>
                <div style={styles.modalIconWrap}>
                  <FileText size={20} color="#070a12" />
                </div>
                <div>
                  <h3 style={styles.modalHeading}>Guest Tax Invoice</h3>
                  <span style={styles.modalSubheading}>
                    {invoiceFolioData.invoice_number} • Official Hotel Tax Folio
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={styles.printBtn} onClick={handlePrint}>
                  <Printer size={16} color="#070a12" />
                  <span>Print Invoice / PDF</span>
                </button>
                <button
                  style={styles.modalCloseBtn}
                  onClick={() => setInvoiceFolioData(null)}
                >
                  <X size={18} color="#94a3b8" />
                </button>
              </div>
            </div>

            {/* Printable Invoice Body */}
            <div
              id="printable-invoice-card"
              ref={printAreaRef}
              style={styles.invoiceContainer}
            >
              {/* Hotel Brand Header */}
              <div style={styles.invoiceHeader}>
                <div style={styles.brandRow}>
                  <HotelLogo size={46} showText={true} />
                  <div style={styles.metaRight}>
                    <div style={styles.invoiceNumberBadge}>
                      {invoiceFolioData.invoice_number}
                    </div>
                    <span style={styles.metaDate}>
                      Invoice Date:{' '}
                      {new Date(
                        invoiceFolioData.invoice_date || invoiceFolioData.created_at
                      ).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {invoiceFolioData.due_date && (
                      <span style={styles.metaDate}>
                        Due Date:{' '}
                        {new Date(invoiceFolioData.due_date).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div style={styles.hotelAddressBlock}>
                  <span>GITA DEVI HOTEL — Luxury Palace, Suites & Conventions</span>
                  <span>Station Road, Civil Lines • Contact: +91 98765 43210</span>
                </div>
              </div>

              <div style={styles.invoiceDivider} />

              {/* Guest & Stay Details */}
              <div style={styles.invoiceGrid}>
                <div>
                  <span style={styles.invSecHeading}>BILLED TO:</span>
                  <span style={styles.invValBold}>
                    {invoiceFolioData.first_name} {invoiceFolioData.last_name}
                  </span>
                  <span style={styles.invSubText}>Phone: {invoiceFolioData.phone}</span>
                  {invoiceFolioData.email && (
                    <span style={styles.invSubText}>Email: {invoiceFolioData.email}</span>
                  )}
                  {invoiceFolioData.id_number && (
                    <span style={styles.invSubText}>
                      ID: {invoiceFolioData.id_type} - {invoiceFolioData.id_number}
                    </span>
                  )}
                  {invoiceFolioData.address && (
                    <span style={styles.invSubText}>Address: {invoiceFolioData.address}</span>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={styles.invSecHeading}>RESERVATION DETAILS:</span>
                  <span style={styles.invValBold}>
                    Room #{invoiceFolioData.room_number} ({invoiceFolioData.room_type})
                  </span>
                  <span style={styles.invSubText}>Reservation #{invoiceFolioData.reservation_id}</span>
                  <span style={styles.invSubText}>
                    Check-in: {new Date(invoiceFolioData.check_in_date).toLocaleDateString()}
                  </span>
                  <span style={styles.invSubText}>
                    Check-out: {new Date(invoiceFolioData.check_out_date).toLocaleDateString()}
                  </span>
                  {invoiceFolioData.actual_check_in && (
                    <span style={styles.invSubText}>
                      Actual In: {new Date(invoiceFolioData.actual_check_in).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div style={styles.invoiceDivider} />

              {/* Itemized Charges Table */}
              <div style={styles.tableBox}>
                <table style={styles.invTable}>
                  <thead>
                    <tr style={styles.invThRow}>
                      <th style={styles.invTh}>Item Description</th>
                      <th style={styles.invTh}>Room Rate</th>
                      <th style={styles.invTh}>Nights</th>
                      <th style={{ ...styles.invTh, textAlign: 'right' }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={styles.invTd}>
                        <strong>Room Accommodation Charges</strong>
                        <br />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Room #{invoiceFolioData.room_number} ({invoiceFolioData.room_type})
                        </span>
                      </td>
                      <td style={styles.invTd}>
                        ₹{parseFloat(invoiceFolioData.price_per_night || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={styles.invTd}>
                        {Math.max(
                          1,
                          Math.ceil(
                            (new Date(invoiceFolioData.check_out_date) -
                              new Date(invoiceFolioData.check_in_date)) /
                              (1000 * 60 * 60 * 24)
                          )
                        )}N
                      </td>
                      <td style={{ ...styles.invTd, textAlign: 'right', fontWeight: '700' }}>
                        ₹{parseFloat(invoiceFolioData.subtotal).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Breakdown */}
              <div style={styles.calcSummaryBox}>
                <div style={styles.calcSummaryRow}>
                  <span>Room Charges Subtotal:</span>
                  <span>
                    ₹{parseFloat(invoiceFolioData.subtotal).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {parseFloat(invoiceFolioData.discount_amount || 0) > 0 && (
                  <div style={styles.calcSummaryRow}>
                    <span>Special Discount:</span>
                    <span style={{ color: '#dc2626' }}>
                      -₹{parseFloat(invoiceFolioData.discount_amount).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                {parseFloat(invoiceFolioData.tax_amount || 0) > 0 ? (
                  <div style={styles.calcSummaryRow}>
                    <span>Taxes / GST:</span>
                    <span>
                      +₹{parseFloat(invoiceFolioData.tax_amount).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ) : (
                  <div style={styles.calcSummaryRow}>
                    <span>Taxes:</span>
                    <span style={{ color: '#64748b' }}>₹0.00 (0% configured)</span>
                  </div>
                )}
                <div style={styles.calcSummaryTotalRow}>
                  <span>Grand Total:</span>
                  <span style={{ color: '#b45309', fontWeight: '800' }}>
                    ₹{parseFloat(invoiceFolioData.total_amount).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Payments Reconciled Section */}
              <div style={{ marginTop: '20px' }}>
                <span style={styles.invSecHeading}>PAYMENTS RECONCILED:</span>
                {invoiceFolioData.payments && invoiceFolioData.payments.length > 0 ? (
                  <div style={styles.tableBox}>
                    <table style={styles.invTable}>
                      <thead>
                        <tr style={styles.invThRow}>
                          <th style={styles.invTh}>Payment Date</th>
                          <th style={styles.invTh}>Channel</th>
                          <th style={styles.invTh}>Reference</th>
                          <th style={styles.invTh}>Status</th>
                          <th style={{ ...styles.invTh, textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceFolioData.payments.map((p) => (
                          <tr key={p.id}>
                            <td style={styles.invTd}>
                              {new Date(p.payment_date).toLocaleDateString()}
                            </td>
                            <td style={styles.invTd}>{p.payment_method?.toUpperCase()}</td>
                            <td style={styles.invTd}>{p.transaction_id || 'Front-Desk'}</td>
                            <td style={styles.invTd}>{p.payment_status?.toUpperCase()}</td>
                            <td
                              style={{
                                ...styles.invTd,
                                textAlign: 'right',
                                fontWeight: '700',
                                color: p.payment_status === 'refunded' ? '#dc2626' : '#15803d',
                              }}
                            >
                              {p.payment_status === 'refunded' ? '-' : ''}₹{parseFloat(p.amount).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                    No payments recorded yet for this stay folio.
                  </div>
                )}

                <div style={{ ...styles.calcSummaryBox, marginTop: '12px' }}>
                  <div style={styles.calcSummaryRow}>
                    <span>Total Payments Received:</span>
                    <span style={{ color: '#15803d', fontWeight: '700' }}>
                      ₹{parseFloat(invoiceFolioData.total_paid || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div style={styles.calcSummaryTotalRow}>
                    <span>Outstanding Balance Due:</span>
                    <span
                      style={{
                        fontWeight: '800',
                        color:
                          parseFloat(invoiceFolioData.total_amount) -
                            parseFloat(invoiceFolioData.total_paid || 0) >
                          0
                            ? '#dc2626'
                            : '#15803d',
                      }}
                    >
                      ₹{Math.max(
                        0,
                        parseFloat(invoiceFolioData.total_amount) -
                          parseFloat(invoiceFolioData.total_paid || 0)
                      ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verification Seal & Signatures */}
              <div style={styles.footerRow}>
                <div style={styles.sealBadge}>
                  <ShieldCheck size={22} color="#b45309" />
                  <div>
                    <span style={styles.sealTitle}>OFFICIAL HOTEL INVOICE</span>
                    <span style={styles.sealSub}>
                      PAYMENT STATUS: {invoiceFolioData.payment_status?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div style={styles.signatureBlock}>
                  <div style={styles.sigLine} />
                  <span style={styles.sigText}>Authorized Signature</span>
                  <span style={styles.sigSub}>GITA DEVI HOTEL Front Desk</span>
                </div>
              </div>

              <div style={styles.invNotice}>
                Thank you for your patronage with GITA DEVI HOTEL. Computer-generated official tax invoice.
              </div>
            </div>

            <div style={styles.modalFooter} className="no-print">
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={() => setInvoiceFolioData(null)}
              >
                Close Invoice
              </button>
              <button type="button" style={styles.printBtn} onClick={handlePrint}>
                <Printer size={16} color="#070a12" />
                <span>Print / Save PDF</span>
              </button>
            </div>
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
  generateBtn: {
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
  statusStrip: {
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
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
  },
  statusLabel: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  statusValue: {
    color: '#ffffff',
    fontWeight: '700',
  },
  statusDivider: {
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
  invCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  invNumberText: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#fef08a',
  },
  invDateText: {
    fontSize: '11px',
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
  categorySub: {
    fontSize: '11px',
    color: '#d4af37',
  },
  subtotalText: {
    fontSize: '13px',
    color: '#cbd5e1',
  },
  taxDiscCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  discBadge: {
    fontSize: '11px',
    color: '#f87171',
  },
  taxBadge: {
    fontSize: '11px',
    color: '#38bdf8',
  },
  noTaxBadge: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  grandTotalText: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#fef08a',
  },
  folioCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  paidBadge: {
    fontSize: '11px',
    color: '#34d399',
  },
  dueBadge: {
    fontSize: '11px',
    color: '#f87171',
    fontWeight: '600',
  },
  settledBadge: {
    fontSize: '11px',
    color: '#34d399',
    fontWeight: '600',
  },
  statusPaid: {
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
  statusPartial: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderRadius: '4px',
    color: '#fbbf24',
    fontSize: '12px',
    fontWeight: '600',
  },
  statusUnpaid: {
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
  viewInvoiceBtn: {
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
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  taxNotice: {
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '2px',
  },
  errorText: {
    fontSize: '12px',
    color: '#f87171',
  },
  noEligibleBox: {
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
  previewCalculationCard: {
    backgroundColor: '#10172a',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: '10px',
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  previewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#cbd5e1',
  },
  previewRowTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    fontWeight: '800',
    color: '#ffffff',
    borderTop: '1px solid rgba(212, 175, 55, 0.2)',
    paddingTop: '8px',
    marginTop: '4px',
  },
  previewRowBalance: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
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
  // Printable Invoice Styles
  invoiceContainer: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    padding: '36px',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  invoiceHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  brandRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRight: {
    textAlign: 'right',
  },
  invoiceNumberBadge: {
    fontSize: '17px',
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: '0.05em',
  },
  metaDate: {
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
  invoiceDivider: {
    height: '1px',
    backgroundColor: '#e2e8f0',
    margin: '20px 0',
  },
  invoiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
  },
  invSecHeading: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '6px',
  },
  invValBold: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#0f172a',
    display: 'block',
  },
  invSubText: {
    fontSize: '12px',
    color: '#475569',
    display: 'block',
    marginTop: '2px',
  },
  tableBox: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  invTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  invThRow: {
    backgroundColor: '#f8fafc',
  },
  invTh: {
    padding: '10px 14px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    borderBottom: '1px solid #e2e8f0',
  },
  invTd: {
    padding: '12px 14px',
    fontSize: '13px',
    color: '#1e293b',
    borderBottom: '1px solid #f1f5f9',
  },
  calcSummaryBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-end',
    marginTop: '16px',
  },
  calcSummaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '280px',
    fontSize: '13px',
    color: '#334155',
  },
  calcSummaryTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '280px',
    fontSize: '15px',
    fontWeight: '800',
    color: '#0f172a',
    borderTop: '2px solid #e2e8f0',
    paddingTop: '8px',
    marginTop: '4px',
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: '36px',
    paddingTop: '20px',
    borderTop: '1px dashed #cbd5e1',
  },
  sealBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 16px',
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
    fontWeight: '700',
    color: '#b45309',
    display: 'block',
  },
  signatureBlock: {
    textAlign: 'center',
    width: '220px',
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
  invNotice: {
    textAlign: 'center',
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '28px',
  },
}
