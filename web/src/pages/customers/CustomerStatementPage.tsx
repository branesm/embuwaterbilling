import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, FileText, Printer, Calendar } from 'lucide-react'
import { useState } from 'react'

export default function CustomerStatementPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['customer-statement', id, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (fromDate) params.append('from_date', fromDate)
      if (toDate) params.append('to_date', toDate)
      const res = await api.get(`/customers/${id}/statement?${params.toString()}`)
      return res.data
    },
  })

  const customer = data?.customer
  const transactions = data?.data || []

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/customers/${id}`)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Statement</h1>
          <p className="text-gray-500">{customer?.name || 'Loading...'} — {customer?.account_no}</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 print:hidden"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 print:hidden">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm"
          >
            Generate Statement
          </button>
        </div>
      </div>

      {/* Statement */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center mb-6 print:mb-4">
          <h2 className="text-xl font-bold text-gray-900">EWASCO WATER & SANITATION COMPANY</h2>
          <p className="text-gray-500 text-sm">Customer Account Statement</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm print:mb-4">
          <div>
            <p><span className="font-medium text-gray-700">Account No:</span> {customer?.account_no || '-'}</p>
            <p><span className="font-medium text-gray-700">Customer:</span> {customer?.name || '-'}</p>
            <p><span className="font-medium text-gray-700">Address:</span> {customer?.address || '-'}</p>
          </div>
          <div className="text-right">
            <p><span className="font-medium text-gray-700">Period:</span> {fromDate || 'Start'} to {toDate || 'Now'}</p>
            <p><span className="font-medium text-gray-700">Status:</span> {customer?.account_status || '-'}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading statement...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No transactions found for the selected period</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Date</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Description</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700">Charges</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700">Payments</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: any) => (
                <tr key={tx.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(tx.transaction_date)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 capitalize ${
                      tx.transaction_type === 'opening_balance' ? 'text-gray-600' :
                      tx.transaction_type === 'bill' ? 'text-red-600' :
                      tx.transaction_type === 'payment' ? 'text-green-600' :
                      'text-gray-600'
                    }`}>
                      {tx.transaction_type === 'bill' && <FileText className="w-3 h-3" />}
                      {tx.description}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{tx.bill_amount ? formatCurrency(tx.bill_amount) : '-'}</td>
                  <td className="px-3 py-2 text-right">{tx.payment_amount ? formatCurrency(tx.payment_amount) : '-'}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(tx.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={2}>Closing Balance</td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(transactions.reduce((sum: number, tx: any) => sum + (tx.bill_amount || 0), 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(transactions.reduce((sum: number, tx: any) => sum + (tx.payment_amount || 0), 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(transactions[transactions.length - 1]?.balance || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
