import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import {
  Banknote,
  FileText,
  Calendar,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  X,
  Check,
  RefreshCw,
  PlayCircle,
  Clock
} from 'lucide-react'

// ─── Status Badge Helpers ────────────────────────────────────────────────────
const billStatusColors = {
  unpaid: 'bg-yellow-100 text-yellow-800',
  partial: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600'
}

const periodStatusColors = {
  open: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
  generating: 'bg-yellow-100 text-yellow-800'
}

const BillStatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${billStatusColors[status] || 'bg-gray-100 text-gray-800'}`}>
    {status}
  </span>
)

const PeriodStatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${periodStatusColors[status] || 'bg-gray-100 text-gray-800'}`}>
    {status}
  </span>
)

const formatCurrency = (amount) => {
  if (amount == null) return 'KES 0'
  return `KES ${Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Modal Wrapper ───────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className={`bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto ${wide ? 'w-full max-w-3xl' : 'w-full max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── Confirm Dialog ──────────────────────────────────────────────────────────
const ConfirmDialog = ({ open, onClose, onConfirm, title, message, confirmLabel, loading, children }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="p-6">
          {message && <p className="text-gray-600 mb-4">{message}</p>}
          {children}
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={onClose} className="btn btn-secondary" disabled={loading}>Cancel</button>
            <button onClick={onConfirm} className="btn btn-primary" disabled={loading}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
              {confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  TAB 1 — BILLS LIST
// ═══════════════════════════════════════════════════════════════════════════
const BillsTab = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  // Modals
  const [detailBill, setDetailBill] = useState(null)
  const [adjustBill, setAdjustBill] = useState(null)
  const [cancelBill, setCancelBill] = useState(null)
  const [penaltyBill, setPenaltyBill] = useState(null)
  const [actionDropdown, setActionDropdown] = useState(null)

  // Adjust form
  const [adjustType, setAdjustType] = useState('credit')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  // Cancel form
  const [cancelReason, setCancelReason] = useState('')

  // Penalty form
  const [selectedPenaltyRule, setSelectedPenaltyRule] = useState('')

  // Fetch bills
  const { data: billsData, isLoading, refetch } = useQuery(
    ['bills', search, statusFilter, periodFilter, page],
    async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)
      if (periodFilter) params.append('period_id', periodFilter)
      const res = await api.get(`/billing?${params.toString()}`)
      return res.data
    },
    { keepPreviousData: true }
  )

  // Fetch periods for filter
  const { data: periodsData } = useQuery(
    'billing-periods',
    async () => {
      const res = await api.get('/parameters/financial-periods')
      return res.data
    }
  )

  // Fetch penalty rules
  const { data: penaltyRulesData } = useQuery(
    'penalty-rules',
    async () => {
      const res = await api.get('/billing/penalty-rules')
      return res.data
    },
    { enabled: !!penaltyBill }
  )

  // Fetch bill detail
  const { data: billDetailData, isLoading: loadingDetail } = useQuery(
    ['bill-detail', detailBill],
    async () => {
      const res = await api.get(`/billing/${detailBill}`)
      return res.data
    },
    { enabled: !!detailBill }
  )

  // Adjust mutation
  const adjustMutation = useMutation(
    async (data) => {
      const res = await api.post(`/billing/${data.id}/adjust`, data.payload)
      return res.data
    },
    {
      onSuccess: () => {
        toast.success('Bill adjusted successfully')
        setAdjustBill(null)
        setAdjustAmount('')
        setAdjustReason('')
        queryClient.invalidateQueries('bills')
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed to adjust bill')
    }
  )

  // Cancel mutation
  const cancelMutation = useMutation(
    async (data) => {
      const res = await api.post(`/billing/${data.id}/cancel`, { reason: data.reason })
      return res.data
    },
    {
      onSuccess: () => {
        toast.success('Bill cancelled')
        setCancelBill(null)
        setCancelReason('')
        queryClient.invalidateQueries('bills')
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed to cancel bill')
    }
  )

  // Penalty mutation
  const penaltyMutation = useMutation(
    async (data) => {
      const res = await api.post(`/billing/${data.id}/apply-penalty`, data.payload)
      return res.data
    },
    {
      onSuccess: () => {
        toast.success('Penalty applied')
        setPenaltyBill(null)
        setSelectedPenaltyRule('')
        queryClient.invalidateQueries('bills')
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed to apply penalty')
    }
  )

  const bills = billsData?.data || []
  const pagination = billsData?.pagination
  const periods = periodsData?.data || []
  const penaltyRules = penaltyRulesData?.data || []
  const billDetail = billDetailData?.data

  const handleAdjustSubmit = () => {
    if (!adjustAmount || !adjustReason) {
      toast.error('Please fill in all fields')
      return
    }
    const currentTotal = Number(bills.find(b => b.id === adjustBill)?.total_amount || 0)
    const diff = adjustType === 'credit' ? -Number(adjustAmount) : Number(adjustAmount)
    adjustMutation.mutate({
      id: adjustBill,
      payload: {
        adjustment_type: adjustType,
        new_amount: currentTotal + diff,
        reason: adjustReason
      }
    })
  }

  const handleCancelSubmit = () => {
    if (!cancelReason) {
      toast.error('Please provide a reason')
      return
    }
    cancelMutation.mutate({ id: cancelBill, reason: cancelReason })
  }

  const handlePenaltySubmit = () => {
    const rule = penaltyRules.find(r => r.id === Number(selectedPenaltyRule))
    if (!rule) {
      toast.error('Please select a penalty rule')
      return
    }
    penaltyMutation.mutate({
      id: penaltyBill,
      payload: {
        penalty_amount: Number(rule.rate || rule.penalty_amount || 0),
        interest_amount: Number(rule.interest_rate || 0),
        reason: `Applied penalty rule: ${rule.name || rule.rule_name || ''}`
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search account, customer, or bill #..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="input pl-10"
            />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="input w-full sm:w-44">
            <option value="">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={periodFilter} onChange={(e) => { setPeriodFilter(e.target.value); setPage(1) }} className="input w-full sm:w-52">
            <option value="">All Periods</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.period_name || p.name || p.code}</option>
            ))}
          </select>
          <button onClick={() => refetch()} className="btn btn-secondary flex items-center space-x-1">
            <RefreshCw className="w-4 h-4" /><span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Bills Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No bills found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your filters or generate new bills.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Customer</th>
                    <th>Period</th>
                    <th>Bill Date</th>
                    <th>Total Amount</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="font-medium text-blue-600">{bill.bill_no || bill.bill_number || `#${bill.id}`}</td>
                      <td>
                        <div className="font-medium text-gray-900">{bill.customer_name || `${bill.first_name || ''} ${bill.last_name || ''}`.trim()}</div>
                        <div className="text-xs text-gray-500">{bill.account_no || bill.account_number}</div>
                      </td>
                      <td className="text-sm">{bill.period_name || bill.billing_period || '-'}</td>
                      <td className="text-sm">{formatDate(bill.bill_date)}</td>
                      <td className="font-medium">{formatCurrency(bill.total_amount)}</td>
                      <td className={`font-medium ${Number(bill.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(bill.balance)}
                      </td>
                      <td><BillStatusBadge status={bill.status} /></td>
                      <td>
                        <div className="relative">
                          <button
                            onClick={() => setActionDropdown(actionDropdown === bill.id ? null : bill.id)}
                            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                          >
                            Actions ▾
                          </button>
                          {actionDropdown === bill.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActionDropdown(null)} />
                              <div className="absolute right-0 z-20 mt-1 w-40 bg-white border rounded-lg shadow-lg py-1">
                                <button
                                  onClick={() => { setDetailBill(bill.id); setActionDropdown(null) }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                                >
                                  <FileText className="w-4 h-4 inline mr-2" />View
                                </button>
                                {bill.status !== 'cancelled' && (
                                  <>
                                    <button
                                      onClick={() => { setAdjustBill(bill.id); setActionDropdown(null) }}
                                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                                    >
                                      <Banknote className="w-4 h-4 inline mr-2" />Adjust
                                    </button>
                                    <button
                                      onClick={() => { setCancelBill(bill.id); setActionDropdown(null) }}
                                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600"
                                    >
                                      <X className="w-4 h-4 inline mr-2" />Cancel
                                    </button>
                                    <button
                                      onClick={() => { setPenaltyBill(bill.id); setActionDropdown(null) }}
                                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-amber-600"
                                    >
                                      <AlertTriangle className="w-4 h-4 inline mr-2" />Apply Penalty
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-gray-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center space-x-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pagination.page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50">Previous</button>
                  <span className="text-sm text-gray-600">Page {pagination.page} of {pagination.pages}</span>
                  <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={pagination.page === pagination.pages} className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Bill Detail Modal ────────────────────────────────────────────── */}
      <Modal open={!!detailBill} onClose={() => setDetailBill(null)} title="Bill Detail" wide>
        {loadingDetail ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
        ) : billDetail ? (
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Customer Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Name:</span> <span className="font-medium">{billDetail.customer_name}</span></div>
                <div><span className="text-gray-500">Account:</span> <span className="font-medium">{billDetail.account_no}</span></div>
                <div><span className="text-gray-500">Zone:</span> <span className="font-medium">{billDetail.zone_name || '-'}</span></div>
                <div><span className="text-gray-500">Billing Group:</span> <span className="font-medium">{billDetail.billing_group_name || '-'}</span></div>
                <div><span className="text-gray-500">Address:</span> <span className="font-medium">{billDetail.address || '-'}</span></div>
                <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{billDetail.telephone || '-'}</span></div>
              </div>
            </div>

            {/* Reading Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Meter Reading</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-gray-500">Previous:</span> <span className="font-medium">{billDetail.prev_reading ?? billDetail.previous_reading ?? '-'}</span></div>
                <div><span className="text-gray-500">Current:</span> <span className="font-medium">{billDetail.curr_reading ?? billDetail.current_reading ?? '-'}</span></div>
                <div><span className="text-gray-500">Consumption:</span> <span className="font-medium">{billDetail.consumption ?? '-'} m³</span></div>
              </div>
            </div>

            {/* Charges Breakdown */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Charges Breakdown</h3>
              <div className="space-y-1">
                <div className="flex justify-between py-2 border-b text-sm">
                  <span>Water Charge</span>
                  <span className="font-medium">{formatCurrency(billDetail.water_charge)}</span>
                </div>
                <div className="flex justify-between py-2 border-b text-sm">
                  <span>Fixed / Standing Charge</span>
                  <span className="font-medium">{formatCurrency(billDetail.fixed_charge || billDetail.standing_charge)}</span>
                </div>
                {Number(billDetail.sewerage_charge || 0) > 0 && (
                  <div className="flex justify-between py-2 border-b text-sm">
                    <span>Sewerage Charge</span>
                    <span className="font-medium">{formatCurrency(billDetail.sewerage_charge)}</span>
                  </div>
                )}
                {Number(billDetail.penalty_amount || 0) > 0 && (
                  <div className="flex justify-between py-2 border-b text-sm">
                    <span>Penalty</span>
                    <span className="font-medium text-red-600">{formatCurrency(billDetail.penalty_amount)}</span>
                  </div>
                )}
                {Number(billDetail.interest_amount || 0) > 0 && (
                  <div className="flex justify-between py-2 border-b text-sm">
                    <span>Interest</span>
                    <span className="font-medium text-red-600">{formatCurrency(billDetail.interest_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b text-sm">
                  <span>Period</span>
                  <span className="font-medium">{billDetail.period_name || `${formatDate(billDetail.period_start)} – ${formatDate(billDetail.period_end)}`}</span>
                </div>
              </div>
            </div>

            {/* Adjustments History */}
            {billDetail.adjustments && billDetail.adjustments.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Adjustments History</h3>
                <table className="table text-sm">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Original</th>
                      <th>Adjusted</th>
                      <th>Difference</th>
                      <th>Reason</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billDetail.adjustments.map((adj) => (
                      <tr key={adj.id}>
                        <td>{adj.adjustment_type}</td>
                        <td>{formatCurrency(adj.original_amount)}</td>
                        <td>{formatCurrency(adj.adjusted_amount)}</td>
                        <td className={Number(adj.difference) >= 0 ? 'text-red-600' : 'text-green-600'}>
                          {Number(adj.difference) >= 0 ? '+' : ''}{formatCurrency(adj.difference)}
                        </td>
                        <td>{adj.reason}</td>
                        <td>{formatDate(adj.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals Summary */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-blue-800 font-medium">Total Amount</span>
                <span className="text-xl font-bold text-blue-900">{formatCurrency(billDetail.total_amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-800 font-medium">Balance</span>
                <span className={`text-xl font-bold ${Number(billDetail.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(billDetail.balance)}
                </span>
              </div>
              <div className="text-xs text-blue-600 mt-2">
                Bill #{billDetail.bill_no || billDetail.bill_number} • Due: {formatDate(billDetail.due_date)} • Status: {billDetail.status}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Bill not found</p>
        )}
      </Modal>

      {/* ─── Adjust Modal ─────────────────────────────────────────────────── */}
      <Modal open={!!adjustBill} onClose={() => { setAdjustBill(null); setAdjustAmount(''); setAdjustReason('') }} title="Adjust Bill">
        <div className="space-y-4">
          <div>
            <label className="label">Adjustment Type</label>
            <div className="flex space-x-4 mt-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" name="adjType" value="credit" checked={adjustType === 'credit'} onChange={() => setAdjustType('credit')} className="text-blue-600" />
                <span>Credit (Reduce bill)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" name="adjType" value="debit" checked={adjustType === 'debit'} onChange={() => setAdjustType('debit')} className="text-blue-600" />
                <span>Debit (Increase bill)</span>
              </label>
            </div>
          </div>
          <div>
            <label className="label">Amount (KES)</label>
            <input type="number" min="0" step="0.01" className="input w-full" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="Enter amount" />
          </div>
          <div>
            <label className="label">Reason</label>
            <textarea className="input w-full" rows="3" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Provide a reason for this adjustment" />
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button onClick={() => { setAdjustBill(null); setAdjustAmount(''); setAdjustReason('') }} className="btn btn-secondary">Cancel</button>
            <button onClick={handleAdjustSubmit} disabled={adjustMutation.isLoading} className="btn btn-primary">
              {adjustMutation.isLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              Apply Adjustment
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Cancel Confirmation ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!cancelBill}
        onClose={() => { setCancelBill(null); setCancelReason('') }}
        onConfirm={handleCancelSubmit}
        title="Cancel Bill"
        message="Are you sure you want to cancel this bill? This action cannot be undone."
        confirmLabel="Cancel Bill"
        loading={cancelMutation.isLoading}
      >
        <div>
          <label className="label">Reason for Cancellation</label>
          <textarea className="input w-full" rows="3" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Provide a reason for cancellation" />
        </div>
      </ConfirmDialog>

      {/* ─── Apply Penalty Modal ──────────────────────────────────────────── */}
      <Modal open={!!penaltyBill} onClose={() => { setPenaltyBill(null); setSelectedPenaltyRule('') }} title="Apply Penalty">
        <div className="space-y-4">
          <div>
            <label className="label">Select Penalty Rule</label>
            <select className="input w-full" value={selectedPenaltyRule} onChange={(e) => setSelectedPenaltyRule(e.target.value)}>
              <option value="">-- Select a rule --</option>
              {penaltyRules.map((rule) => (
                <option key={rule.id} value={rule.id}>{rule.name || rule.rule_name} — {rule.days_overdue} days overdue</option>
              ))}
            </select>
          </div>
          {selectedPenaltyRule && (() => {
            const rule = penaltyRules.find(r => r.id === Number(selectedPenaltyRule))
            return rule ? (
              <div className="bg-amber-50 rounded-lg p-3 text-sm">
                <p><strong>Rule:</strong> {rule.name || rule.rule_name}</p>
                <p><strong>Grace Days:</strong> {rule.days_overdue || rule.grace_days || '-'}</p>
                <p><strong>Rate / Amount:</strong> {rule.rate || rule.penalty_amount || '-'}</p>
                {rule.max_penalty && <p><strong>Max Penalty:</strong> {rule.max_penalty}</p>}
              </div>
            ) : null
          })()}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button onClick={() => { setPenaltyBill(null); setSelectedPenaltyRule('') }} className="btn btn-secondary">Cancel</button>
            <button onClick={handlePenaltySubmit} disabled={penaltyMutation.isLoading} className="btn btn-primary">
              {penaltyMutation.isLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
              Apply Penalty
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  TAB 2 — MASS BILLING
// ═══════════════════════════════════════════════════════════════════════════
const MassBillingTab = () => {
  const queryClient = useQueryClient()
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [selectedRoute, setSelectedRoute] = useState('')
  const [selectedZone, setSelectedZone] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [massResult, setMassResult] = useState(null)

  // Fetch periods
  const { data: periodsData } = useQuery(
    'billing-periods',
    async () => {
      const res = await api.get('/parameters/financial-periods')
      return res.data
    }
  )

  // Fetch routes
  const { data: routesData } = useQuery(
    'billing-routes-list',
    async () => {
      const res = await api.get('/parameters/billing-routes')
      return res.data
    }
  )

  // Fetch zones
  const { data: zonesData } = useQuery(
    'zones-list',
    async () => {
      const res = await api.get('/parameters/zones')
      return res.data
    }
  )

  // Fetch mass run history (reusing billing endpoint if available)
  const { data: massRunsData, isLoading: loadingRuns } = useQuery(
    'mass-billing-runs',
    async () => {
      try {
        const res = await api.get('/billing/mass-runs')
        return res.data
      } catch {
        return { data: [] }
      }
    }
  )

  // Mass generate mutation
  const massGenerateMutation = useMutation(
    async (data) => {
      const res = await api.post('/billing/mass-generate', data)
      return res.data
    },
    {
      onSuccess: (data) => {
        toast.success(`Generated ${data.count || 0} bills successfully`)
        setMassResult(data)
        setConfirmOpen(false)
        queryClient.invalidateQueries('bills')
        queryClient.invalidateQueries('mass-billing-runs')
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed to generate bills')
    }
  )

  const periods = (periodsData?.data || []).filter(p => p.status === 'open')
  const routes = routesData?.data || []
  const zones = zonesData?.data || []
  const massRuns = massRunsData?.data || []

  const handleGenerate = () => {
    if (!selectedPeriod) {
      toast.error('Please select a billing period')
      return
    }
    const payload = { billing_period_id: Number(selectedPeriod) }
    if (selectedRoute) payload.route_id = Number(selectedRoute)
    if (selectedZone) payload.zone_id = Number(selectedZone)
    // Use period dates as defaults
    const period = periods.find(p => p.id === Number(selectedPeriod))
    if (period) {
      payload.bill_date = new Date().toISOString().split('T')[0]
      payload.due_date = period.end_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
    }
    massGenerateMutation.mutate(payload)
  }

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Mass Bill Generation</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Billing Period *</label>
            <select className="input w-full" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
              <option value="">Select Period</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.period_name || p.name || p.code}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Route (optional)</label>
            <select className="input w-full" value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}>
              <option value="">All Routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>{r.name || r.code}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Zone (optional)</label>
            <select className="input w-full" value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
              <option value="">All Zones</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center space-x-3 mt-6">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!selectedPeriod || massGenerateMutation.isLoading}
            className="btn btn-primary flex items-center space-x-2"
          >
            <PlayCircle className="w-4 h-4" />
            <span>{massGenerateMutation.isLoading ? 'Generating...' : 'Generate Bills'}</span>
          </button>
        </div>
      </div>

      {/* Results */}
      {massResult && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Generation Results</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-green-600">Bills Generated</p>
              <p className="text-2xl font-bold text-green-900">{massResult.count || 0}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-sm text-red-600">Errors</p>
              <p className="text-2xl font-bold text-red-900">{massResult.errors || 0}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-600">Time Taken</p>
              <p className="text-2xl font-bold text-blue-900">{massResult.time_taken || '-'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Run History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Run History</h3>
          <button onClick={() => queryClient.invalidateQueries('mass-billing-runs')} className="btn btn-secondary text-sm flex items-center space-x-1">
            <RefreshCw className="w-3 h-3" /><span>Refresh</span>
          </button>
        </div>
        {loadingRuns ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : massRuns.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No mass billing runs recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Route</th>
                  <th>Zone</th>
                  <th>Status</th>
                  <th>Generated</th>
                  <th>Errors</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {massRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{run.period_name || run.billing_period_id}</td>
                    <td>{run.route_name || run.route_id || 'All'}</td>
                    <td>{run.zone_name || run.zone_id || 'All'}</td>
                    <td><PeriodStatusBadge status={run.status} /></td>
                    <td className="font-medium">{run.generated_count || run.count || 0}</td>
                    <td className="text-red-600">{run.errors || 0}</td>
                    <td className="text-sm">{formatDate(run.created_at || run.run_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleGenerate}
        title="Confirm Mass Bill Generation"
        message={`This will generate bills for the selected period${selectedRoute ? ' and route' : ''}${selectedZone ? ' and zone' : ''}. Continue?`}
        confirmLabel="Generate"
        loading={massGenerateMutation.isLoading}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  TAB 3 — BILLING PERIODS
// ═══════════════════════════════════════════════════════════════════════════
const PeriodsTab = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', start_date: '', end_date: '', due_date: '' })

  // Fetch periods
  const { data: periodsData, isLoading } = useQuery(
    'billing-periods',
    async () => {
      const res = await api.get('/parameters/financial-periods')
      return res.data
    }
  )

  // Create period
  const createMutation = useMutation(
    async (data) => {
      const res = await api.post('/parameters/financial-periods', data)
      return res.data
    },
    {
      onSuccess: () => {
        toast.success('Period created successfully')
        setShowForm(false)
        setForm({ code: '', name: '', start_date: '', end_date: '', due_date: '' })
        queryClient.invalidateQueries('billing-periods')
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed to create period')
    }
  )

  // Update period (close/reopen)
  const updateMutation = useMutation(
    async (data) => {
      const res = await api.put(`/parameters/financial-periods/${data.id}`, { status: data.status })
      return res.data
    },
    {
      onSuccess: () => {
        toast.success('Period updated')
        queryClient.invalidateQueries('billing-periods')
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed to update period')
    }
  )

  const periods = periodsData?.data || []

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    if (!form.code || !form.name || !form.start_date || !form.end_date || !form.due_date) {
      toast.error('Please fill in all fields')
      return
    }
    createMutation.mutate({
      code: form.code,
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
      due_date: form.due_date,
      status: 'open'
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Billing Periods</h3>
        <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center space-x-2">
          <Plus className="w-4 h-4" /><span>New Period</span>
        </button>
      </div>

      {/* New Period Form */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Billing Period">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Period Code</label>
              <input type="text" className="input w-full" placeholder="e.g. 2026-05" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div>
              <label className="label">Period Name</label>
              <input type="text" className="input w-full" placeholder="e.g. May 2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input w-full" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input w-full" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input w-full" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={createMutation.isLoading} className="btn btn-primary">
              {createMutation.isLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              Create Period
            </button>
          </div>
        </form>
      </Modal>

      {/* Periods Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
        ) : periods.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No billing periods</h3>
            <p className="text-gray-500 mt-1">Create a new period to start billing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="font-medium">{p.code || '-'}</td>
                    <td>{p.period_name || p.name || '-'}</td>
                    <td className="text-sm">{formatDate(p.start_date)}</td>
                    <td className="text-sm">{formatDate(p.end_date)}</td>
                    <td className="text-sm">{formatDate(p.due_date)}</td>
                    <td><PeriodStatusBadge status={p.status} /></td>
                    <td>
                      <div className="flex items-center space-x-2">
                        {p.status === 'open' && (
                          <button
                            onClick={() => { if (confirm('Close this period?')) updateMutation.mutate({ id: p.id, status: 'closed' }) }}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                          >
                            Close
                          </button>
                        )}
                        {p.status === 'closed' && (
                          <button
                            onClick={() => { if (confirm('Reopen this period?')) updateMutation.mutate({ id: p.id, status: 'open' }) }}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50 text-blue-600"
                          >
                            Reopen
                          </button>
                        )}
                        {p.status === 'generating' && (
                          <span className="text-xs text-yellow-600 flex items-center space-x-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /><span>In progress</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  TAB 4 — PENALTY RULES
// ═══════════════════════════════════════════════════════════════════════════
const PenaltyRulesTab = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', grace_days: '', type: 'fixed', rate: '', max_penalty: '' })

  // Fetch penalty rules
  const { data: rulesData, isLoading } = useQuery(
    'penalty-rules-all',
    async () => {
      const res = await api.get('/billing/penalty-rules')
      return res.data
    }
  )

  // Create penalty rule
  const createMutation = useMutation(
    async (data) => {
      const res = await api.post('/billing/penalty-rules', data)
      return res.data
    },
    {
      onSuccess: () => {
        toast.success('Penalty rule created')
        setShowForm(false)
        setForm({ name: '', grace_days: '', type: 'fixed', rate: '', max_penalty: '' })
        queryClient.invalidateQueries('penalty-rules-all')
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed to create rule')
    }
  )

  // Toggle active
  const toggleMutation = useMutation(
    async (data) => {
      const res = await api.put(`/billing/penalty-rules/${data.id}`, { is_active: data.is_active })
      return res.data
    },
    {
      onSuccess: () => {
        toast.success('Rule updated')
        queryClient.invalidateQueries('penalty-rules-all')
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed to update rule')
    }
  )

  const rules = rulesData?.data || []

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.grace_days || !form.rate) {
      toast.error('Please fill in all required fields')
      return
    }
    createMutation.mutate({
      name: form.name,
      grace_days: Number(form.grace_days),
      type: form.type,
      rate: Number(form.rate),
      max_penalty: form.max_penalty ? Number(form.max_penalty) : null,
      is_active: true
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Penalty Rules</h3>
        <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center space-x-2">
          <Plus className="w-4 h-4" /><span>New Rule</span>
        </button>
      </div>

      {/* New Rule Form */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Penalty Rule">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="label">Rule Name *</label>
            <input type="text" className="input w-full" placeholder="e.g. Standard Late Payment" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Grace Days *</label>
              <input type="number" min="0" className="input w-full" placeholder="Days after due date" value={form.grace_days} onChange={(e) => setForm({ ...form, grace_days: e.target.value })} required />
            </div>
            <div>
              <label className="label">Type *</label>
              <select className="input w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="fixed">Fixed Amount</option>
                <option value="percentage">Percentage</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rate / Amount *</label>
              <input type="number" min="0" step="0.01" className="input w-full" placeholder={form.type === 'percentage' ? 'e.g. 5 for 5%' : 'e.g. 500'} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} required />
            </div>
            <div>
              <label className="label">Max Penalty (optional)</label>
              <input type="number" min="0" step="0.01" className="input w-full" placeholder="Maximum penalty cap" value={form.max_penalty} onChange={(e) => setForm({ ...form, max_penalty: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={createMutation.isLoading} className="btn btn-primary">
              {createMutation.isLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              Create Rule
            </button>
          </div>
        </form>
      </Modal>

      {/* Rules Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No penalty rules</h3>
            <p className="text-gray-500 mt-1">Create penalty rules to apply late payment charges.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Grace Days</th>
                  <th>Type</th>
                  <th>Rate</th>
                  <th>Max Penalty</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="font-medium">{rule.name || rule.rule_name || '-'}</td>
                    <td>{rule.grace_days || rule.days_overdue || '-'}</td>
                    <td className="capitalize">{rule.type || 'fixed'}</td>
                    <td className="font-medium">
                      {rule.type === 'percentage' ? `${rule.rate}%` : formatCurrency(rule.rate || rule.penalty_amount)}
                    </td>
                    <td>{rule.max_penalty ? formatCurrency(rule.max_penalty) : '-'}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rule.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {rule.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleMutation.mutate({ id: rule.id, is_active: rule.is_active === false })}
                        className={`text-xs px-2 py-1 border rounded hover:bg-gray-50 ${rule.is_active !== false ? 'text-red-600' : 'text-green-600'}`}
                      >
                        {rule.is_active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
const BillingPage = () => {
  const [activeTab, setActiveTab] = useState('bills')

  const tabs = [
    { id: 'bills', label: 'Bills', icon: FileText },
    { id: 'mass', label: 'Mass Billing', icon: PlayCircle },
    { id: 'periods', label: 'Billing Periods', icon: Calendar },
    { id: 'penalties', label: 'Penalty Rules', icon: AlertTriangle },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing Management</h1>
        <p className="text-gray-500 mt-1">Generate and manage customer bills</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'bills' && <BillsTab />}
      {activeTab === 'mass' && <MassBillingTab />}
      {activeTab === 'periods' && <PeriodsTab />}
      {activeTab === 'penalties' && <PenaltyRulesTab />}
    </div>
  )
}

export default BillingPage
