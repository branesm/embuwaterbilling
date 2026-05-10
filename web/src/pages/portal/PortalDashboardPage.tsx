import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortalAuth } from '@/hooks/usePortalAuth'
import { portalApi } from '@/lib/portalApi'
import { Droplets, Receipt, CreditCard, AlertTriangle, TrendingUp, ArrowRight, Loader2 } from 'lucide-react'

export default function PortalDashboardPage() {
  const { customer } = usePortalAuth()
  const [stats, setStats] = useState({
    balance: 0,
    latestBill: null as any,
    totalBills: 0,
    totalPayments: 0,
    loading: true,
  })
  const [consumption, setConsumption] = useState<any[]>([])

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const [billsRes, paymentsRes, consumptionRes] = await Promise.all([
        portalApi.get('/bills?limit=1'),
        portalApi.get('/payments?limit=1'),
        portalApi.get('/consumption?months=6'),
      ])

      const bills = billsRes.data.data || []
      const payments = paymentsRes.data.data || []
      const consumptionData = consumptionRes.data.data || {}

      setStats({
        balance: customer?.balance || 0,
        latestBill: bills[0] || null,
        totalBills: bills.length,
        totalPayments: payments.length,
        loading: false,
      })
      setConsumption(consumptionData.monthly || [])
    } catch (error) {
      console.error('Dashboard load error:', error)
      setStats((s) => ({ ...s, loading: false }))
    }
  }

  const formatCurrency = (amount: number) => {
    return `KES ${(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (stats.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome, {customer?.first_name || customer?.name}</h2>
        <p className="text-gray-500">Account: {customer?.account_no}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Account Balance</p>
              <p className={`text-2xl font-bold mt-1 ${stats.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(stats.balance)}
              </p>
            </div>
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <Droplets className="w-5 h-5 text-primary-600" />
            </div>
          </div>
          {stats.balance > 0 && (
            <div className="mt-3 flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="w-3 h-3" />
              Amount due
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Latest Bill</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">
                {stats.latestBill ? formatCurrency(stats.latestBill.total_amount) : 'No bills'}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          {stats.latestBill && (
            <p className="mt-3 text-xs text-gray-500">Due: {formatDate(stats.latestBill.due_date)}</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Last Payment</p>
              <p className="text-2xl font-bold mt-1 text-green-600">
                {stats.totalPayments > 0 ? 'Paid' : 'None'}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <Link to="/portal/payments" className="mt-3 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
            View history <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg. Consumption</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">
                {consumption.length > 0
                  ? `${Math.round(consumption.reduce((a, b) => a + (b.total_consumption || 0), 0) / consumption.length)} m³`
                  : 'N/A'}
              </p>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">Per month (last 6 months)</p>
        </div>
      </div>

      {/* Consumption Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Consumption Trend</h3>
        {consumption.length > 0 ? (
          <div className="space-y-3">
            {consumption.map((m: any, idx: number) => {
              const maxVal = Math.max(...consumption.map((c: any) => c.total_consumption || 0)) || 1
              const val = m.total_consumption || 0
              const pct = (val / maxVal) * 100
              const monthLabel = new Date(m.month).toLocaleDateString('en-KE', { month: 'short', year: '2-digit' })
              return (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-12 text-right">{monthLabel}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-16">{val.toFixed(1)} m³</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">No consumption data available.</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/portal/bills"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
          >
            <Receipt className="w-4 h-4" />
            View Bills
          </Link>
          <Link
            to="/portal/payments"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Payment History
          </Link>
          <Link
            to="/portal/profile"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            <Droplets className="w-4 h-4" />
            Update Profile
          </Link>
        </div>
      </div>
    </div>
  )
}
