import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../../api/axios'
import { 
  Calendar, 
  Search, 
  Banknote,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  User,
  FileText,
  Plus,
  TrendingDown
} from 'lucide-react'

const PaymentArrangementsPage = () => {
  const [filters, setFilters] = useState({
    status: ''
  })
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: arrangementsData, isLoading, refetch } = useQuery(
    ['installment-plans', filters, page],
    async () => {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      params.append('page', page.toString())
      params.append('limit', '20')
      
      const response = await api.get(`/payments/installment-plans?${params.toString()}`)
      return response.data
    }
  )

  const createMutation = useMutation(
    async (data) => {
      const response = await api.post('/payments/installment-plans', data)
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['installment-plans'])
        setShowCreateModal(false)
      }
    }
  )

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'defaulted':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const calculateProgress = (paid, total) => {
    if (!total) return 0
    return Math.round((paid / total) * 100)
  }

  const arrangements = arrangementsData?.data || []
  const pagination = arrangementsData?.pagination

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Arrangements</h1>
          <p className="text-gray-500 mt-1">Manage installment payment plans for debt recovery</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center justify-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Arrangement</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: 'Active Plans', 
            value: arrangements.filter(a => a.status === 'active').length, 
            color: 'bg-green-50 border-green-200' 
          },
          { 
            label: 'Completed', 
            value: arrangements.filter(a => a.status === 'completed').length, 
            color: 'bg-blue-50 border-blue-200' 
          },
          { 
            label: 'Defaulted', 
            value: arrangements.filter(a => a.status === 'defaulted').length, 
            color: 'bg-red-50 border-red-200' 
          },
          { 
            label: 'Total Value', 
            value: `KES ${arrangements.reduce((sum, a) => sum + parseFloat(a.total_amount || 0), 0).toLocaleString()}`, 
            color: 'bg-purple-50 border-purple-200' 
          }
        ].map((stat, index) => (
          <div key={index} className={`card ${stat.color}`}>
            <p className="text-sm text-gray-600">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search arrangements..."
              className="input pl-10 w-full"
            />
          </div>
          <select
            className="input w-full sm:w-40"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="defaulted">Defaulted</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button 
            onClick={() => refetch()}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Arrangements List */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading arrangements...</p>
          </div>
        ) : arrangements.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No payment arrangements found</p>
            <p className="text-sm text-gray-400 mt-1">Create a new arrangement to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {arrangements.map((arrangement) => (
              <div key={arrangement.plan_id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Customer Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-900">
                        {arrangement.first_name} {arrangement.last_name}
                      </span>
                      <span className="text-sm text-gray-500">({arrangement.account_number})</span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="flex items-center space-x-1">
                        <Banknote className="w-3 h-3" />
                        <span>KES {parseFloat(arrangement.total_amount).toLocaleString()}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{arrangement.number_of_installments} installments</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span className="capitalize">{arrangement.frequency}</span>
                      </span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="flex-1 max-w-md">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Progress</span>
                      <span className="text-sm font-medium text-gray-900">
                        {arrangement.paid_installments} / {arrangement.number_of_installments} paid
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          arrangement.status === 'active' ? 'bg-green-500' : 
                          arrangement.status === 'completed' ? 'bg-blue-500' : 
                          arrangement.status === 'defaulted' ? 'bg-red-500' : 'bg-gray-500'
                        }`}
                        style={{ width: `${calculateProgress(arrangement.paid_installments, arrangement.number_of_installments)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        KES {parseFloat(arrangement.total_amount - arrangement.remaining_amount).toLocaleString()} paid
                      </span>
                      <span className="text-xs text-gray-500">
                        KES {parseFloat(arrangement.remaining_amount).toLocaleString()} remaining
                      </span>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(arrangement.status)}`}>
                      {arrangement.status}
                    </span>
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      View Details
                    </button>
                  </div>
                </div>

                {/* Installment Schedule Preview */}
                {arrangement.status === 'active' && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Upcoming Installments</h4>
                    <div className="flex space-x-2 overflow-x-auto">
                      {/* This would show actual installment data from API */}
                      <div className="flex-shrink-0 p-2 bg-green-50 rounded text-center min-w-[80px]">
                        <div className="text-xs text-green-600">Paid</div>
                        <div className="text-sm font-medium">Jan</div>
                      </div>
                      <div className="flex-shrink-0 p-2 bg-green-50 rounded text-center min-w-[80px]">
                        <div className="text-xs text-green-600">Paid</div>
                        <div className="text-sm font-medium">Feb</div>
                      </div>
                      <div className="flex-shrink-0 p-2 bg-yellow-50 rounded text-center min-w-[80px]">
                        <div className="text-xs text-yellow-600">Due</div>
                        <div className="text-sm font-medium">Mar</div>
                      </div>
                      <div className="flex-shrink-0 p-2 bg-gray-50 rounded text-center min-w-[80px]">
                        <div className="text-xs text-gray-500">Pending</div>
                        <div className="text-sm font-medium">Apr</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total} arrangements
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Payment Arrangement</h3>
            <form className="space-y-4">
              <div>
                <label className="label">Customer</label>
                <input type="text" className="input w-full" placeholder="Search customer..." />
              </div>
              <div>
                <label className="label">Total Amount</label>
                <input type="number" step="0.01" className="input w-full" placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Number of Installments</label>
                  <input type="number" className="input w-full" placeholder="6" />
                </div>
                <div>
                  <label className="label">Frequency</label>
                  <select className="input w-full">
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Start Date</label>
                <input type="date" className="input w-full" />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                >
                  Create Arrangement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentArrangementsPage
