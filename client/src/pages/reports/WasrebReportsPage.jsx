import { useState } from 'react'
import { useQuery } from 'react-query'
import api from '../../api/axios'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Droplets,
  Banknote,
  AlertTriangle,
  Download,
  Calendar,
  Filter,
  FileText,
  Activity
} from 'lucide-react'

const WasrebReportsPage = () => {
  const [selectedReport, setSelectedReport] = useState('impact')
  const [period, setPeriod] = useState({ year: 2024, month: '' })

  const { data: impactData, isLoading: impactLoading } = useQuery(
    ['wasreb-impact', period],
    async () => {
      const params = new URLSearchParams()
      params.append('year', period.year)
      if (period.month) params.append('month', period.month)
      const response = await api.get(`/wasreb/impact-report?${params.toString()}`)
      return response.data
    },
    { enabled: selectedReport === 'impact' }
  )

  const { data: debtData, isLoading: debtLoading } = useQuery(
    ['wasreb-debt'],
    async () => {
      const response = await api.get('/wasreb/debt-aging')
      return response.data
    },
    { enabled: selectedReport === 'debt' }
  )

  const { data: complaintData, isLoading: complaintLoading } = useQuery(
    ['wasreb-complaints', period],
    async () => {
      const params = new URLSearchParams()
      params.append('year', period.year)
      if (period.month) params.append('month', period.month)
      const response = await api.get(`/wasreb/complaint-report?${params.toString()}`)
      return response.data
    },
    { enabled: selectedReport === 'complaints' }
  )

  const { data: zoneData, isLoading: zoneLoading } = useQuery(
    ['wasreb-zones', period],
    async () => {
      const params = new URLSearchParams()
      params.append('year', period.year)
      const response = await api.get(`/wasreb/zone-performance?${params.toString()}`)
      return response.data
    },
    { enabled: selectedReport === 'zones' }
  )

  const reportTypes = [
    { id: 'impact', label: 'Impact Report', icon: BarChart3 },
    { id: 'debt', label: 'Debt Aging', icon: AlertTriangle },
    { id: 'complaints', label: 'Complaints', icon: Activity },
    { id: 'zones', label: 'Zone Performance', icon: MapPin },
  ]

  const formatCurrency = (amount) => {
    return `KES ${parseFloat(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WASREB Reports</h1>
          <p className="text-gray-500 mt-1">Regulatory compliance and management reports</p>
        </div>
        <button className="btn btn-secondary flex items-center space-x-2">
          <Download className="w-4 h-4" />
          <span>Export All</span>
        </button>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={`card flex items-center space-x-3 transition-all ${
              selectedReport === report.id 
                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200' 
                : 'hover:bg-gray-50'
            }`}
          >
            <report.icon className={`w-6 h-6 ${
              selectedReport === report.id ? 'text-blue-600' : 'text-gray-500'
            }`} />
            <span className={`font-medium ${
              selectedReport === report.id ? 'text-blue-900' : 'text-gray-700'
            }`}>
              {report.label}
            </span>
          </button>
        ))}
      </div>

      {/* Period Filter */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Period:</span>
          </div>
          <select
            className="input w-32"
            value={period.year}
            onChange={(e) => setPeriod({ ...period, year: parseInt(e.target.value) })}
          >
            <option value={2024}>2024</option>
            <option value={2023}>2023</option>
          </select>
          <select
            className="input w-40"
            value={period.month}
            onChange={(e) => setPeriod({ ...period, month: e.target.value })}
          >
            <option value="">All Months</option>
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2024, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Impact Report */}
      {selectedReport === 'impact' && impactData && (
        <div className="space-y-6">
          {/* Revenue Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Billed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(impactData.data?.revenue?.total_billed)}
                  </p>
                </div>
                <Banknote className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="card bg-green-50 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Collected</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(impactData.data?.revenue?.total_collected)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="card bg-red-50 border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Outstanding</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(impactData.data?.revenue?.total_outstanding)}
                  </p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <div className="card bg-purple-50 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Collection Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {impactData.data?.billing?.collection_rate || 0}%
                  </p>
                </div>
                <Activity className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Customer & Consumption Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Statistics</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Total Customers</span>
                  <span className="font-semibold text-gray-900">{impactData.data?.customers?.total_customers || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-600">Active Customers</span>
                  <span className="font-semibold text-green-700">{impactData.data?.customers?.active_customers || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span className="text-gray-600">Disconnected</span>
                  <span className="font-semibold text-red-700">{impactData.data?.customers?.disconnected_customers || 0}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <p className="text-xs text-gray-500">Domestic</p>
                    <p className="font-semibold text-blue-700">{impactData.data?.customers?.domestic_customers || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-purple-50 rounded">
                    <p className="text-xs text-gray-500">Commercial</p>
                    <p className="font-semibold text-purple-700">{impactData.data?.customers?.commercial_customers || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded">
                    <p className="text-xs text-gray-500">Industrial</p>
                    <p className="font-semibold text-orange-700">{impactData.data?.customers?.industrial_customers || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Consumption & Billing</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Droplets className="w-5 h-5 text-blue-500" />
                    <span className="text-gray-600">Total Consumption</span>
                  </div>
                  <span className="font-semibold text-blue-700">
                    {parseFloat(impactData.data?.revenue?.total_consumption_m3 || 0).toLocaleString()} m³
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Active Connections</span>
                  <span className="font-semibold text-gray-900">{impactData.data?.revenue?.active_connections || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Average Bill Amount</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(impactData.data?.revenue?.avg_bill_amount)}
                  </span>
                </div>
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Billing Efficiency:</strong> {impactData.data?.billing?.paid_bills || 0} paid out of {impactData.data?.billing?.total_bills || 0} total bills
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debt Aging Report */}
      {selectedReport === 'debt' && debtData && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Debt Aging Analysis</h3>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Aging Bucket</th>
                    <th>Number of Bills</th>
                    <th>Total Amount</th>
                    <th>Customer Count</th>
                    <th>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {debtData.data?.agingBuckets?.map((bucket, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="font-medium">{bucket.aging_bucket}</td>
                      <td>{bucket.bill_count}</td>
                      <td className="font-semibold text-red-600">{formatCurrency(bucket.total_amount)}</td>
                      <td>{bucket.customer_count}</td>
                      <td>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-red-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(100, (bucket.total_amount / (debtData.data?.agingBuckets?.reduce((a, b) => a + parseFloat(b.total_amount), 0) || 1)) * 100)}%` }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 20 Debtors</h3>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Customer Name</th>
                    <th>Unpaid Bills</th>
                    <th>Total Debt</th>
                    <th>Oldest Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {debtData.data?.topDebtors?.map((debtor, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="font-medium">{debtor.account_number}</td>
                      <td>{debtor.customer_name}</td>
                      <td>{debtor.unpaid_bills}</td>
                      <td className="font-semibold text-red-600">{formatCurrency(debtor.total_debt)}</td>
                      <td>{new Date(debtor.oldest_due_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Complaints Report */}
      {selectedReport === 'complaints' && complaintData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card bg-blue-50 border-blue-200">
              <p className="text-sm text-gray-600">Total Complaints</p>
              <p className="text-2xl font-bold text-gray-900">{complaintData.data?.summary?.total_complaints || 0}</p>
            </div>
            <div className="card bg-green-50 border-green-200">
              <p className="text-sm text-gray-600">Resolved</p>
              <p className="text-2xl font-bold text-gray-900">{complaintData.data?.summary?.resolved_complaints || 0}</p>
            </div>
            <div className="card bg-purple-50 border-purple-200">
              <p className="text-sm text-gray-600">Avg Resolution Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(complaintData.data?.summary?.avg_resolution_hours || 0)}h
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">By Category</h3>
              <div className="space-y-3">
                {complaintData.data?.byCategory?.map((cat, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="capitalize text-gray-700">{cat.category.replace('_', ' ')}</span>
                    <div className="flex items-center space-x-4">
                      <span className="font-semibold">{cat.count}</span>
                      <span className="text-sm text-gray-500">
                        {Math.round(cat.avg_resolution_hours || 0)}h avg
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolution Timeline Compliance</h3>
              <div className="space-y-3">
                {complaintData.data?.timelineCompliance?.map((timeline, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">{timeline.timeline}</span>
                    <span className="font-semibold">{timeline.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zone Performance Report */}
      {selectedReport === 'zones' && zoneData && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Zone Performance</h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Total Connections</th>
                  <th>Active Connections</th>
                  <th>Total Consumption</th>
                  <th>Total Billed</th>
                  <th>Total Collected</th>
                  <th>Collection Rate</th>
                </tr>
              </thead>
              <tbody>
                {zoneData.data?.map((zone, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="font-medium">{zone.zone_name}</td>
                    <td>{zone.total_connections}</td>
                    <td>{zone.active_connections}</td>
                    <td>{parseFloat(zone.total_consumption || 0).toLocaleString()} m³</td>
                    <td>{formatCurrency(zone.total_billed)}</td>
                    <td>{formatCurrency(zone.total_collected)}</td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${(zone.collection_rate || 0) >= 80 ? 'bg-green-500' : (zone.collection_rate || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, zone.collection_rate || 0)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{zone.collection_rate || 0}%</span>
                      </div>
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

export default WasrebReportsPage
