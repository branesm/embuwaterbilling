import { useQuery } from 'react-query'
import { Users, Gauge, CreditCard, ClipboardList, TrendingUp, AlertCircle } from 'lucide-react'
import api from '../../api/axios'

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="card">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
)

const DashboardPage = () => {
  const { data: stats, isLoading } = useQuery('dashboardStats', async () => {
    const response = await api.get('/reports/dashboard')
    return response.data.data
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(value || 0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome to EWASCO Water Billing System</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Customers"
          value={stats?.totalCustomers || 0}
          icon={Users}
          color="bg-blue-500"
          subtitle="Active accounts"
        />
        <StatCard
          title="Active Meters"
          value={stats?.activeMeters || 0}
          icon={Gauge}
          color="bg-green-500"
          subtitle="In service"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(stats?.monthlyRevenue)}
          icon={CreditCard}
          color="bg-purple-500"
          subtitle="This month"
        />
        <StatCard
          title="Outstanding Amount"
          value={formatCurrency(stats?.outstandingAmount)}
          icon={AlertCircle}
          color="bg-red-500"
          subtitle="Unpaid bills"
        />
        <StatCard
          title="Monthly Readings"
          value={stats?.monthlyReadings || 0}
          icon={ClipboardList}
          color="bg-orange-500"
          subtitle="This month"
        />
        <StatCard
          title="Collection Rate"
          value="85%"
          icon={TrendingUp}
          color="bg-teal-500"
          subtitle="Target: 90%"
        />
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/customers/new" className="p-4 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors text-center">
            <Users className="w-6 h-6 text-primary-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-primary-700">Add Customer</span>
          </a>
          <a href="/readings" className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-center">
            <ClipboardList className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-green-700">Enter Reading</span>
          </a>
          <a href="/billing" className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-center">
            <CreditCard className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-purple-700">Generate Bill</span>
          </a>
          <a href="/payments" className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors text-center">
            <CreditCard className="w-6 h-6 text-orange-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-orange-700">Record Payment</span>
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Database Connection</span>
            </div>
            <span className="text-sm font-medium text-green-700">Online</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">API Server</span>
            </div>
            <span className="text-sm font-medium text-green-700">Running</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-sm text-gray-700">M-Pesa Integration</span>
            </div>
            <span className="text-sm font-medium text-yellow-700">Sandbox Mode</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span className="text-sm text-gray-700">SMS Notifications</span>
            </div>
            <span className="text-sm font-medium text-gray-700">Disabled</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
