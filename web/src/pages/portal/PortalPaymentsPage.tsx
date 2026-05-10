import { useEffect, useState } from 'react'
import { portalApi } from '@/lib/portalApi'
import { CreditCard, CheckCircle, Loader2 } from 'lucide-react'

export default function PortalPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    try {
      const res = await portalApi.get('/payments')
      setPayments(res.data.data || [])
    } catch (error) {
      console.error('Load payments error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `KES ${(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">My Payments</h2>
        <p className="text-gray-500">View your payment history and receipts</p>
      </div>

      {payments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No payments found</h3>
          <p className="text-sm text-gray-500 mt-1">Your payment history will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Receipt No.</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Mode</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Reference</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Amount</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-600">{p.receipt_no}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(p.payment_date)}</td>
                    <td className="px-4 py-3 text-gray-700">{p.payment_mode || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.reference || '-'}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle className="w-3 h-3" />
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
