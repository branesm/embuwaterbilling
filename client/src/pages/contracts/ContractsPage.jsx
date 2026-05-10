import { useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  PauseCircle,
  RefreshCw,
  MapPin,
  User,
  Droplets,
  History
} from 'lucide-react'

const ContractsPage = () => {
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  })
  const [page, setPage] = useState(1)

  const { data: contractsData, isLoading, refetch } = useQuery(
    ['contracts', filters, page],
    async () => {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.search) params.append('search', filters.search)
      params.append('page', page.toString())
      params.append('limit', '20')
      
      const response = await api.get(`/contracts?${params.toString()}`)
      return response.data
    }
  )

  const { data: statsData } = useQuery(
    ['contracts-stats'],
    async () => {
      const response = await api.get('/contracts/stats/summary')
      return response.data
    }
  )

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'suspended':
        return <PauseCircle className="w-5 h-5 text-yellow-500" />
      case 'inactive':
        return <XCircle className="w-5 h-5 text-gray-400" />
      case 'terminated':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <FileText className="w-5 h-5 text-blue-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'terminated':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const getServiceTypeIcon = (type) => {
    switch (type) {
      case 'water':
        return <Droplets className="w-4 h-4 text-blue-500" />
      case 'sewer':
        return <Droplets className="w-4 h-4 text-gray-500" />
      case 'both':
        return <Droplets className="w-4 h-4 text-purple-500" />
      default:
        return <Droplets className="w-4 h-4 text-blue-500" />
    }
  }

  const contracts = contractsData?.data || []
  const pagination = contractsData?.pagination
  const stats = statsData?.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contracts & Connections</h1>
          <p className="text-gray-500 mt-1">Manage customer water service contracts</p>
        </div>
        <button className="btn btn-primary flex items-center justify-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>New Connection</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Contracts', value: stats?.overview?.total_contracts || 0, color: 'bg-blue-50 border-blue-200' },
          { label: 'Active', value: stats?.overview?.active_contracts || 0, color: 'bg-green-50 border-green-200' },
          { label: 'Suspended', value: stats?.overview?.suspended_contracts || 0, color: 'bg-yellow-50 border-yellow-200' },
          { label: 'New This Month', value: stats?.newConnectionsThisMonth || 0, color: 'bg-purple-50 border-purple-200' }
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
              placeholder="Search by contract number or customer..."
              className="input pl-10 w-full"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <select
            className="input w-full sm:w-40"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
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

      {/* Contracts List */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading contracts...</p>
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No contracts found</p>
            <p className="text-sm text-gray-400 mt-1">Create a new connection to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Contract Number</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Meter</th>
                  <th>Connection Date</th>
                  <th>Deposit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.contract_id} className="hover:bg-gray-50">
                    <td>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(contract.status)}
                        <span className="font-medium text-gray-900">{contract.contract_number}</span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {contract.first_name} {contract.last_name}
                        </div>
                        <div className="text-xs text-gray-500">{contract.account_number}</div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-1">
                        {getServiceTypeIcon(contract.service_type)}
                        <span className="text-sm text-gray-700 capitalize">{contract.service_type}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}>
                        {contract.status}
                      </span>
                    </td>
                    <td>
                      <div className="text-sm text-gray-900">{contract.meter_number || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{contract.connection_size || '1/2 inch'}</div>
                    </td>
                    <td>
                      <span className="text-sm text-gray-700">
                        {contract.connection_date ? new Date(contract.connection_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm text-gray-900">
                        KES {parseFloat(contract.deposit_amount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          View
                        </button>
                        {contract.status === 'active' && (
                          <button className="text-yellow-600 hover:text-yellow-800 text-sm font-medium">
                            Suspend
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
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total} contracts
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
    </div>
  )
}

export default ContractsPage
