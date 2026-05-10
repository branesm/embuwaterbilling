import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../../api/axios'
import { 
  PowerOff, 
  Power, 
  Search, 
  Filter, 
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  User,
  Calendar,
  Banknote,
  FileText,
  Plus
} from 'lucide-react'

const DisconnectionsPage = () => {
  const [filters, setFilters] = useState({
    isReconnected: '',
    type: ''
  })
  const [page, setPage] = useState(1)
  const [showReconnectModal, setShowReconnectModal] = useState(false)
  const [selectedDisconnection, setSelectedDisconnection] = useState(null)
  const queryClient = useQueryClient()

  const { data: disconnectionsData, isLoading, refetch } = useQuery(
    ['disconnections', filters, page],
    async () => {
      const params = new URLSearchParams()
      if (filters.isReconnected !== '') params.append('isReconnected', filters.isReconnected)
      if (filters.type) params.append('type', filters.type)
      params.append('page', page.toString())
      params.append('limit', '20')
      
      const response = await api.get(`/disconnections?${params.toString()}`)
      return response.data
    }
  )

  const { data: statsData } = useQuery(
    ['disconnections-stats'],
    async () => {
      const response = await api.get('/disconnections/stats/summary')
      return response.data
    }
  )

  const reconnectMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.post(`/disconnections/${id}/reconnect`, data)
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['disconnections'])
        queryClient.invalidateQueries(['disconnections-stats'])
        setShowReconnectModal(false)
        setSelectedDisconnection(null)
      }
    }
  )

  const getTypeColor = (type) => {
    switch (type) {
      case 'non_payment':
        return 'bg-red-100 text-red-800'
      case 'vacant_premises':
        return 'bg-yellow-100 text-yellow-800'
      case 'illegal_connection':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeLabel = (type) => {
    return type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || type
  }

  const handleReconnect = (disconnection) => {
    setSelectedDisconnection(disconnection)
    setShowReconnectModal(true)
  }

  const submitReconnect = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    reconnectMutation.mutate({
      id: selectedDisconnection.disconnection_id,
      data: {
        amountPaid: parseFloat(formData.get('amountPaid')),
        reconnectionDate: formData.get('reconnectionDate')
      }
    })
  }

  const disconnections = disconnectionsData?.data || []
  const pagination = disconnectionsData?.pagination
  const stats = statsData?.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disconnections & Reconnections</h1>
          <p className="text-gray-500 mt-1">Manage service disconnections and reconnections</p>
        </div>
        <button className="btn btn-danger flex items-center justify-center space-x-2">
          <PowerOff className="w-4 h-4" />
          <span>New Disconnection</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Disconnections', value: stats?.overview?.total_disconnections || 0, color: 'bg-red-50 border-red-200' },
          { label: 'Still Disconnected', value: stats?.overview?.still_disconnected || 0, color: 'bg-orange-50 border-orange-200' },
          { label: 'Reconnected', value: stats?.overview?.reconnected || 0, color: 'bg-green-50 border-green-200' },
          { label: 'Avg Days to Reconnect', value: Math.round(stats?.avgReconnectionDays || 0), color: 'bg-blue-50 border-blue-200' }
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
              placeholder="Search disconnections..."
              className="input pl-10 w-full"
            />
          </div>
          <select
            className="input w-full sm:w-40"
            value={filters.isReconnected}
            onChange={(e) => setFilters({ ...filters, isReconnected: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="false">Disconnected</option>
            <option value="true">Reconnected</option>
          </select>
          <select
            className="input w-full sm:w-40"
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="">All Types</option>
            <option value="non_payment">Non-Payment</option>
            <option value="vacant_premises">Vacant Premises</option>
            <option value="illegal_connection">Illegal Connection</option>
            <option value="customer_request">Customer Request</option>
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

      {/* Disconnections List */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading disconnections...</p>
          </div>
        ) : disconnections.length === 0 ? (
          <div className="text-center py-12">
            <PowerOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No disconnection records found</p>
            <p className="text-sm text-gray-400 mt-1">Create a new disconnection to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Outstanding</th>
                  <th>Disconnection Date</th>
                  <th>Status</th>
                  <th>Reconnection</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {disconnections.map((disconnection) => (
                  <tr key={disconnection.disconnection_id} className="hover:bg-gray-50">
                    <td className="font-medium text-gray-900">{disconnection.contract_number}</td>
                    <td>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {disconnection.first_name} {disconnection.last_name}
                        </div>
                        <div className="text-xs text-gray-500">{disconnection.account_number}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(disconnection.disconnection_type)}`}>
                        {getTypeLabel(disconnection.disconnection_type)}
                      </span>
                    </td>
                    <td className="font-semibold text-red-600">
                      KES {parseFloat(disconnection.outstanding_amount || 0).toLocaleString()}
                    </td>
                    <td className="text-sm text-gray-700">
                      {new Date(disconnection.disconnection_date).toLocaleDateString()}
                    </td>
                    <td>
                      {disconnection.is_reconnected ? (
                        <span className="flex items-center space-x-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Reconnected</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-red-600">
                          <PowerOff className="w-4 h-4" />
                          <span className="text-sm font-medium">Disconnected</span>
                        </span>
                      )}
                    </td>
                    <td>
                      {disconnection.is_reconnected ? (
                        <div className="text-sm text-gray-700">
                          <div>{new Date(disconnection.reconnection_date).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500">
                            Fee: KES {parseFloat(disconnection.reconnection_fee || 0).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Pending</span>
                      )}
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          View
                        </button>
                        {!disconnection.is_reconnected && (
                          <button 
                            onClick={() => handleReconnect(disconnection)}
                            className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center space-x-1"
                          >
                            <Power className="w-3 h-3" />
                            <span>Reconnect</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total} records
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

      {/* Reconnection Modal */}
      {showReconnectModal && selectedDisconnection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reconnect Service</h3>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Customer: <span className="font-medium">{selectedDisconnection.first_name} {selectedDisconnection.last_name}</span></p>
              <p className="text-sm text-gray-600">Outstanding: <span className="font-medium text-red-600">KES {parseFloat(selectedDisconnection.outstanding_amount || 0).toLocaleString()}</span></p>
              <p className="text-sm text-gray-600">Reconnection Fee: <span className="font-medium">KES {parseFloat(selectedDisconnection.reconnection_fee || 500).toLocaleString()}</span></p>
            </div>
            <form onSubmit={submitReconnect} className="space-y-4">
              <div>
                <label className="label">Amount Paid</label>
                <input
                  type="number"
                  name="amountPaid"
                  step="0.01"
                  min="0"
                  defaultValue={selectedDisconnection.reconnection_fee || 500}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="label">Reconnection Date</label>
                <input
                  type="date"
                  name="reconnectionDate"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="input w-full"
                  required
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowReconnectModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reconnectMutation.isLoading}
                  className="btn btn-primary flex-1 flex items-center justify-center space-x-2"
                >
                  {reconnectMutation.isLoading ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4" />
                      <span>Reconnect</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default DisconnectionsPage
