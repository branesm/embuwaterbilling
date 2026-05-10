import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CreditCard, Search, Plus, XCircle, Eye, Calendar, List, ClipboardList, CheckCircle } from 'lucide-react'

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState('payments')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [showAllocations, setShowAllocations] = useState(false)
  const queryClient = useQueryClient()

  const [paymentForm, setPaymentForm] = useState({
    customer_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], payment_mode_id: '', reference: '', notes: '',
  })

  const [planForm, setPlanForm] = useState({
    customer_id: '', total_amount: '', down_payment: '', installment_amount: '', num_installments: '', frequency: 'monthly', start_date: '', end_date: '',
  })

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await api.get('/payments?limit=50')
      return res.data
    },
  })

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['payment-plans'],
    queryFn: async () => {
      const res = await api.get('/payments/payment-plans?limit=50')
      return res.data
    },
  })

  const { data: modesData } = useQuery({
    queryKey: ['payment-modes'],
    queryFn: async () => {
      const res = await api.get('/parameters/payment-modes')
      return res.data
    },
  })

  const payments = (paymentsData?.data || []).filter((p: any) =>
    !searchQuery ||
    p.receipt_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/payments', data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      setShowPaymentModal(false)
      setPaymentForm({ customer_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], payment_mode_id: '', reference: '', notes: '' })
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Failed to post payment'),
  })

  const planMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/payments/payment-plans', data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-plans'] })
      setShowPlanModal(false)
      setPlanForm({ customer_id: '', total_amount: '', down_payment: '', installment_amount: '', num_installments: '', frequency: 'monthly', start_date: '', end_date: '' })
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Failed to create plan'),
  })

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await api.post(`/payments/${id}/cancel`, { reason })
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  })

  const handlePostPayment = (e: React.FormEvent) => {
    e.preventDefault()
    paymentMutation.mutate({ ...paymentForm, amount: parseFloat(paymentForm.amount) })
  }

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault()
    planMutation.mutate({
      ...planForm,
      total_amount: parseFloat(planForm.total_amount),
      down_payment: parseFloat(planForm.down_payment || '0'),
      installment_amount: parseFloat(planForm.installment_amount),
      num_installments: parseInt(planForm.num_installments),
    })
  }

  const viewAllocations = async (payment: any) => {
    const res = await api.get(`/payments/${payment.id}/allocations`)
    setSelectedPayment({ ...payment, allocations: res.data.data })
    setShowAllocations(true)
  }

  const tabs = [
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'plans', label: 'Payment Plans', icon: ClipboardList },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-500">Process payments and manage arrangements</p>
        </div>
        {activeTab === 'payments' && (
          <button onClick={() => setShowPaymentModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm">
            <Plus className="w-4 h-4" /> Post Payment
          </button>
        )}
        {activeTab === 'plans' && (
          <button onClick={() => setShowPlanModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm">
            <Plus className="w-4 h-4" /> New Plan
          </button>
        )}
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
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by receipt no or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {paymentsLoading ? (
                <div className="p-8 text-center text-gray-500">Loading payments...</div>
              ) : payments.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No payments found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Receipt No</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Customer</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Amount</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Mode</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {payments.map((payment: any) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-sky-600">{payment.receipt_no}</td>
                          <td className="px-4 py-3 text-gray-600">{payment.customer_name || '-'}</td>
                          <td className="px-4 py-3">{formatDate(payment.payment_date)}</td>
                          <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(payment.amount)}</td>
                          <td className="px-4 py-3">{payment.payment_mode_name || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => viewAllocations(payment)} title="View Allocations" className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {!payment.is_cancelled && (
                                <button
                                  onClick={() => { const reason = prompt('Enter cancellation reason:'); if (reason) cancelMutation.mutate({ id: payment.id, reason }) }}
                                  className="text-red-600 hover:text-red-800 text-xs flex items-center gap-1 p-1.5 hover:bg-red-50 rounded"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Cancel
                                </button>
                              )}
                              {payment.is_cancelled && <span className="text-xs text-gray-400">Cancelled</span>}
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

          {activeTab === 'plans' && (
            <div className="space-y-4">
              {plansLoading ? (
                <div className="p-8 text-center text-gray-500">Loading payment plans...</div>
              ) : (plansData?.data || []).length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No payment plans found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Plan No</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Customer</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Total</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Installments</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Frequency</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(plansData?.data || []).map((plan: any) => (
                        <tr key={plan.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-sky-600">{plan.plan_no}</td>
                          <td className="px-4 py-3 text-gray-600">{plan.customer_name}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(plan.total_amount)}</td>
                          <td className="px-4 py-3">{plan.num_installments}</td>
                          <td className="px-4 py-3 capitalize">{plan.frequency}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              plan.status === 'completed' ? 'bg-green-100 text-green-700' :
                              plan.status === 'active' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>{plan.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Post Payment</h2>
            <form onSubmit={handlePostPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
                <input type="number" value={paymentForm.customer_id} onChange={(e) => setPaymentForm({ ...paymentForm, customer_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                <select value={paymentForm.payment_mode_id} onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select mode...</option>
                  {(modesData?.data || []).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input type="text" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={paymentMutation.isPending} className="px-4 py-2 bg-sky-600 text-white rounded-lg disabled:opacity-50 text-sm">
                  {paymentMutation.isPending ? 'Processing...' : 'Post Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Payment Plan</h2>
            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
                <input type="number" value={planForm.customer_id} onChange={(e) => setPlanForm({ ...planForm, customer_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                  <input type="number" step="0.01" value={planForm.total_amount} onChange={(e) => setPlanForm({ ...planForm, total_amount: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Down Payment</label>
                  <input type="number" step="0.01" value={planForm.down_payment} onChange={(e) => setPlanForm({ ...planForm, down_payment: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Installment Amount</label>
                  <input type="number" step="0.01" value={planForm.installment_amount} onChange={(e) => setPlanForm({ ...planForm, installment_amount: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No. of Installments</label>
                  <input type="number" value={planForm.num_installments} onChange={(e) => setPlanForm({ ...planForm, num_installments: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select value={planForm.frequency} onChange={(e) => setPlanForm({ ...planForm, frequency: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={planForm.start_date} onChange={(e) => setPlanForm({ ...planForm, start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={planForm.end_date} onChange={(e) => setPlanForm({ ...planForm, end_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowPlanModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={planMutation.isPending} className="px-4 py-2 bg-sky-600 text-white rounded-lg disabled:opacity-50 text-sm">
                  {planMutation.isPending ? 'Creating...' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocations Modal */}
      {showAllocations && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Payment Allocations</h2>
              <button onClick={() => { setShowAllocations(false); setSelectedPayment(null) }} className="p-2 hover:bg-gray-100 rounded">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm mb-4">
              <p><span className="text-gray-500">Receipt:</span> <span className="font-medium">{selectedPayment.receipt_no}</span></p>
              <p><span className="text-gray-500">Amount:</span> <span className="font-medium text-green-600">{formatCurrency(selectedPayment.amount)}</span></p>
            </div>
            {selectedPayment.allocations?.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Bill No</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-700">Allocated</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPayment.allocations.map((a: any) => (
                    <tr key={a.id} className="border-b">
                      <td className="px-3 py-2">{a.bill_no}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(a.amount_allocated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-sm">No allocations found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
