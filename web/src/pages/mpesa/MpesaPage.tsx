import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Smartphone, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Search, Send } from 'lucide-react'

export default function MpesaPage() {
  const [activeTab, setActiveTab] = useState<'stkpush' | 'transactions'>('transactions')
  const [stkForm, setStkForm] = useState({ phone_number: '', amount: '', account_reference: '', description: '' })
  const [filterStatus, setFilterStatus] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const queryClient = useQueryClient()

  const { data: config } = useQuery({
    queryKey: ['mpesa-config'],
    queryFn: async () => {
      const res = await api.get('/mpesa/config')
      return res.data.data
    },
  })

  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['mpesa-transactions', filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      const res = await api.get(`/mpesa/transactions?${params}`)
      return res.data
    },
  })

  const transactions = transactionsData?.data || []

  const stkPush = useMutation({
    mutationFn: (data: any) => api.post('/mpesa/stkpush', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mpesa-transactions'] })
      setStkForm({ phone_number: '', amount: '', account_reference: '', description: '' })
    },
  })

  const reconcile = useMutation({
    mutationFn: ({ id, customer_id }: { id: number; customer_id: number }) =>
      api.post(`/mpesa/reconcile/${id}`, { customer_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mpesa-transactions'] })
    },
  })

  const filteredTransactions = transactions.filter((tx: any) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      (tx.bill_ref_number || '').toLowerCase().includes(term) ||
      (tx.msisdn || '').toLowerCase().includes(term) ||
      (tx.mpesa_receipt_number || '').toLowerCase().includes(term)
    )
  })

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Completed</span>
      case 'failed':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Failed</span>
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" /> Pending</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">M-Pesa Integration</h1>
          <p className="text-gray-500">STK Push, C2B reconciliation, and transaction management</p>
        </div>
        {config && (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${config.configured ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            <AlertCircle className="w-3.5 h-3.5" />
            {config.configured ? `M-Pesa ${config.environment}` : 'M-Pesa not configured'}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex border-b border-gray-200">
          {[
            { key: 'transactions' as const, label: 'Transactions', icon: RefreshCw },
            { key: 'stkpush' as const, label: 'STK Push', icon: Send },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by account, phone, or receipt..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Account</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Phone</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-700">Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Receipt</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Reconciled</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                    ) : filteredTransactions.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No transactions found</td></tr>
                    ) : (
                      filteredTransactions.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs font-medium">
                              {tx.transaction_type === 'STK_PUSH' ? <Smartphone className="w-3.5 h-3.5 text-sky-600" /> : <RefreshCw className="w-3.5 h-3.5 text-purple-600" />}
                              {tx.transaction_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">{tx.bill_ref_number}</td>
                          <td className="px-4 py-3">{tx.msisdn}</td>
                          <td className="px-4 py-3 text-right">{parseFloat(tx.trans_amount || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{tx.mpesa_receipt_number || '-'}</td>
                          <td className="px-4 py-3">{statusBadge(tx.status)}</td>
                          <td className="px-4 py-3">
                            {tx.is_reconciled ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle className="w-3.5 h-3.5" /> Yes</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-500">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">{new Date(tx.created_at).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'stkpush' && (
            <div className="max-w-xl">
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-1">Initiate STK Push</h3>
                <p className="text-xs text-gray-500 mb-4">Send an M-Pesa payment request to a customer's phone</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    stkPush.mutate({
                      phone_number: stkForm.phone_number,
                      amount: parseFloat(stkForm.amount),
                      account_reference: stkForm.account_reference,
                      description: stkForm.description || 'Water Bill Payment',
                    })
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        required
                        placeholder="254712345678"
                        value={stkForm.phone_number}
                        onChange={(e) => setStkForm({ ...stkForm, phone_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Amount (KES)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={stkForm.amount}
                        onChange={(e) => setStkForm({ ...stkForm, amount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Account Reference</label>
                      <input
                        type="text"
                        required
                        placeholder="Customer account number"
                        value={stkForm.account_reference}
                        onChange={(e) => setStkForm({ ...stkForm, account_reference: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={stkForm.description}
                        onChange={(e) => setStkForm({ ...stkForm, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={stkPush.isPending || !config?.configured}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 text-sm"
                  >
                    <Send className="w-4 h-4" />
                    {stkPush.isPending ? 'Sending...' : 'Send STK Push'}
                  </button>
                  {!config?.configured && (
                    <p className="text-xs text-yellow-600 mt-2">M-Pesa credentials are not configured. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, and MPESA_PASSKEY environment variables.</p>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
