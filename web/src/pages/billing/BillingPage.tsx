import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { FileText, Search, XCircle, Printer, AlertTriangle, Zap, Eye } from 'lucide-react'

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState('bills')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBill, setSelectedBill] = useState<any>(null)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showReprintModal, setShowReprintModal] = useState(false)
  const [showBillDetail, setShowBillDetail] = useState(false)
  const queryClient = useQueryClient()

  const [massForm, setMassForm] = useState({ billing_period_id: '', bill_date: new Date().toISOString().split('T')[0], due_date: '' })
  const [adjustForm, setAdjustForm] = useState({ adjustment_type: 'reduction', new_amount: '', reason: '' })
  const [reprintReason, setReprintReason] = useState('')

  const { data: billsData, isLoading } = useQuery({
    queryKey: ['bills', statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      params.append('limit', '50')
      const res = await api.get(`/billing?${params.toString()}`)
      return res.data
    },
  })

  const { data: periodsData } = useQuery({
    queryKey: ['financial-periods'],
    queryFn: async () => {
      const res = await api.get('/parameters/financial-periods')
      return res.data
    },
  })

  const bills = (billsData?.data || []).filter((b: any) =>
    !searchQuery ||
    b.bill_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.account_no?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const massBillingMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/billing/mass-generate', data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      setMassForm({ billing_period_id: '', bill_date: new Date().toISOString().split('T')[0], due_date: '' })
      alert('Bills generated successfully')
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Failed to generate bills'),
  })

  const adjustMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await api.post(`/billing/${id}/adjust`, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      setShowAdjustModal(false)
      setSelectedBill(null)
      setAdjustForm({ adjustment_type: 'reduction', new_amount: '', reason: '' })
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Failed to adjust bill'),
  })

  const reprintMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await api.post(`/billing/${id}/reprint`, { reason })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      setShowReprintModal(false)
      setSelectedBill(null)
      setReprintReason('')
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Failed to reprint bill'),
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/billing/${id}/cancel`, { reason: 'Cancelled by user' })
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bills'] }),
  })

  const handleMassGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!massForm.billing_period_id || !massForm.bill_date || !massForm.due_date) {
      alert('Please fill all fields')
      return
    }
    massBillingMutation.mutate(massForm)
  }

  const handleAdjust = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBill || !adjustForm.new_amount || !adjustForm.reason) return
    adjustMutation.mutate({ id: selectedBill.id, data: adjustForm })
  }

  const handleReprint = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBill || !reprintReason) return
    reprintMutation.mutate({ id: selectedBill.id, reason: reprintReason })
  }

  const openBillDetail = async (bill: any) => {
    const res = await api.get(`/billing/${bill.id}`)
    setSelectedBill(res.data.data)
    setShowBillDetail(true)
  }

  const tabs = [
    { id: 'bills', label: 'Bills', icon: FileText },
    { id: 'mass', label: 'Mass Billing', icon: Zap },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-gray-500">Manage bills, generate invoices, and adjustments</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {activeTab === 'bills' && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by bill no, customer name, account..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Status</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-gray-500">Loading bills...</div>
              ) : bills.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No bills found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Bill No</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Customer</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Amount</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Balance</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bills.map((bill: any) => (
                        <tr key={bill.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-sky-600">{bill.bill_no}</td>
                          <td className="px-4 py-3 text-gray-600">{bill.customer_name}</td>
                          <td className="px-4 py-3">{formatDate(bill.bill_date)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(bill.total_amount)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(bill.balance)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              bill.status === 'paid' ? 'bg-green-100 text-green-700' :
                              bill.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                              bill.is_cancelled ? 'bg-gray-100 text-gray-700' :
                              'bg-red-100 text-red-700'
                            }`}>{bill.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => openBillDetail(bill)} title="View" className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {!bill.is_cancelled && bill.status !== 'paid' && (
                                <>
                                  <button
                                    onClick={() => { setSelectedBill(bill); setShowAdjustModal(true) }}
                                    title="Adjust"
                                    className="p-1.5 hover:bg-amber-50 rounded text-amber-600"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => { setSelectedBill(bill); setShowReprintModal(true) }}
                                    title="Reprint"
                                    className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => { if (confirm('Cancel this bill?')) cancelMutation.mutate(bill.id) }}
                                    title="Cancel"
                                    className="p-1.5 hover:bg-red-50 rounded text-red-600"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </>
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

          {activeTab === 'mass' && (
            <form onSubmit={handleMassGenerate} className="max-w-xl space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-sky-600" />
                Mass Bill Generation
              </h3>
              <p className="text-sm text-gray-500">Generate bills for all unbilled meter readings in a billing period.</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Period</label>
                <select
                  value={massForm.billing_period_id}
                  onChange={(e) => setMassForm({ ...massForm, billing_period_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                >
                  <option value="">Select period...</option>
                  {(periodsData?.data || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.period_name} ({formatDate(p.start_date)} - {formatDate(p.end_date)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bill Date</label>
                  <input
                    type="date"
                    value={massForm.bill_date}
                    onChange={(e) => setMassForm({ ...massForm, bill_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={massForm.due_date}
                    onChange={(e) => setMassForm({ ...massForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={massBillingMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 text-sm"
              >
                <Zap className="w-4 h-4" />
                {massBillingMutation.isPending ? 'Generating...' : 'Generate Bills'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bill Detail Modal */}
      {showBillDetail && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Bill Details</h2>
              <button onClick={() => { setShowBillDetail(false); setSelectedBill(null) }} className="p-2 hover:bg-gray-100 rounded">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-gray-500">Bill No:</span> <span className="font-medium">{selectedBill.bill_no}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(selectedBill.bill_date)}</span></div>
                <div><span className="text-gray-500">Customer:</span> <span className="font-medium">{selectedBill.customer_name}</span></div>
                <div><span className="text-gray-500">Account:</span> <span className="font-medium">{selectedBill.account_no}</span></div>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">Charges</h4>
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Water Charge</span><span>{formatCurrency(selectedBill.water_charge)}</span></div>
                  <div className="flex justify-between"><span>Sewer Charge</span><span>{formatCurrency(selectedBill.sewer_charge)}</span></div>
                  <div className="flex justify-between"><span>Fixed Charge</span><span>{formatCurrency(selectedBill.fixed_charge)}</span></div>
                  <div className="flex justify-between"><span>Rent Charge</span><span>{formatCurrency(selectedBill.rent_charge)}</span></div>
                  <div className="flex justify-between"><span>Misc Charge</span><span>{formatCurrency(selectedBill.misc_charge)}</span></div>
                  {selectedBill.penalty_amount > 0 && <div className="flex justify-between text-red-600"><span>Penalty</span><span>{formatCurrency(selectedBill.penalty_amount)}</span></div>}
                  {selectedBill.interest_amount > 0 && <div className="flex justify-between text-red-600"><span>Interest</span><span>{formatCurrency(selectedBill.interest_amount)}</span></div>}
                  <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span>{formatCurrency(selectedBill.total_amount)}</span></div>
                  <div className="flex justify-between font-semibold text-amber-600"><span>Balance</span><span>{formatCurrency(selectedBill.balance)}</span></div>
                </div>
              </div>
              {selectedBill.adjustments?.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Adjustments</h4>
                  <div className="space-y-2">
                    {selectedBill.adjustments.map((a: any, i: number) => (
                      <div key={i} className="bg-gray-50 p-2 rounded text-xs">
                        <span className="capitalize font-medium">{a.adjustment_type}</span> — {formatCurrency(a.difference)} — {a.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedBill.reprints?.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Reprint History</h4>
                  <div className="space-y-1 text-xs text-gray-500">
                    {selectedBill.reprints.map((r: any, i: number) => (
                      <div key={i}>Reprinted on {formatDate(r.printed_at)}{r.reprint_reason ? ` — ${r.reprint_reason}` : ''}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjustModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Adjust Bill {selectedBill.bill_no}</h2>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Amount</label>
                <input type="text" value={formatCurrency(selectedBill.total_amount)} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type</label>
                <select
                  value={adjustForm.adjustment_type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, adjustment_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="reduction">Reduction</option>
                  <option value="increase">Increase</option>
                  <option value="correction">Correction</option>
                  <option value="waiver">Waiver</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustForm.new_amount}
                  onChange={(e) => setAdjustForm({ ...adjustForm, new_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={2}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdjustModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={adjustMutation.isPending} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm">
                  {adjustMutation.isPending ? 'Adjusting...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reprint Modal */}
      {showReprintModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Reprint Bill {selectedBill.bill_no}</h2>
            <form onSubmit={handleReprint} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reprint Reason</label>
                <textarea
                  value={reprintReason}
                  onChange={(e) => setReprintReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={2}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowReprintModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={reprintMutation.isPending} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm">
                  <Printer className="w-3.5 h-3.5 inline mr-1" />
                  {reprintMutation.isPending ? 'Reprinting...' : 'Confirm Reprint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
