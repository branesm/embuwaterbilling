import { useEffect, useState } from 'react'
import { portalApi } from '@/lib/portalApi'
import { Receipt, CheckCircle, Clock, AlertTriangle, Loader2, Download } from 'lucide-react'

export default function PortalBillsPage() {
  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBills()
  }, [])

  const loadBills = async () => {
    try {
      const res = await portalApi.get('/bills')
      setBills(res.data.data || [])
    } catch (error) {
      console.error('Load bills error:', error)
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

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'partial': return <Clock className="w-4 h-4 text-amber-600" />
      case 'overdue': return <AlertTriangle className="w-4 h-4 text-red-600" />
      default: return <Receipt className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'bg-green-50 text-green-700 border-green-200'
      case 'partial': return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'overdue': return 'bg-red-50 text-red-700 border-red-200'
      default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
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
        <h2 className="text-2xl font-bold text-gray-900">My Bills</h2>
        <p className="text-gray-500">View and track your billing history</p>
      </div>

      {bills.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No bills found</h3>
          <p className="text-sm text-gray-500 mt-1">Your billing history will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Bill No.</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Period</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Bill Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Due Date</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Amount</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Paid</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Balance</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bills.map((bill: any) => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-600">{bill.bill_number}</td>
                    <td className="px-4 py-3 text-gray-700">{bill.period_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(bill.bill_date)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(bill.due_date)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(bill.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(bill.amount_paid)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(bill.balance)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusClass(bill.status)}`}>
                        {getStatusIcon(bill.status)}
                        {bill.status || 'Pending'}
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
