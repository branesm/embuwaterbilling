import { useState, useMemo } from 'react'
import { useMutation, useQuery } from 'react-query'
import api from '../../api/axios'
import {
  Phone, Banknote, CreditCard, RefreshCw, CheckCircle, AlertCircle,
  Eye, RotateCcw, Calendar, Upload, X, FileText, BarChart3,
  Download, AlertTriangle, Table
} from 'lucide-react'
import toast from 'react-hot-toast'

const PaymentPage = () => {
  const [activeTab, setActiveTab] = useState('stkpush')
  const [stkForm, setStkForm] = useState({
    phoneNumber: '',
    amount: '',
    accountReference: '',
    description: 'Water Bill Payment'
  })
  const [cashForm, setCashForm] = useState({
    customerId: '',
    amount: '',
    referenceNumber: '',
    notes: ''
  })

  // Payment Detail Modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedPaymentId, setSelectedPaymentId] = useState(null)

  // Reverse Payment Modal state
  const [reverseModalOpen, setReverseModalOpen] = useState(false)
  const [reversePaymentId, setReversePaymentId] = useState(null)
  const [reverseReason, setReverseReason] = useState('')

  // Daily Summary state
  const [summaryDate, setSummaryDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  // Bulk Import state
  const [bulkInput, setBulkInput] = useState('')
  const [bulkPreview, setBulkPreview] = useState([])
  const [bulkResults, setBulkResults] = useState(null)

  // --- Existing Queries ---

  const { data: mpesaTransactions, refetch: refetchTransactions } = useQuery(
    ['mpesa-transactions'],
    async () => {
      const response = await api.get('/mpesa/transactions')
      return response.data.data
    }
  )

  // --- New Queries ---

  // Payments list
  const { data: paymentsList, refetch: refetchPayments } = useQuery(
    ['payments-list'],
    async () => {
      const response = await api.get('/payments')
      return response.data.data || response.data
    }
  )

  // Payment detail (enabled only when modal is open)
  const { data: paymentDetail, isLoading: detailLoading } = useQuery(
    ['payment-detail', selectedPaymentId],
    async () => {
      const response = await api.get(`/payments/${selectedPaymentId}`)
      return response.data.data || response.data
    },
    { enabled: !!selectedPaymentId && detailModalOpen }
  )

  // Daily summary
  const { data: dailySummary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery(
    ['daily-summary', summaryDate],
    async () => {
      const response = await api.get(`/payments/daily-summary?date=${summaryDate}`)
      return response.data.data || response.data
    },
    { enabled: activeTab === 'daily-summary' }
  )

  // Payment methods
  const { data: paymentMethods } = useQuery(
    ['payment-methods'],
    async () => {
      const response = await api.get('/payments/methods')
      return response.data.data || response.data
    }
  )

  // --- Existing Mutations ---

  const stkPushMutation = useMutation(
    async (data) => {
      const response = await api.post('/mpesa/stkpush', data)
      return response.data
    },
    {
      onSuccess: (data) => {
        toast.success(data.message || 'STK Push sent successfully!')
        setStkForm({ phoneNumber: '', amount: '', accountReference: '', description: 'Water Bill Payment' })
        refetchTransactions()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to send STK Push')
      }
    }
  )

  const cashPaymentMutation = useMutation(
    async (data) => {
      const response = await api.post('/payments', data)
      return response.data
    },
    {
      onSuccess: () => {
        toast.success('Payment recorded successfully!')
        setCashForm({ customerId: '', amount: '', referenceNumber: '', notes: '' })
        refetchPayments()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to record payment')
      }
    }
  )

  // --- New Mutations ---

  // Reverse payment
  const reversePaymentMutation = useMutation(
    async ({ id, reason }) => {
      const response = await api.post(`/payments/${id}/reverse`, { reason })
      return response.data
    },
    {
      onSuccess: () => {
        toast.success('Payment reversed successfully!')
        setReverseModalOpen(false)
        setReversePaymentId(null)
        setReverseReason('')
        refetchPayments()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to reverse payment')
      }
    }
  )

  // Bulk import
  const bulkImportMutation = useMutation(
    async (payments) => {
      const response = await api.post('/payments/bulk-import', { payments })
      return response.data
    },
    {
      onSuccess: (data) => {
        toast.success(`Import complete: ${data.imported || 0} imported, ${data.errors?.length || 0} errors`)
        setBulkResults(data)
        setBulkPreview([])
        setBulkInput('')
        refetchPayments()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Bulk import failed')
      }
    }
  )

  // --- Existing Handlers ---

  const handleStkSubmit = (e) => {
    e.preventDefault()
    if (!stkForm.phoneNumber || !stkForm.amount || !stkForm.accountReference) {
      toast.error('Please fill in all required fields')
      return
    }
    stkPushMutation.mutate(stkForm)
  }

  const handleCashSubmit = (e) => {
    e.preventDefault()
    if (!cashForm.customerId || !cashForm.amount) {
      toast.error('Please fill in all required fields')
      return
    }
    cashPaymentMutation.mutate(cashForm)
  }

  // --- New Handlers ---

  const handleViewPayment = (paymentId) => {
    setSelectedPaymentId(paymentId)
    setDetailModalOpen(true)
  }

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false)
    setSelectedPaymentId(null)
  }

  const handleOpenReverseModal = (paymentId) => {
    setReversePaymentId(paymentId)
    setReverseReason('')
    setReverseModalOpen(true)
  }

  const handleCloseReverseModal = () => {
    setReverseModalOpen(false)
    setReversePaymentId(null)
    setReverseReason('')
  }

  const handleReversePayment = () => {
    if (!reverseReason.trim()) {
      toast.error('Please provide a reason for reversing the payment')
      return
    }
    reversePaymentMutation.mutate({ id: reversePaymentId, reason: reverseReason })
  }

  const handleParseBulkInput = () => {
    if (!bulkInput.trim()) {
      toast.error('Please paste data to import')
      return
    }
    try {
      // Try JSON parse first
      const parsed = JSON.parse(bulkInput)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      setBulkPreview(items.map((item, idx) => ({
        id: idx,
        customerId: item.customerId || item.customer_id || '',
        amount: item.amount || '',
        paymentMethod: item.paymentMethod || item.payment_method || 'Cash',
        paymentDate: item.paymentDate || item.payment_date || new Date().toISOString().split('T')[0],
        referenceNumber: item.referenceNumber || item.reference_number || ''
      })))
      toast.success(`Parsed ${items.length} record(s)`)
    } catch {
      // Try CSV parse: customerId, amount, paymentMethod, paymentDate, referenceNumber
      const lines = bulkInput.trim().split('\n').filter(l => l.trim())
      const dataLines = lines[0]?.toLowerCase().includes('customer') ? lines.slice(1) : lines
      const parsed = dataLines.map((line, idx) => {
        const parts = line.split(',').map(s => s.trim())
        return {
          id: idx,
          customerId: parts[0] || '',
          amount: parts[1] || '',
          paymentMethod: parts[2] || 'Cash',
          paymentDate: parts[3] || new Date().toISOString().split('T')[0],
          referenceNumber: parts[4] || ''
        }
      })
      setBulkPreview(parsed)
      toast.success(`Parsed ${parsed.length} record(s)`)
    }
  }

  const handleBulkImport = () => {
    if (bulkPreview.length === 0) {
      toast.error('No data to import. Parse your data first.')
      return
    }
    bulkImportMutation.mutate(bulkPreview)
  }

  const handleBulkFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setBulkInput(event.target.result)
    }
    reader.readAsText(file)
  }

  // --- Helpers ---

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'reversed': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount) => {
    if (!amount) return 'Ksh 0'
    return `Ksh ${Number(amount).toLocaleString()}`
  }

  // Grand totals for daily summary
  const summaryGrandTotals = useMemo(() => {
    if (!dailySummary?.length) return { count: 0, total: 0 }
    return dailySummary.reduce(
      (acc, row) => ({
        count: acc.count + (Number(row.transaction_count) || 0),
        total: acc.total + (Number(row.total_amount) || 0)
      }),
      { count: 0, total: 0 }
    )
  }, [dailySummary])

  // Tab definitions
  const tabs = [
    { id: 'stkpush', label: 'M-Pesa STK Push', icon: Phone },
    { id: 'cash', label: 'Cash Payment', icon: Banknote },
    { id: 'transactions', label: 'M-Pesa Transactions', icon: CreditCard },
    { id: 'payments', label: 'Payments List', icon: Table },
    { id: 'daily-summary', label: 'Daily Summary', icon: BarChart3 },
    { id: 'bulk-import', label: 'Bulk Import', icon: FileText }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-500 mt-1">Record payments via M-Pesa STK Push, Cash, or Bank</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* M-Pesa STK Push Form */}
      {activeTab === 'stkpush' && (
        <div className="card max-w-2xl">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-green-100 rounded-lg">
              <Phone className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">M-Pesa STK Push</h2>
              <p className="text-sm text-gray-500">Send payment request to customer&apos;s phone</p>
            </div>
          </div>

          <form onSubmit={handleStkSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Phone Number *</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="254712345678 or 0712345678"
                  value={stkForm.phoneNumber}
                  onChange={(e) => setStkForm({ ...stkForm, phoneNumber: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Format: 254712345678 or 0712345678</p>
              </div>

              <div>
                <label className="label">Amount (KES) *</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Enter amount"
                  value={stkForm.amount}
                  onChange={(e) => setStkForm({ ...stkForm, amount: e.target.value })}
                  required
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="label">Account Reference *</label>
              <input
                type="text"
                className="input"
                placeholder="Customer account number (e.g., EW2400001)"
                value={stkForm.accountReference}
                onChange={(e) => setStkForm({ ...stkForm, accountReference: e.target.value })}
                required
                maxLength="12"
              />
              <p className="text-xs text-gray-500 mt-1">Max 12 characters. Used to match payment to customer.</p>
            </div>

            <div>
              <label className="label">Description</label>
              <input
                type="text"
                className="input"
                placeholder="Payment description"
                value={stkForm.description}
                onChange={(e) => setStkForm({ ...stkForm, description: e.target.value })}
                maxLength="13"
              />
              <p className="text-xs text-gray-500 mt-1">Max 13 characters</p>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={stkPushMutation.isPending}
                className="btn btn-primary w-full md:w-auto flex items-center justify-center space-x-2"
              >
                {stkPushMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending STK Push...</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4" />
                    <span>Send STK Push</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Sandbox Test Credentials</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Test Phone: <strong>254708374149</strong></li>
              <li>• Test PIN: Any 4 digits</li>
              <li>• Shortcode: <strong>174379</strong></li>
            </ul>
          </div>
        </div>
      )}

      {/* Cash Payment Form */}
      {activeTab === 'cash' && (
        <div className="card max-w-2xl">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Banknote className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Cash Payment</h2>
              <p className="text-sm text-gray-500">Record a cash or bank payment</p>
            </div>
          </div>

          <form onSubmit={handleCashSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Customer ID *</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Enter customer ID"
                  value={cashForm.customerId}
                  onChange={(e) => setCashForm({ ...cashForm, customerId: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Amount (KES) *</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Enter amount"
                  value={cashForm.amount}
                  onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                  required
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="label">Reference Number</label>
              <input
                type="text"
                className="input"
                placeholder="Receipt or transaction number"
                value={cashForm.referenceNumber}
                onChange={(e) => setCashForm({ ...cashForm, referenceNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                className="input"
                rows="3"
                placeholder="Additional notes..."
                value={cashForm.notes}
                onChange={(e) => setCashForm({ ...cashForm, notes: e.target.value })}
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={cashPaymentMutation.isPending}
                className="btn btn-primary w-full md:w-auto flex items-center justify-center space-x-2"
              >
                {cashPaymentMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Record Payment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* M-Pesa Transactions */}
      {activeTab === 'transactions' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">M-Pesa Transactions</h2>
                <p className="text-sm text-gray-500">View STK Push and payment history</p>
              </div>
            </div>
            <button
              onClick={() => refetchTransactions()}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>

          {mpesaTransactions?.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No M-Pesa transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Phone</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {mpesaTransactions?.map((tx) => (
                    <tr key={tx.id}>
                      <td className="font-medium">{tx.transaction_type}</td>
                      <td>{tx.msisdn}</td>
                      <td>Ksh {tx.trans_amount}</td>
                      <td>{tx.bill_ref_number || tx.checkout_request_id?.slice(-8) || '-'}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payments List */}
      {activeTab === 'payments' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Table className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">All Payments</h2>
                <p className="text-sm text-gray-500">View, search and manage payments</p>
              </div>
            </div>
            <button
              onClick={() => refetchPayments()}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>

          {!paymentsList?.length ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No payments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsList.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.payment_number || p.id}</td>
                      <td>{p.customer_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.customer_id || '-'}</td>
                      <td>{formatCurrency(p.amount)}</td>
                      <td>{p.payment_method || p.method || '-'}</td>
                      <td>{p.reference_number || p.reference || '-'}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '-'}</td>
                      <td>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewPayment(p.id)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {p.status !== 'reversed' && (
                            <button
                              onClick={() => handleOpenReverseModal(p.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Reverse payment"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
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
      )}

      {/* Daily Summary */}
      {activeTab === 'daily-summary' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Daily Collections Summary</h2>
                <p className="text-sm text-gray-500">View daily collections by method and cashier</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  className="input"
                  value={summaryDate}
                  onChange={(e) => setSummaryDate(e.target.value)}
                />
              </div>
              <button
                onClick={() => refetchSummary()}
                className="btn btn-secondary flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {summaryLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : !dailySummary?.length ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No collections found for {summaryDate}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Payment Method</th>
                    <th>Cashier</th>
                    <th>Transaction Count</th>
                    <th>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummary.map((row, idx) => (
                    <tr key={idx}>
                      <td className="font-medium">{row.payment_method || row.method || '-'}</td>
                      <td>{row.cashier || row.cashier_name || '-'}</td>
                      <td>{row.transaction_count || row.count || 0}</td>
                      <td>{formatCurrency(row.total_amount || row.amount)}</td>
                    </tr>
                  ))}
                  {/* Grand totals row */}
                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                    <td colSpan="2">Grand Total</td>
                    <td>{summaryGrandTotals.count}</td>
                    <td>{formatCurrency(summaryGrandTotals.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bulk Import */}
      {activeTab === 'bulk-import' && (
        <div className="card">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-teal-100 rounded-lg">
              <FileText className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bulk Payment Import</h2>
              <p className="text-sm text-gray-500">Import multiple payments at once from CSV or JSON</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Input Section */}
            <div>
              <label className="label">Paste CSV or JSON Data</label>
              <p className="text-xs text-gray-500 mb-2">
                CSV format: <code className="bg-gray-100 px-1 rounded">customerId, amount, paymentMethod, paymentDate, referenceNumber</code> (one per line, header optional)
              </p>
              <p className="text-xs text-gray-500 mb-2">
                JSON format: Array of objects with keys: <code className="bg-gray-100 px-1 rounded">customerId, amount, paymentMethod, paymentDate, referenceNumber</code>
              </p>
              <textarea
                className="input font-mono text-sm"
                rows="8"
                placeholder={`CSV example:\n1, 500, Cash, 2026-05-04, REF001\n2, 1200, M-Pesa, 2026-05-04, REF002\n\nJSON example:\n[{"customerId": 1, "amount": 500, "paymentMethod": "Cash", "paymentDate": "2026-05-04", "referenceNumber": "REF001"}]`}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="label">Or Upload a File</label>
              <div className="flex items-center space-x-3">
                <input
                  type="file"
                  accept=".csv,.json,.txt"
                  onChange={handleBulkFileUpload}
                  className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                />
                <Upload className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleParseBulkInput}
                className="btn btn-secondary flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Parse & Preview</span>
              </button>
              {bulkPreview.length > 0 && (
                <button
                  onClick={handleBulkImport}
                  disabled={bulkImportMutation.isPending}
                  className="btn btn-primary flex items-center space-x-2"
                >
                  {bulkImportMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Import {bulkPreview.length} Payment(s)</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Preview Table */}
            {bulkPreview.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview ({bulkPreview.length} records)</h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded-lg">
                  <table className="table">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th>#</th>
                        <th>Customer ID</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Date</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id + 1}</td>
                          <td>{row.customerId}</td>
                          <td>{formatCurrency(row.amount)}</td>
                          <td>{row.paymentMethod}</td>
                          <td>{row.paymentDate}</td>
                          <td>{row.referenceNumber || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import Results */}
            {bulkResults && (
              <div className={`p-4 rounded-lg ${bulkResults.errors?.length > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                <h3 className="text-sm font-semibold mb-2">Import Results</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-green-700">
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Successfully imported: <strong>{bulkResults.imported ?? bulkResults.success ?? 0}</strong>
                  </p>
                  {bulkResults.errors?.length > 0 && (
                    <div>
                      <p className="text-red-700 font-medium">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        Errors: {bulkResults.errors.length}
                      </p>
                      <ul className="mt-1 text-red-600 text-xs space-y-1 max-h-32 overflow-y-auto">
                        {bulkResults.errors.map((err, idx) => (
                          <li key={idx}>Row {err.row ?? idx + 1}: {err.message || err.error || JSON.stringify(err)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Detail Modal */}
      {detailModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Payment Details</h2>
              <button onClick={handleCloseDetailModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : paymentDetail ? (
              <div className="p-6 space-y-6">
                {/* Payment Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Payment Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Payment Number</p>
                      <p className="font-medium">{paymentDetail.payment_number || paymentDetail.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Date</p>
                      <p className="font-medium">
                        {paymentDetail.payment_date
                          ? new Date(paymentDetail.payment_date).toLocaleDateString()
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Amount</p>
                      <p className="font-semibold text-lg text-green-700">{formatCurrency(paymentDetail.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(paymentDetail.status)}`}>
                        {paymentDetail.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Payment Method</p>
                      <p className="font-medium">{paymentDetail.payment_method || paymentDetail.method || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Reference</p>
                      <p className="font-medium">{paymentDetail.reference_number || paymentDetail.reference || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Customer Name</p>
                      <p className="font-medium">
                        {paymentDetail.customer_name || `${paymentDetail.first_name || ''} ${paymentDetail.last_name || ''}`.trim() || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Account Number</p>
                      <p className="font-medium">{paymentDetail.account_number || paymentDetail.customer_id || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Allocations Table */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Bill Allocations ({paymentDetail.allocations?.length || 0})
                  </h3>
                  {paymentDetail.allocations?.length > 0 ? (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="table">
                        <thead className="bg-gray-50">
                          <tr>
                            <th>Bill Number</th>
                            <th>Period</th>
                            <th>Amount Allocated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentDetail.allocations.map((alloc, idx) => (
                            <tr key={idx}>
                              <td className="font-medium">{alloc.bill_number || alloc.bill_id || '-'}</td>
                              <td>{alloc.period || alloc.billing_period || '-'}</td>
                              <td>{formatCurrency(alloc.amount || alloc.allocated_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No allocations found for this payment.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">No payment details found.</div>
            )}

            <div className="p-6 border-t flex justify-end">
              <button onClick={handleCloseDetailModal} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Payment Modal */}
      {reverseModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-semibold text-gray-900">Reverse Payment</h2>
              </div>
              <button onClick={handleCloseReverseModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to reverse this payment? This action will undo the payment allocation and mark it as reversed.
              </p>
              <div>
                <label className="label">Reason for reversal *</label>
                <textarea
                  className="input"
                  rows="3"
                  placeholder="Provide a reason for reversing this payment..."
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                />
              </div>
            </div>

            <div className="p-6 border-t flex items-center justify-end space-x-3">
              <button onClick={handleCloseReverseModal} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleReversePayment}
                disabled={reversePaymentMutation.isPending || !reverseReason.trim()}
                className="btn bg-red-600 hover:bg-red-700 text-white flex items-center space-x-2"
              >
                {reversePaymentMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Reversing...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Reverse Payment</span>
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

export default PaymentPage
