import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Receipt,
  IndianRupee,
  Search,
  RefreshCw,
  Plus,
  Printer,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  Wallet,
  Zap,
  Wrench,
  Boxes,
  UtensilsCrossed,
  UserCheck,
  HelpCircle,
  CreditCard,
  Building2,
  QrCode,
  ArrowUpDown,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react'
import { expenseAPI } from '../services/api'
import SummaryCard from '../components/dashboard/SummaryCard'
import HotelLogo from '../components/common/HotelLogo'

// Mapping categories to user-friendly titles, icons, and colors
const CATEGORY_MAP = {
  utilities: {
    label: 'Utilities (Electricity, Water, Internet)',
    short: 'Utilities',
    icon: Zap,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.3)',
  },
  maintenance: {
    label: 'Maintenance & Repairs',
    short: 'Maintenance',
    icon: Wrench,
    color: '#fb923c',
    bg: 'rgba(251, 146, 60, 0.12)',
    border: 'rgba(251, 146, 60, 0.3)',
  },
  supplies: {
    label: 'Supplies (Housekeeping, Laundry, Office)',
    short: 'Supplies',
    icon: Boxes,
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.3)',
  },
  food_beverage: {
    label: 'Food & Kitchen (F&B)',
    short: 'Food & Kitchen',
    icon: UtensilsCrossed,
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.12)',
    border: 'rgba(52, 211, 153, 0.3)',
  },
  salaries: {
    label: 'Staff Salaries & Wages',
    short: 'Staff Salaries',
    icon: UserCheck,
    color: '#facc15',
    bg: 'rgba(250, 204, 21, 0.12)',
    border: 'rgba(250, 204, 21, 0.3)',
  },
  other: {
    label: 'Other Operational / Transport',
    short: 'Other Expenses',
    icon: HelpCircle,
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.3)',
  },
}

const PAYMENT_METHOD_MAP = {
  cash: { label: 'Cash', icon: Wallet, color: '#4ade80' },
  upi: { label: 'UPI / QR', icon: QrCode, color: '#60a5fa' },
  credit_card: { label: 'Credit Card', icon: CreditCard, color: '#f472b6' },
  debit_card: { label: 'Debit Card', icon: CreditCard, color: '#c084fc' },
  bank_transfer: { label: 'Bank Transfer', icon: Building2, color: '#fbbf24' },
}

export default function Expenses() {
  // Main data states
  const [expenses, setExpenses] = useState([])
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalCount: 0,
    todayAmount: 0,
    todayCount: 0,
    monthAmount: 0,
    monthCount: 0,
    yearAmount: 0,
    yearCount: 0,
    categorySummary: [],
    methodBreakdown: [],
    methodTotals: {
      cash: 0,
      upi: 0,
      credit_card: 0,
      debit_card: 0,
      bank_transfer: 0,
    },
  })

  // Loading & refresh
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // View mode: 'directory' | 'reports'
  const [activeTab, setActiveTab] = useState('directory')

  // Search, Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [fromDateFilter, setFromDateFilter] = useState('')
  const [toDateFilter, setToDateFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [viewingExpense, setViewingExpense] = useState(null)
  const [deletingExpense, setDeletingExpense] = useState(null)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [printType, setPrintType] = useState('summary') // 'single' | 'summary'
  const [printTargetItem, setPrintTargetItem] = useState(null)

  // Report Period & State
  const [reportPeriod, setReportPeriod] = useState('monthly')
  const [reportsData, setReportsData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    category: 'utilities',
    amount: '',
    paymentMethod: 'cash',
    expenseDate: new Date().toISOString().split('T')[0],
    vendor: '',
    referenceNumber: '',
    notes: '',
  })
  const [formErrors, setFormErrors] = useState({})
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Toast notification
  const [toast, setToast] = useState(null)

  const printAreaRef = useRef(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4500)
  }

  // Load primary data
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        setLoading(true)
        const [expensesRes, statsRes] = await Promise.all([
          expenseAPI.getExpenses({
            search: searchTerm,
            category: categoryFilter,
            paymentMethod: methodFilter,
            fromDate: fromDateFilter,
            toDate: toDateFilter,
            sort: sortBy,
          }),
          expenseAPI.getStats(),
        ])

        if (isMounted) {
          setExpenses(expensesRes.data?.data || [])
          if (statsRes.data?.data) {
            setStats(statsRes.data.data)
          }
        }
      } catch (err) {
        console.error('Failed to load expenses data:', err)
        if (isMounted) {
          showToast('Failed to load live expense records from PostgreSQL.', 'error')
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
  }, [refreshTrigger, searchTerm, categoryFilter, methodFilter, fromDateFilter, toDateFilter, sortBy])

  // Load reports when reports tab is active or filters change
  useEffect(() => {
    if (activeTab !== 'reports') return

    let isMounted = true
    const loadReports = async () => {
      try {
        setReportLoading(true)
        const res = await expenseAPI.getReports({
          period: reportPeriod,
          startDate: fromDateFilter,
          endDate: toDateFilter,
          category: categoryFilter,
        })
        if (isMounted && res.data?.data) {
          setReportsData(res.data.data)
        }
      } catch (err) {
        console.error('Failed to load reports:', err)
      } finally {
        if (isMounted) setReportLoading(false)
      }
    }

    loadReports()
    return () => {
      isMounted = false
    }
  }, [activeTab, reportPeriod, fromDateFilter, toDateFilter, categoryFilter, refreshTrigger])

  const handleRefresh = () => {
    setRefreshing(true)
    setRefreshTrigger((prev) => prev + 1)
  }

  // Quick category suggestion click
  const handleQuickPreset = (presetTitle, presetCategory) => {
    setFormData((prev) => ({
      ...prev,
      title: presetTitle,
      category: presetCategory,
    }))
  }

  // Open Add modal
  const openAddModal = () => {
    setEditingExpense(null)
    setFormData({
      title: '',
      category: 'utilities',
      amount: '',
      paymentMethod: 'cash',
      expenseDate: new Date().toISOString().split('T')[0],
      vendor: '',
      referenceNumber: '',
      notes: '',
    })
    setFormErrors({})
    setIsAddEditModalOpen(true)
  }

  // Open Edit modal
  const openEditModal = (item) => {
    setEditingExpense(item)

    // Parse vendor & ref from description if formatted as "Vendor: ... | Ref: ... | Notes: ..."
    let vendor = ''
    let referenceNumber = ''
    let notes = item.description || ''

    if (item.description) {
      const parts = item.description.split(' | ')
      const noteParts = []
      parts.forEach((p) => {
        if (p.startsWith('Vendor: ')) vendor = p.replace('Vendor: ', '').trim()
        else if (p.startsWith('Ref: ')) referenceNumber = p.replace('Ref: ', '').trim()
        else if (p.startsWith('Notes: ')) noteParts.push(p.replace('Notes: ', '').trim())
        else noteParts.push(p)
      })
      notes = noteParts.join(' | ')
    }

    setFormData({
      title: item.title || '',
      category: item.category || 'utilities',
      amount: item.amount || '',
      paymentMethod: item.payment_method || 'cash',
      expenseDate: item.expense_date
        ? new Date(item.expense_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      vendor,
      referenceNumber,
      notes,
    })
    setFormErrors({})
    setIsAddEditModalOpen(true)
  }

  // Submit Add / Edit
  const handleFormSubmit = async (e) => {
    e.preventDefault()

    const errors = {}
    if (!formData.title.trim()) {
      errors.title = 'Expense title is required.'
    }
    const numAmt = parseFloat(formData.amount)
    if (isNaN(numAmt) || numAmt <= 0) {
      errors.amount = 'Amount must be a valid number greater than ₹0.'
    }
    if (!formData.expenseDate) {
      errors.expenseDate = 'Expense date is required.'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    // Build structured description preserving vendor & reference details
    const descParts = []
    if (formData.vendor.trim()) descParts.push(`Vendor: ${formData.vendor.trim()}`)
    if (formData.referenceNumber.trim()) descParts.push(`Ref: ${formData.referenceNumber.trim()}`)
    if (formData.notes.trim()) descParts.push(`Notes: ${formData.notes.trim()}`)
    const fullDescription = descParts.length > 0 ? descParts.join(' | ') : null

    try {
      setFormSubmitting(true)

      const payload = {
        title: formData.title.trim(),
        category: formData.category,
        amount: numAmt,
        paymentMethod: formData.paymentMethod,
        expenseDate: formData.expenseDate,
        description: fullDescription,
      }

      if (editingExpense) {
        await expenseAPI.updateExpense(editingExpense.id, payload)
        showToast(`Expense #${editingExpense.id} updated successfully.`)
      } else {
        await expenseAPI.createExpense(payload)
        showToast('New hotel expense recorded successfully.')
      }

      setIsAddEditModalOpen(false)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      console.error('Expense submit error:', err)
      const msg = err.response?.data?.message || err.message || 'Operation failed.'
      showToast(msg, 'error')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Delete Expense Confirmation
  const confirmDeleteExpense = async () => {
    if (!deletingExpense) return
    try {
      await expenseAPI.deleteExpense(deletingExpense.id)
      showToast(`Expense #${deletingExpense.id} deleted successfully.`)
      setDeletingExpense(null)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      console.error('Delete expense error:', err)
      const msg = err.response?.data?.message || err.message || 'Failed to delete expense.'
      showToast(msg, 'error')
    }
  }

  // Open Print Modal for Single Expense Voucher or Summary Report
  const openPrintModal = (type, item = null) => {
    setPrintType(type)
    setPrintTargetItem(item)
    setIsPrintModalOpen(true)
  }

  const triggerBrowserPrint = () => {
    window.print()
  }

  // Format currency
  const formatINR = (val) => {
    const num = parseFloat(val) || 0
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return expenses
  }, [expenses])

  return (
    <div style={styles.container}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            backgroundColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            borderColor: toast.type === 'error' ? '#ef4444' : '#10b981',
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={20} color="#fff" /> : <CheckCircle2 size={20} color="#fff" />}
          <span style={styles.toastText}>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div style={styles.header}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.liveBadge}>
              <span style={styles.livePulse} />
              POSTGRESQL LIVE EXPENSE AUDIT
            </span>
            <span style={styles.royalPill}>OPERATIONS & TREASURY</span>
          </div>
          <h1 style={styles.title}>Hotel Expenses & Utilities Management</h1>
          <p style={styles.subtitle}>
            Monitor property overheads, utility bills, maintenance charges, staff payroll, and daily supply procurement.
          </p>
        </div>

        <div style={styles.actionButtons}>
          <button
            style={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="Refresh database records"
          >
            <RefreshCw size={18} color="#d4af37" className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Live Sync'}</span>
          </button>

          <button
            style={styles.printReportBtn}
            onClick={() => openPrintModal('summary')}
            title="Print or Save Expense Report PDF"
          >
            <Printer size={18} color="#fef08a" />
            <span>Print Report</span>
          </button>

          <button style={styles.primaryBtn} onClick={openAddModal}>
            <Plus size={18} color="#060913" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <div style={styles.kpiGrid}>
        <SummaryCard
          title="TOTAL EXPENSES"
          value={formatINR(stats.totalAmount)}
          subtitle={`${stats.totalCount} lifetime records`}
          icon={Receipt}
          badge="Lifetime Outflow"
          badgeColor="#d4af37"
          badgeBg="rgba(212, 175, 55, 0.15)"
          loading={loading}
          delay={0}
        />
        <SummaryCard
          title="TODAY'S EXPENSES"
          value={formatINR(stats.todayAmount)}
          subtitle={`${stats.todayCount} voucher(s) logged today`}
          icon={IndianRupee}
          badge="Daily Outflow"
          badgeColor="#38bdf8"
          badgeBg="rgba(56, 189, 248, 0.15)"
          iconColor="#38bdf8"
          loading={loading}
          delay={100}
        />
        <SummaryCard
          title="THIS MONTH"
          value={formatINR(stats.monthAmount)}
          subtitle={`${stats.monthCount} items this month`}
          icon={Calendar}
          badge="Monthly Budget"
          badgeColor="#34d399"
          badgeBg="rgba(52, 211, 153, 0.15)"
          iconColor="#34d399"
          loading={loading}
          delay={200}
        />
        <SummaryCard
          title="THIS YEAR"
          value={formatINR(stats.yearAmount)}
          subtitle={`${stats.yearCount} items this calendar year`}
          icon={TrendingUp}
          badge="Fiscal Year"
          badgeColor="#facc15"
          badgeBg="rgba(250, 204, 21, 0.15)"
          iconColor="#facc15"
          loading={loading}
          delay={300}
        />
      </div>

      {/* Category Breakdown Metric Strip */}
      <div style={styles.categoryStripCard}>
        <div style={styles.stripHeader}>
          <div style={styles.stripTitleGroup}>
            <Boxes size={20} color="#d4af37" />
            <span style={styles.stripTitle}>CATEGORY DISTRIBUTION & ALLOCATION</span>
          </div>
          <span style={styles.stripSub}>Aggregated from active hotel overheads</span>
        </div>

        <div style={styles.categoryGrid}>
          {Object.entries(CATEGORY_MAP).map(([catKey, catInfo]) => {
            const found = stats.categorySummary.find((c) => c.category === catKey)
            const amt = found ? found.total_amount : 0
            const pct = found ? found.percentage : 0
            const count = found ? found.count : 0
            const Icon = catInfo.icon

            return (
              <div
                key={catKey}
                style={{
                  ...styles.categoryMiniCard,
                  borderColor: catInfo.border,
                  backgroundColor: catInfo.bg,
                }}
              >
                <div style={styles.catMiniTop}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon size={16} color={catInfo.color} />
                    <span style={{ ...styles.catMiniName, color: catInfo.color }}>{catInfo.short}</span>
                  </div>
                  <span style={styles.catMiniPct}>{pct}%</span>
                </div>
                <div style={styles.catMiniAmt}>{formatINR(amt)}</div>
                <div style={styles.catMiniCount}>{count} recorded transactions</div>
                {/* Progress bar */}
                <div style={styles.progressBarTrack}>
                  <div
                    style={{
                      ...styles.progressBarFill,
                      width: `${Math.min(100, Math.max(3, pct))}%`,
                      backgroundColor: catInfo.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Payment Method Distribution Bar */}
      <div style={styles.methodStripCard}>
        <div style={styles.methodStripTitleGroup}>
          <Wallet size={18} color="#d4af37" />
          <span style={styles.methodStripTitle}>DISBURSEMENT METHOD TOTALS:</span>
        </div>
        <div style={styles.methodTotalsRow}>
          {Object.entries(PAYMENT_METHOD_MAP).map(([methodKey, methodInfo]) => {
            const amt = stats.methodTotals[methodKey] || 0
            const Icon = methodInfo.icon
            return (
              <div key={methodKey} style={styles.methodPill}>
                <Icon size={15} color={methodInfo.color} />
                <span style={styles.methodPillLabel}>{methodInfo.label}:</span>
                <span style={{ ...styles.methodPillAmt, color: methodInfo.color }}>{formatINR(amt)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* View Mode Tabs: Directory vs Reports */}
      <div style={styles.tabNavRow}>
        <button
          style={{
            ...styles.tabNavBtn,
            ...(activeTab === 'directory' ? styles.tabNavBtnActive : {}),
          }}
          onClick={() => setActiveTab('directory')}
        >
          <Receipt size={17} />
          <span>Expenses Directory ({filteredExpenses.length})</span>
        </button>

        <button
          style={{
            ...styles.tabNavBtn,
            ...(activeTab === 'reports' ? styles.tabNavBtnActive : {}),
          }}
          onClick={() => setActiveTab('reports')}
        >
          <FileSpreadsheet size={17} />
          <span>Expense Reports & Analytics</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EXPENSES DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div style={styles.tableCard}>
          {/* Controls Bar: Search & Filters */}
          <div style={styles.filterBar}>
            {/* Search Input */}
            <div style={styles.searchBox}>
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search by ID, title, category, vendor, notes..."
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

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">All Categories</option>
              <option value="utilities">Utilities (Power, Water, Net)</option>
              <option value="maintenance">Maintenance & Repairs</option>
              <option value="supplies">Supplies (Housekeeping, Linen)</option>
              <option value="food_beverage">Food & Kitchen (F&B)</option>
              <option value="salaries">Staff Salaries & Wages</option>
              <option value="other">Other Expenses</option>
            </select>

            {/* Payment Method Filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">All Payment Channels</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI / QR Code</option>
              <option value="credit_card">Credit Card</option>
              <option value="debit_card">Debit Card</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>

            {/* Date range */}
            <div style={styles.dateFilterGroup}>
              <span style={styles.dateLabel}>From:</span>
              <input
                type="date"
                value={fromDateFilter}
                onChange={(e) => setFromDateFilter(e.target.value)}
                style={styles.dateInput}
              />
              <span style={styles.dateLabel}>To:</span>
              <input
                type="date"
                value={toDateFilter}
                onChange={(e) => setToDateFilter(e.target.value)}
                style={styles.dateInput}
              />
              {(fromDateFilter || toDateFilter) && (
                <button
                  style={styles.resetDateBtn}
                  onClick={() => {
                    setFromDateFilter('')
                    setToDateFilter('')
                  }}
                  title="Clear date range"
                >
                  <X size={14} color="#fca5a5" />
                </button>
              )}
            </div>

            {/* Sort Toggle */}
            <button
              style={styles.sortToggleBtn}
              onClick={() => setSortBy((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
              title="Toggle sorting order"
            >
              <ArrowUpDown size={15} color="#d4af37" />
              <span>{sortBy === 'newest' ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>

          {/* Table Container */}
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeadRow}>
                  <th style={styles.th}>EXPENSE ID</th>
                  <th style={styles.th}>TITLE & VENDOR</th>
                  <th style={styles.th}>CATEGORY</th>
                  <th style={styles.th}>AMOUNT</th>
                  <th style={styles.th}>PAYMENT METHOD</th>
                  <th style={styles.th}>EXPENSE DATE</th>
                  <th style={styles.th}>RECORDED BY</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={styles.loadingCell}>
                      <div style={styles.loadingWrapper}>
                        <RefreshCw size={24} color="#d4af37" className="animate-spin" />
                        <span>Fetching live PostgreSQL expense records...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={styles.emptyCell}>
                      <div style={styles.emptyWrapper}>
                        <Receipt size={42} color="rgba(212, 175, 55, 0.4)" />
                        <h3 style={styles.emptyTitle}>No Expenses Found</h3>
                        <p style={styles.emptyDesc}>
                          {searchTerm || categoryFilter !== 'all' || methodFilter !== 'all' || fromDateFilter
                            ? 'No expense records matched the current filter criteria.'
                            : 'No expense vouchers have been recorded in the database yet.'}
                        </p>
                        <button style={styles.emptyAddBtn} onClick={openAddModal}>
                          <Plus size={16} /> Record First Expense
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((item) => {
                    const cat = CATEGORY_MAP[item.category] || CATEGORY_MAP.other
                    const CatIcon = cat.icon
                    const method = PAYMENT_METHOD_MAP[item.payment_method] || PAYMENT_METHOD_MAP.cash
                    const MethodIcon = method.icon

                    return (
                      <tr key={item.id} style={styles.tableRow}>
                        <td style={styles.tdId}>
                          <span style={styles.idBadge}>#{item.id}</span>
                        </td>
                        <td style={styles.tdTitle}>
                          <div style={styles.titleText}>{item.title}</div>
                          {item.description && (
                            <div style={styles.descText} title={item.description}>
                              {item.description.length > 55
                                ? item.description.substring(0, 55) + '...'
                                : item.description}
                            </div>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.catBadge,
                              backgroundColor: cat.bg,
                              borderColor: cat.border,
                              color: cat.color,
                            }}
                          >
                            <CatIcon size={13} color={cat.color} />
                            {cat.short}
                          </span>
                        </td>
                        <td style={styles.tdAmount}>
                          <span style={styles.amountGold}>{formatINR(item.amount)}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.methodBadge}>
                            <MethodIcon size={13} color={method.color} />
                            {method.label}
                          </span>
                        </td>
                        <td style={styles.tdDate}>
                          {item.expense_date
                            ? new Date(item.expense_date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td style={styles.td}>
                          <span style={styles.staffBadge}>
                            {item.recorded_by_name || 'System Admin'}
                          </span>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <div style={styles.actionBtnGroup}>
                            <button
                              style={styles.actionBtn}
                              onClick={() => setViewingExpense(item)}
                              title="View details"
                            >
                              <Eye size={15} color="#38bdf8" />
                            </button>
                            <button
                              style={styles.actionBtn}
                              onClick={() => openPrintModal('single', item)}
                              title="Print voucher"
                            >
                              <Printer size={15} color="#d4af37" />
                            </button>
                            <button
                              style={styles.actionBtn}
                              onClick={() => openEditModal(item)}
                              title="Edit expense"
                            >
                              <Edit2 size={15} color="#facc15" />
                            </button>
                            <button
                              style={{ ...styles.actionBtn, borderColor: 'rgba(239, 68, 68, 0.3)' }}
                              onClick={() => setDeletingExpense(item)}
                              title="Delete record"
                            >
                              <Trash2 size={15} color="#ef4444" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EXPENSE REPORTS & ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div style={styles.reportsContainer}>
          <div style={styles.reportsHeaderCard}>
            <div style={styles.reportControls}>
              <div style={styles.periodBtnGroup}>
                <span style={styles.periodLabel}>Report Granularity:</span>
                <button
                  style={{
                    ...styles.periodBtn,
                    ...(reportPeriod === 'daily' ? styles.periodBtnActive : {}),
                  }}
                  onClick={() => setReportPeriod('daily')}
                >
                  Daily
                </button>
                <button
                  style={{
                    ...styles.periodBtn,
                    ...(reportPeriod === 'monthly' ? styles.periodBtnActive : {}),
                  }}
                  onClick={() => setReportPeriod('monthly')}
                >
                  Monthly
                </button>
                <button
                  style={{
                    ...styles.periodBtn,
                    ...(reportPeriod === 'yearly' ? styles.periodBtnActive : {}),
                  }}
                  onClick={() => setReportPeriod('yearly')}
                >
                  Yearly
                </button>
              </div>

              <div style={styles.reportPrintActions}>
                <button style={styles.printReportBtn} onClick={() => openPrintModal('summary')}>
                  <Printer size={16} />
                  <span>Print Formal Report</span>
                </button>
              </div>
            </div>

            {/* Report Totals Banner */}
            {reportsData && (
              <div style={styles.reportSummaryBanner}>
                <div style={styles.reportBannerMetric}>
                  <span style={styles.reportMetricLabel}>Selected Period Outflow</span>
                  <span style={styles.reportMetricVal}>{formatINR(reportsData.totalAmount)}</span>
                </div>
                <div style={styles.reportBannerDivider} />
                <div style={styles.reportBannerMetric}>
                  <span style={styles.reportMetricLabel}>Total Disbursed Items</span>
                  <span style={styles.reportMetricVal}>{reportsData.totalCount} items</span>
                </div>
                <div style={styles.reportBannerDivider} />
                <div style={styles.reportBannerMetric}>
                  <span style={styles.reportMetricLabel}>Average Outflow / Item</span>
                  <span style={styles.reportMetricVal}>
                    {formatINR(
                      reportsData.totalCount > 0 ? reportsData.totalAmount / reportsData.totalCount : 0
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Report Timeline Breakdown Table */}
          <div style={styles.tableCard}>
            <div style={styles.reportTableTitleRow}>
              <FileSpreadsheet size={18} color="#d4af37" />
              <h3 style={styles.reportTableTitle}>
                Periodic Outflow Breakdown ({reportPeriod.toUpperCase()})
              </h3>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeadRow}>
                    <th style={styles.th}>PERIOD TIMELINE</th>
                    <th style={styles.th}>TRANSACTIONS COUNT</th>
                    <th style={styles.th}>TOTAL DISBURSED</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>% OF REPORT TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {reportLoading ? (
                    <tr>
                      <td colSpan={4} style={styles.loadingCell}>
                        <div style={styles.loadingWrapper}>
                          <RefreshCw size={22} color="#d4af37" className="animate-spin" />
                          <span>Generating periodic report breakdown...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !reportsData || reportsData.timeline.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={styles.emptyCell}>
                        No expense records found for the selected timeline.
                      </td>
                    </tr>
                  ) : (
                    reportsData.timeline.map((row) => {
                      const totalRep = reportsData.totalAmount || 1
                      const pct = ((row.total_amount / totalRep) * 100).toFixed(1)

                      return (
                        <tr key={row.label} style={styles.tableRow}>
                          <td style={styles.tdId}>
                            <span style={styles.periodBadge}>{row.label}</span>
                          </td>
                          <td style={styles.td}>{row.count} voucher(s)</td>
                          <td style={styles.tdAmount}>
                            <span style={styles.amountGold}>{formatINR(row.total_amount)}</span>
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>
                            <span style={styles.pctBadge}>{pct}%</span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD / EDIT EXPENSE */}
      {/* ========================================================================= */}
      {isAddEditModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsAddEditModalOpen(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={styles.modalIconBox}>
                  <Receipt size={22} color="#d4af37" />
                </div>
                <div>
                  <h2 style={styles.modalTitle}>
                    {editingExpense ? `Edit Expense #${editingExpense.id}` : 'Record New Hotel Expense'}
                  </h2>
                  <p style={styles.modalSubtitle}>
                    {editingExpense
                      ? 'Update expense details in PostgreSQL audit ledger.'
                      : 'Log procurement, operational overhead, or utility bill disbursement.'}
                  </p>
                </div>
              </div>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setIsAddEditModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            {/* Quick Suggestion Presets (Only in Add mode) */}
            {!editingExpense && (
              <div style={styles.presetSection}>
                <span style={styles.presetLabel}>Quick Presets:</span>
                <div style={styles.presetPills}>
                  <button
                    type="button"
                    style={styles.presetPill}
                    onClick={() => handleQuickPreset('Monthly Electricity Bill', 'utilities')}
                  >
                    ⚡ Electricity
                  </button>
                  <button
                    type="button"
                    style={styles.presetPill}
                    onClick={() => handleQuickPreset('Water Tanker Refill', 'utilities')}
                  >
                    💧 Water
                  </button>
                  <button
                    type="button"
                    style={styles.presetPill}
                    onClick={() => handleQuickPreset('Kitchen Grocery & Vegetables', 'food_beverage')}
                  >
                    🍳 Kitchen Grocery
                  </button>
                  <button
                    type="button"
                    style={styles.presetPill}
                    onClick={() => handleQuickPreset('Housekeeping Cleaning Supplies', 'supplies')}
                  >
                    🧹 Housekeeping
                  </button>
                  <button
                    type="button"
                    style={styles.presetPill}
                    onClick={() => handleQuickPreset('AC & Plumbing Maintenance', 'maintenance')}
                  >
                    🔧 AC/Plumbing
                  </button>
                  <button
                    type="button"
                    style={styles.presetPill}
                    onClick={() => handleQuickPreset('High-speed Internet Fiber', 'utilities')}
                  >
                    🌐 Internet
                  </button>
                </div>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} style={styles.modalForm}>
              <div style={styles.formRow}>
                {/* Title */}
                <div style={styles.formGroupFlex2}>
                  <label style={styles.formLabel}>
                    Expense Title <span style={styles.reqStar}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. October Electricity Bill, Fresh Linen Purchase"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    style={{
                      ...styles.formInput,
                      borderColor: formErrors.title ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                    }}
                  />
                  {formErrors.title && <span style={styles.errorText}>{formErrors.title}</span>}
                </div>

                {/* Amount */}
                <div style={styles.formGroupFlex1}>
                  <label style={styles.formLabel}>
                    Amount (INR) <span style={styles.reqStar}>*</span>
                  </label>
                  <div style={styles.inputPrefixWrapper}>
                    <span style={styles.inputPrefix}>₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      style={{
                        ...styles.formInputPrefixed,
                        borderColor: formErrors.amount ? '#ef4444' : 'rgba(212, 175, 55, 0.3)',
                      }}
                    />
                  </div>
                  {formErrors.amount && <span style={styles.errorText}>{formErrors.amount}</span>}
                </div>
              </div>

              <div style={styles.formRow}>
                {/* Category */}
                <div style={styles.formGroupFlex1}>
                  <label style={styles.formLabel}>
                    Category <span style={styles.reqStar}>*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={styles.formSelect}
                  >
                    <option value="utilities">Utilities (Electricity, Water, Internet)</option>
                    <option value="maintenance">Maintenance & Repairs</option>
                    <option value="supplies">Supplies (Housekeeping, Laundry, Office)</option>
                    <option value="food_beverage">Food & Kitchen (F&B)</option>
                    <option value="salaries">Staff Salaries & Wages</option>
                    <option value="other">Other Operational / Transport</option>
                  </select>
                </div>

                {/* Payment Method */}
                <div style={styles.formGroupFlex1}>
                  <label style={styles.formLabel}>
                    Disbursement Channel <span style={styles.reqStar}>*</span>
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    style={styles.formSelect}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                  </select>
                </div>

                {/* Expense Date */}
                <div style={styles.formGroupFlex1}>
                  <label style={styles.formLabel}>
                    Payment Date <span style={styles.reqStar}>*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    style={styles.formInput}
                  />
                  {formErrors.expenseDate && (
                    <span style={styles.errorText}>{formErrors.expenseDate}</span>
                  )}
                </div>
              </div>

              <div style={styles.formRow}>
                {/* Vendor / Supplier */}
                <div style={styles.formGroupFlex1}>
                  <label style={styles.formLabel}>Vendor / Supplier Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. State Electricity Board, Adani Power, Metro Cash & Carry"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    style={styles.formInput}
                  />
                </div>

                {/* Reference Number */}
                <div style={styles.formGroupFlex1}>
                  <label style={styles.formLabel}>Ref / Transaction / Bill # (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI-98765432, CHQ-445102, INV-8821"
                    value={formData.referenceNumber}
                    onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                    style={styles.formInput}
                  />
                </div>
              </div>

              {/* Description / Notes */}
              <div style={styles.formGroupFull}>
                <label style={styles.formLabel}>Description & Purpose Notes</label>
                <textarea
                  rows={3}
                  placeholder="Additional context or approval notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={styles.formTextarea}
                />
              </div>

              {/* Modal Actions */}
              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.modalCancelBtn}
                  onClick={() => setIsAddEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.modalSubmitBtn} disabled={formSubmitting}>
                  {formSubmitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Saving to PostgreSQL...</span>
                    </>
                  ) : (
                    <span>{editingExpense ? 'Save Changes' : 'Record Expense Voucher'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VIEW EXPENSE DETAILS */}
      {/* ========================================================================= */}
      {viewingExpense && (
        <div style={styles.modalOverlay} onClick={() => setViewingExpense(null)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={styles.modalIconBox}>
                  <Receipt size={22} color="#d4af37" />
                </div>
                <div>
                  <h2 style={styles.modalTitle}>Expense Voucher #{viewingExpense.id}</h2>
                  <p style={styles.modalSubtitle}>GITA DEVI HOTEL — Operations & Disbursement Ledger</p>
                </div>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setViewingExpense(null)}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <div style={styles.detailsContent}>
              <div style={styles.detailsTopBanner}>
                <div>
                  <span style={styles.detailsLabel}>Expense Title</span>
                  <div style={styles.detailsTitleVal}>{viewingExpense.title}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={styles.detailsLabel}>Disbursed Amount</span>
                  <div style={styles.detailsAmountVal}>{formatINR(viewingExpense.amount)}</div>
                </div>
              </div>

              <div style={styles.detailsGrid}>
                <div style={styles.detailsItem}>
                  <span style={styles.detailsLabel}>Category:</span>
                  <span style={styles.detailsVal}>
                    {CATEGORY_MAP[viewingExpense.category]?.label || viewingExpense.category}
                  </span>
                </div>

                <div style={styles.detailsItem}>
                  <span style={styles.detailsLabel}>Disbursement Channel:</span>
                  <span style={styles.detailsVal}>
                    {PAYMENT_METHOD_MAP[viewingExpense.payment_method]?.label ||
                      viewingExpense.payment_method}
                  </span>
                </div>

                <div style={styles.detailsItem}>
                  <span style={styles.detailsLabel}>Expense Date:</span>
                  <span style={styles.detailsVal}>
                    {viewingExpense.expense_date
                      ? new Date(viewingExpense.expense_date).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '—'}
                  </span>
                </div>

                <div style={styles.detailsItem}>
                  <span style={styles.detailsLabel}>Authorized / Recorded By:</span>
                  <span style={styles.detailsVal}>
                    {viewingExpense.recorded_by_name || 'System Administrator'}
                  </span>
                </div>

                <div style={styles.detailsItemFull}>
                  <span style={styles.detailsLabel}>Full Description & Audit Record:</span>
                  <div style={styles.detailsDescBox}>
                    {viewingExpense.description || 'No additional remarks provided.'}
                  </div>
                </div>

                <div style={styles.detailsItem}>
                  <span style={styles.detailsLabel}>Logged In System:</span>
                  <span style={styles.detailsValSub}>
                    {viewingExpense.created_at
                      ? new Date(viewingExpense.created_at).toLocaleString('en-IN')
                      : '—'}
                  </span>
                </div>
              </div>

              <div style={styles.detailsActions}>
                <button
                  style={styles.voucherPrintBtn}
                  onClick={() => {
                    setViewingExpense(null)
                    openPrintModal('single', viewingExpense)
                  }}
                >
                  <Printer size={16} />
                  <span>Print Expense Voucher</span>
                </button>
                <button style={styles.modalCancelBtn} onClick={() => setViewingExpense(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {deletingExpense && (
        <div style={styles.modalOverlay} onClick={() => setDeletingExpense(null)}>
          <div style={styles.confirmModalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.confirmIconBox}>
              <AlertCircle size={32} color="#ef4444" />
            </div>
            <h2 style={styles.confirmTitle}>Confirm Expense Deletion</h2>
            <p style={styles.confirmText}>
              Are you sure you want to delete Expense{' '}
              <strong style={{ color: '#fef08a' }}>
                #{deletingExpense.id} - "{deletingExpense.title}"
              </strong>{' '}
              for <strong style={{ color: '#fbbf24' }}>{formatINR(deletingExpense.amount)}</strong>?
            </p>
            <p style={styles.confirmWarning}>
              ⚠️ This will remove the transaction from the PostgreSQL database ledger.
            </p>

            <div style={styles.confirmActions}>
              <button style={styles.modalCancelBtn} onClick={() => setDeletingExpense(null)}>
                Cancel
              </button>
              <button style={styles.confirmDeleteBtn} onClick={confirmDeleteExpense}>
                Yes, Delete Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PRINTABLE EXPENSE VOUCHER / SUMMARY REPORT */}
      {/* ========================================================================= */}
      {isPrintModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsPrintModalOpen(false)}>
          <div
            style={styles.printModalBox}
            onClick={(e) => e.stopPropagation()}
            ref={printAreaRef}
          >
            {/* Action Bar (Hidden on paper print) */}
            <div style={styles.printActionBar} className="no-print">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} color="#d4af37" />
                <span style={styles.printActionTitle}>
                  {printType === 'single'
                    ? `Official Expense Voucher #${printTargetItem?.id}`
                    : 'Official Hotel Expense Audit Summary'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={styles.printTriggerBtn} onClick={triggerBrowserPrint}>
                  <Printer size={16} />
                  <span>Print / Save as PDF</span>
                </button>
                <button style={styles.modalCloseBtn} onClick={() => setIsPrintModalOpen(false)}>
                  <X size={20} color="#94a3b8" />
                </button>
              </div>
            </div>

            {/* Printable Document Paper Layout */}
            <div style={styles.printablePaper} className="printable-content">
              {/* Hotel Luxury Brand Header */}
              <div style={styles.paperHeader}>
                <div style={styles.paperBrandLeft}>
                  <HotelLogo size={48} showText={false} />
                  <div>
                    <h1 style={styles.paperHotelTitle}>GITA DEVI HOTEL</h1>
                    <p style={styles.paperHotelSubtitle}>Luxury Palace & Hospitality Management</p>
                    <p style={styles.paperAddress}>Station Road, Main Civil Lines, Bihar, India</p>
                    <p style={styles.paperContact}>Phone: +91 98765 43210 | info@gitadevihotel.com</p>
                  </div>
                </div>

                <div style={styles.paperDocRight}>
                  <div style={styles.paperDocBadge}>
                    {printType === 'single' ? 'DISBURSEMENT VOUCHER' : 'EXPENSE AUDIT SUMMARY'}
                  </div>
                  <div style={styles.paperMetaRow}>
                    <span>Date Issued:</span>
                    <strong>{new Date().toLocaleDateString('en-IN')}</strong>
                  </div>
                  {printType === 'single' && printTargetItem && (
                    <div style={styles.paperMetaRow}>
                      <span>Voucher Ref:</span>
                      <strong>EXP-VCH-{printTargetItem.id}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.paperDivider} />

              {/* SINGLE VOUCHER PRINT */}
              {printType === 'single' && printTargetItem && (
                <div>
                  <div style={styles.paperDetailsGrid}>
                    <div style={styles.paperGridItem}>
                      <span style={styles.paperLabel}>EXPENSE TITLE:</span>
                      <strong style={styles.paperVal}>{printTargetItem.title}</strong>
                    </div>
                    <div style={styles.paperGridItem}>
                      <span style={styles.paperLabel}>CATEGORY:</span>
                      <strong style={styles.paperVal}>
                        {CATEGORY_MAP[printTargetItem.category]?.label || printTargetItem.category}
                      </strong>
                    </div>
                    <div style={styles.paperGridItem}>
                      <span style={styles.paperLabel}>DATE OF PAYMENT:</span>
                      <strong style={styles.paperVal}>
                        {new Date(printTargetItem.expense_date).toLocaleDateString('en-IN')}
                      </strong>
                    </div>
                    <div style={styles.paperGridItem}>
                      <span style={styles.paperLabel}>PAYMENT METHOD:</span>
                      <strong style={styles.paperVal}>
                        {PAYMENT_METHOD_MAP[printTargetItem.payment_method]?.label ||
                          printTargetItem.payment_method}
                      </strong>
                    </div>
                    <div style={styles.paperGridItem}>
                      <span style={styles.paperLabel}>AUTHORIZED BY:</span>
                      <strong style={styles.paperVal}>
                        {printTargetItem.recorded_by_name || 'System Administrator'}
                      </strong>
                    </div>
                    <div style={styles.paperGridItem}>
                      <span style={styles.paperLabel}>VOUCHER AMOUNT:</span>
                      <strong style={styles.paperValBig}>{formatINR(printTargetItem.amount)}</strong>
                    </div>
                  </div>

                  {printTargetItem.description && (
                    <div style={styles.paperNotesBox}>
                      <span style={styles.paperLabel}>AUDIT REMARKS & NOTES:</span>
                      <p style={styles.paperNotesText}>{printTargetItem.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* SUMMARY REPORT PRINT */}
              {printType === 'summary' && (
                <div>
                  {/* Summary Metric Strip on Paper */}
                  <div style={styles.paperSummaryStrip}>
                    <div style={styles.paperSummaryCol}>
                      <span>Total Outflow:</span>
                      <strong>{formatINR(stats.totalAmount)}</strong>
                    </div>
                    <div style={styles.paperSummaryCol}>
                      <span>This Month:</span>
                      <strong>{formatINR(stats.monthAmount)}</strong>
                    </div>
                    <div style={styles.paperSummaryCol}>
                      <span>Today's Expenses:</span>
                      <strong>{formatINR(stats.todayAmount)}</strong>
                    </div>
                    <div style={styles.paperSummaryCol}>
                      <span>Total Vouchers:</span>
                      <strong>{stats.totalCount} items</strong>
                    </div>
                  </div>

                  {/* Summary Category Breakdown Table */}
                  <h4 style={styles.paperSectionTitle}>CATEGORY BREAKDOWN</h4>
                  <table style={styles.paperTable}>
                    <thead>
                      <tr>
                        <th style={styles.paperTh}>Category</th>
                        <th style={styles.paperTh}>Transactions</th>
                        <th style={styles.paperTh}>Total Amount</th>
                        <th style={styles.paperTh}>Share %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.categorySummary.map((c) => (
                        <tr key={c.category}>
                          <td style={styles.paperTd}>
                            {CATEGORY_MAP[c.category]?.label || c.category}
                          </td>
                          <td style={styles.paperTd}>{c.count}</td>
                          <td style={styles.paperTd}>
                            <strong>{formatINR(c.total_amount)}</strong>
                          </td>
                          <td style={styles.paperTd}>{c.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Recent 15 Items Table on Paper */}
                  <h4 style={styles.paperSectionTitle}>RECENT EXPENSE TRANSACTIONS</h4>
                  <table style={styles.paperTable}>
                    <thead>
                      <tr>
                        <th style={styles.paperTh}>ID</th>
                        <th style={styles.paperTh}>Title</th>
                        <th style={styles.paperTh}>Category</th>
                        <th style={styles.paperTh}>Date</th>
                        <th style={styles.paperTh}>Method</th>
                        <th style={{ ...styles.paperTh, textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.slice(0, 15).map((exp) => (
                        <tr key={exp.id}>
                          <td style={styles.paperTd}>#{exp.id}</td>
                          <td style={styles.paperTd}>{exp.title}</td>
                          <td style={styles.paperTd}>
                            {CATEGORY_MAP[exp.category]?.short || exp.category}
                          </td>
                          <td style={styles.paperTd}>
                            {new Date(exp.expense_date).toLocaleDateString('en-IN')}
                          </td>
                          <td style={styles.paperTd}>{exp.payment_method}</td>
                          <td style={{ ...styles.paperTd, textAlign: 'right' }}>
                            <strong>{formatINR(exp.amount)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Signatures Block */}
              <div style={styles.paperSignaturesRow}>
                <div style={styles.signatureCol}>
                  <div style={styles.sigLine} />
                  <span style={styles.sigLabel}>Prepared By (Accounts Officer)</span>
                </div>
                <div style={styles.signatureCol}>
                  <div style={styles.sigLine} />
                  <span style={styles.sigLabel}>Verified By (Operations Manager)</span>
                </div>
                <div style={styles.signatureCol}>
                  <div style={styles.sigLine} />
                  <span style={styles.sigLabel}>General Manager / MD Approval</span>
                </div>
              </div>

              {/* Paper Footer */}
              <div style={styles.paperFooter}>
                <span>
                  Official Financial Document generated by GITA DEVI HOTEL ERP • Valid without stamp if digitally signed.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =========================================================================
// LUXURY DARK & GOLD STYLES
// =========================================================================
const styles = {
  container: {
    padding: '24px 32px',
    backgroundColor: '#060913',
    minHeight: '100vh',
    color: '#e2e8f0',
    fontFamily: "'Inter', sans-serif",
  },
  toast: {
    position: 'fixed',
    top: '24px',
    right: '24px',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 22px',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    border: '1px solid',
  },
  toastText: {
    letterSpacing: '0.3px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '28px',
    flexWrap: 'wrap',
    gap: '20px',
  },
  badgeRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '8px',
  },
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#38bdf8',
    letterSpacing: '0.5px',
  },
  livePulse: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#38bdf8',
  },
  royalPill: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#d4af37',
    letterSpacing: '0.5px',
  },
  title: {
    fontSize: '26px',
    fontWeight: '800',
    color: '#fef08a',
    margin: '0 0 6px 0',
    letterSpacing: '-0.3px',
    textShadow: '0 2px 10px rgba(212, 175, 55, 0.2)',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
    maxWidth: '680px',
    lineHeight: '1.5',
  },
  actionButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '10px',
    color: '#d4af37',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  printReportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    border: '1px solid rgba(212, 175, 55, 0.4)',
    borderRadius: '10px',
    color: '#fef08a',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    border: 'none',
    borderRadius: '10px',
    color: '#060913',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(212, 175, 55, 0.35)',
    transition: 'all 0.2s',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '18px',
    marginBottom: '24px',
  },
  categoryStripCard: {
    backgroundColor: '#0a1020',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: '14px',
    padding: '20px 24px',
    marginBottom: '20px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  },
  stripHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  stripTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  stripTitle: {
    fontSize: '13px',
    fontWeight: '800',
    color: '#fef08a',
    letterSpacing: '0.8px',
  },
  stripSub: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '14px',
  },
  categoryMiniCard: {
    borderRadius: '10px',
    border: '1px solid',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  catMiniTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catMiniName: {
    fontSize: '12px',
    fontWeight: '700',
  },
  catMiniPct: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#e2e8f0',
  },
  catMiniAmt: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#ffffff',
    marginTop: '4px',
  },
  catMiniCount: {
    fontSize: '11px',
    color: '#94a3b8',
    marginBottom: '6px',
  },
  progressBarTrack: {
    width: '100%',
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.4s ease',
  },
  methodStripCard: {
    backgroundColor: '#0a1020',
    border: '1px solid rgba(212, 175, 55, 0.15)',
    borderRadius: '12px',
    padding: '12px 20px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '14px',
  },
  methodStripTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  methodStripTitle: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#d4af37',
    letterSpacing: '0.6px',
  },
  methodTotalsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  methodPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    fontSize: '12px',
  },
  methodPillLabel: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  methodPillAmt: {
    fontWeight: '700',
  },
  tabNavRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px',
    borderBottom: '1px solid rgba(212, 175, 55, 0.15)',
    paddingBottom: '8px',
  },
  tabNavBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#94a3b8',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabNavBtnActive: {
    color: '#fef08a',
    borderBottomColor: '#d4af37',
    fontWeight: '800',
  },
  tableCard: {
    backgroundColor: '#0a1020',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
  },
  filterBar: {
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    borderBottom: '1px solid rgba(212, 175, 55, 0.12)',
    backgroundColor: '#0d152a',
  },
  searchBox: {
    flex: '1 1 260px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#060913',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '8px',
    padding: '8px 12px',
  },
  searchInput: {
    width: '100%',
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ffffff',
    fontSize: '13px',
  },
  clearSearchBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
  },
  filterSelect: {
    padding: '8px 12px',
    backgroundColor: '#060913',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '8px',
    color: '#fef08a',
    fontSize: '13px',
    fontWeight: '600',
    outline: 'none',
    cursor: 'pointer',
  },
  dateFilterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#060913',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: '8px',
    padding: '6px 10px',
  },
  dateLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '600',
  },
  dateInput: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: '12px',
    outline: 'none',
  },
  resetDateBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
  },
  sortToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#060913',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '8px',
    color: '#d4af37',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px',
  },
  tableHeadRow: {
    backgroundColor: '#0d152a',
    borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
  },
  th: {
    padding: '14px 16px',
    fontSize: '11px',
    fontWeight: '800',
    color: '#d4af37',
    letterSpacing: '0.6px',
  },
  tableRow: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    transition: 'background-color 0.15s',
  },
  td: {
    padding: '14px 16px',
    color: '#cbd5e1',
  },
  tdId: {
    padding: '14px 16px',
    fontWeight: '700',
  },
  idBadge: {
    padding: '3px 8px',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '6px',
    color: '#fef08a',
    fontSize: '12px',
    fontWeight: '700',
  },
  tdTitle: {
    padding: '14px 16px',
    maxWidth: '280px',
  },
  titleText: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '2px',
  },
  descText: {
    fontSize: '11px',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  catBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '11px',
    fontWeight: '700',
  },
  tdAmount: {
    padding: '14px 16px',
    fontWeight: '800',
  },
  amountGold: {
    color: '#fef08a',
    fontSize: '14px',
    letterSpacing: '0.3px',
  },
  methodBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#e2e8f0',
  },
  tdDate: {
    padding: '14px 16px',
    fontSize: '12px',
    color: '#94a3b8',
  },
  staffBadge: {
    fontSize: '12px',
    color: '#a78bfa',
    fontWeight: '600',
  },
  actionBtnGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  actionBtn: {
    padding: '6px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  },
  loadingCell: {
    padding: '60px 20px',
    textAlign: 'center',
  },
  loadingWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    color: '#94a3b8',
    fontSize: '14px',
  },
  emptyCell: {
    padding: '60px 20px',
    textAlign: 'center',
  },
  emptyWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#fef08a',
    margin: '6px 0 0 0',
  },
  emptyDesc: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: 0,
    maxWidth: '400px',
  },
  emptyAddBtn: {
    marginTop: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#060913',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '12px',
  },
  // Reports View
  reportsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  reportsHeaderCard: {
    backgroundColor: '#0a1020',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: '14px',
    padding: '20px 24px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  },
  reportControls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '14px',
    marginBottom: '20px',
  },
  periodBtnGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  periodLabel: {
    fontSize: '13px',
    color: '#94a3b8',
    fontWeight: '600',
  },
  periodBtn: {
    padding: '6px 14px',
    backgroundColor: '#060913',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '6px',
    color: '#cbd5e1',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  periodBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderColor: '#d4af37',
    color: '#fef08a',
    fontWeight: '800',
  },
  reportPrintActions: {
    display: 'flex',
    gap: '10px',
  },
  reportSummaryBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#060913',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '10px',
    padding: '16px 20px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  reportBannerMetric: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  reportMetricLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  reportMetricVal: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#fef08a',
  },
  reportBannerDivider: {
    width: '1px',
    height: '36px',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  reportTableTitleRow: {
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#0d152a',
    borderBottom: '1px solid rgba(212, 175, 55, 0.15)',
  },
  reportTableTitle: {
    fontSize: '13px',
    fontWeight: '800',
    color: '#fef08a',
    letterSpacing: '0.6px',
    margin: 0,
  },
  periodBadge: {
    padding: '3px 10px',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    borderRadius: '6px',
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: '700',
  },
  pctBadge: {
    padding: '3px 8px',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '6px',
    color: '#d4af37',
    fontSize: '12px',
    fontWeight: '800',
  },
  // Modals
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    backdropFilter: 'blur(5px)',
    zIndex: 9990,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modalBox: {
    width: '100%',
    maxWidth: '680px',
    backgroundColor: '#0a1020',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    borderRadius: '16px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
    overflow: 'hidden',
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    padding: '20px 24px',
    backgroundColor: '#0d152a',
    borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalIconBox: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#fef08a',
    margin: '0 0 2px 0',
  },
  modalSubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
  },
  presetSection: {
    padding: '12px 24px',
    backgroundColor: 'rgba(212, 175, 55, 0.04)',
    borderBottom: '1px solid rgba(212, 175, 55, 0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  presetLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#d4af37',
  },
  presetPills: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  presetPill: {
    padding: '4px 10px',
    backgroundColor: '#060913',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '100px',
    color: '#cbd5e1',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  modalForm: {
    padding: '24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  formGroupFlex1: {
    flex: '1 1 180px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formGroupFlex2: {
    flex: '2 1 280px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formGroupFull: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#fef08a',
  },
  reqStar: {
    color: '#ef4444',
  },
  formInput: {
    padding: '10px 14px',
    backgroundColor: '#060913',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
  },
  inputPrefixWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#060913',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  inputPrefix: {
    padding: '0 12px',
    color: '#d4af37',
    fontWeight: '800',
    fontSize: '14px',
  },
  formInputPrefixed: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#fef08a',
    fontSize: '14px',
    fontWeight: '700',
    outline: 'none',
  },
  formSelect: {
    padding: '10px 12px',
    backgroundColor: '#060913',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  formTextarea: {
    padding: '10px 14px',
    backgroundColor: '#060913',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
    resize: 'vertical',
  },
  errorText: {
    fontSize: '11px',
    color: '#ef4444',
    fontWeight: '600',
  },
  modalActions: {
    marginTop: '10px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  modalCancelBtn: {
    padding: '10px 18px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    color: '#cbd5e1',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  modalSubmitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 22px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#060913',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)',
  },
  // Details Modal
  detailsContent: {
    padding: '24px',
    overflowY: 'auto',
  },
  detailsTopBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#060913',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '10px',
    padding: '16px 20px',
    marginBottom: '20px',
  },
  detailsTitleVal: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#ffffff',
    marginTop: '2px',
  },
  detailsAmountVal: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#fef08a',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '14px',
    marginBottom: '20px',
  },
  detailsItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  detailsItemFull: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  detailsLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  detailsVal: {
    fontSize: '13px',
    color: '#e2e8f0',
    fontWeight: '600',
  },
  detailsValSub: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  detailsDescBox: {
    padding: '12px 14px',
    backgroundColor: '#060913',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: '1.5',
  },
  detailsActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '10px',
  },
  voucherPrintBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    border: '1px solid rgba(212, 175, 55, 0.4)',
    borderRadius: '8px',
    color: '#fef08a',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  // Confirm Delete Modal
  confirmModalBox: {
    width: '100%',
    maxWidth: '460px',
    backgroundColor: '#0a1020',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '16px',
    padding: '28px',
    textAlign: 'center',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
  },
  confirmIconBox: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    margin: '0 auto 16px auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#ffffff',
    margin: '0 0 10px 0',
  },
  confirmText: {
    fontSize: '14px',
    color: '#cbd5e1',
    lineHeight: '1.5',
    margin: '0 0 8px 0',
  },
  confirmWarning: {
    fontSize: '12px',
    color: '#ef4444',
    margin: '0 0 20px 0',
    fontWeight: '600',
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
  },
  confirmDeleteBtn: {
    padding: '10px 20px',
    backgroundColor: '#ef4444',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  // Printable Paper Layout
  printModalBox: {
    width: '100%',
    maxWidth: '820px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    borderRadius: '12px',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
    overflow: 'hidden',
    maxHeight: '94vh',
    display: 'flex',
    flexDirection: 'column',
  },
  printActionBar: {
    padding: '14px 20px',
    backgroundColor: '#0a1020',
    borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  printActionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#fef08a',
  },
  printTriggerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #fef08a 0%, #d4af37 100%)',
    border: 'none',
    borderRadius: '6px',
    color: '#060913',
    fontWeight: '800',
    fontSize: '12px',
    cursor: 'pointer',
  },
  printablePaper: {
    padding: '36px 42px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    overflowY: 'auto',
    fontFamily: "'Inter', sans-serif",
  },
  paperHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  paperBrandLeft: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
  },
  paperHotelTitle: {
    fontSize: '22px',
    fontWeight: '900',
    color: '#854d0e',
    margin: '0 0 2px 0',
    letterSpacing: '0.5px',
  },
  paperHotelSubtitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#b45309',
    margin: '0 0 6px 0',
  },
  paperAddress: {
    fontSize: '11px',
    color: '#475569',
    margin: 0,
  },
  paperContact: {
    fontSize: '11px',
    color: '#475569',
    margin: 0,
  },
  paperDocRight: {
    textAlign: 'right',
  },
  paperDocBadge: {
    display: 'inline-block',
    padding: '5px 12px',
    backgroundColor: '#fef3c7',
    border: '1px solid #d97706',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '800',
    color: '#92400e',
    marginBottom: '8px',
  },
  paperMetaRow: {
    fontSize: '11px',
    color: '#475569',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '6px',
    marginTop: '2px',
  },
  paperDivider: {
    height: '2px',
    backgroundColor: '#e2e8f0',
    margin: '16px 0 20px 0',
  },
  paperDetailsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
    marginBottom: '20px',
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  paperGridItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  paperLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: '0.4px',
  },
  paperVal: {
    fontSize: '13px',
    color: '#0f172a',
  },
  paperValBig: {
    fontSize: '20px',
    color: '#b45309',
    fontWeight: '800',
  },
  paperNotesBox: {
    padding: '12px 14px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    marginBottom: '24px',
  },
  paperNotesText: {
    fontSize: '12px',
    color: '#334155',
    margin: '4px 0 0 0',
    lineHeight: '1.5',
  },
  paperSummaryStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    marginBottom: '20px',
  },
  paperSummaryCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontSize: '11px',
    color: '#475569',
  },
  paperSectionTitle: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#854d0e',
    margin: '16px 0 8px 0',
    letterSpacing: '0.5px',
  },
  paperTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
    marginBottom: '16px',
  },
  paperTh: {
    padding: '8px 10px',
    backgroundColor: '#f1f5f9',
    borderBottom: '1px solid #cbd5e1',
    color: '#334155',
    fontWeight: '700',
    textAlign: 'left',
  },
  paperTd: {
    padding: '8px 10px',
    borderBottom: '1px solid #e2e8f0',
    color: '#1e293b',
  },
  paperSignaturesRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '48px',
    marginBottom: '24px',
  },
  signatureCol: {
    width: '28%',
    textAlign: 'center',
  },
  sigLine: {
    height: '1px',
    backgroundColor: '#475569',
    marginBottom: '6px',
  },
  sigLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#475569',
  },
  paperFooter: {
    borderTop: '1px solid #e2e8f0',
    paddingTop: '12px',
    textAlign: 'center',
    fontSize: '10px',
    color: '#64748b',
  },
}
