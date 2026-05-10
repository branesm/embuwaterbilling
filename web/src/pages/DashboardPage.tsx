import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber } from '@/lib/utils'
import {
  Users,
  Gauge,
  FileText,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Droplets,
} from 'lucide-react'

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // In a real app, these would be separate API calls
      const customers = await api.get('/customers/search?limit=1')
      return {
        totalCustomers: 1245,
        activeMeters: 1180,
        unpaidBills: 342,
        todayRevenue: 45600,
        monthlyRevenue: 1280000,
        arrears: 890000,
      }
    },
  })

  const statCards = [
    {
      title: 'Total Customers',
      value: stats?.totalCustomers || 0,
      icon: Users,
      color: 'bg-blue-500',
      format: 'number',
    },
    {
      title: 'Active Meters',
      value: stats?.activeMeters || 0,
      icon: Gauge,
      color: 'bg-emerald-500',
      format: 'number',
    },
    {
      title: 'Unpaid Bills',
      value: stats?.unpaidBills || 0,
      icon: FileText,
      color: 'bg-amber-500',
      format: 'number',
    },
    {
      title: "Today's Revenue",
      value: stats?.todayRevenue || 0,
      icon: CreditCard,
      color: 'bg-sky-500',
      format: 'currency',
    },
    {
      title: 'Monthly Revenue',
      value: stats?.monthlyRevenue || 0,
      icon: TrendingUp,
      color: 'bg-violet-500',
      format: 'currency',
    },
    {
      title: 'Total Arrears',
      value: stats?.arrears || 0,
      icon: AlertTriangle,
      color: 'bg-rose-500',
      format: 'currency',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Overview of EWASCO operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {card.format === 'currency'
                    ? formatCurrency(card.value)
                    : formatNumber(card.value)}
                </p>
              </div>
              <div className={`${card.color} p-2.5 rounded-lg`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'New Customer', icon: Users, path: '/customers/new' },
            { label: 'Post Payment', icon: CreditCard, path: '/payments' },
            { label: 'Generate Bills', icon: FileText, path: '/billing' },
            { label: 'Meter Reading', icon: Droplets, path: '/meters' },
          ].map((action) => (
            <a
              key={action.label}
              href={action.path}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-sky-500 hover:bg-sky-50 transition-colors"
            >
              <action.icon className="w-6 h-6 text-sky-600" />
              <span className="text-sm font-medium text-gray-700">{action.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Payments</h2>
          <div className="text-sm text-gray-500 text-center py-8">
            Payment data will appear here
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Bills</h2>
          <div className="text-sm text-gray-500 text-center py-8">
            Bill data will appear here
          </div>
        </div>
      </div>
    </div>
  )
}
