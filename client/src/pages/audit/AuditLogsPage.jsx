import { useState } from 'react'
import { useQuery } from 'react-query'
import api from '../../api/axios'
import { 
  ClipboardList, 
  Search, 
  Filter,
  User,
  Calendar,
  Database,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  Download,
  Eye
} from 'lucide-react'

const AuditLogsPage = () => {
  const [filters, setFilters] = useState({
    tableName: '',
    action: '',
    transactionType: '',
    startDate: '',
    endDate: ''
  })
  const [page, setPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState(null)

  const { data: logsData, isLoading, refetch } = useQuery(
    ['audit-logs', filters, page],
    async () => {
      const params = new URLSearchParams()
      if (filters.tableName) params.append('tableName', filters.tableName)
      if (filters.action) params.append('action', filters.action)
      if (filters.transactionType) params.append('transactionType', filters.transactionType)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      params.append('page', page.toString())
      params.append('limit', '50')
      
      const response = await api.get(`/wasreb/audit-trail?${params.toString()}`)
      return response.data
    }
  )

  const getActionIcon = (action) => {
    switch (action) {
      case 'INSERT':
        return <Plus className="w-4 h-4 text-green-500" />
      case 'UPDATE':
        return <Edit3 className="w-4 h-4 text-blue-500" />
      case 'DELETE':
        return <Trash2 className="w-4 h-4 text-red-500" />
      default:
        return <Database className="w-4 h-4 text-gray-500" />
    }
  }

  const getActionColor = (action) => {
    switch (action) {
      case 'INSERT':
        return 'bg-green-100 text-green-800'
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800'
      case 'DELETE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTransactionTypeColor = (type) => {
    switch (type) {
      case 'billing':
        return 'bg-purple-100 text-purple-800'
      case 'payment':
        return 'bg-green-100 text-green-800'
      case 'adjustment':
        return 'bg-orange-100 text-orange-800'
      case 'disconnection':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatJson = (json) => {
    if (!json) return null
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json
      return JSON.stringify(parsed, null, 2)
    } catch {
      return json
    }
  }

  const logs = logsData?.data || []
  const pagination = logsData?.pagination

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500 mt-1">Track all system changes and financial transactions</p>
        </div>
        <button className="btn btn-secondary flex items-center space-x-2">
          <Download className="w-4 h-4" />
          <span>Export Logs</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Table name..."
              className="input pl-10 w-full"
              value={filters.tableName}
              onChange={(e) => setFilters({ ...filters, tableName: e.target.value })}
            />
          </div>
          <select
            className="input w-full"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            <option value="">All Actions</option>
            <option value="INSERT">Insert</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
          <select
            className="input w-full"
            value={filters.transactionType}
            onChange={(e) => setFilters({ ...filters, transactionType: e.target.value })}
          >
            <option value="">All Types</option>
            <option value="billing">Billing</option>
            <option value="payment">Payment</option>
            <option value="adjustment">Adjustment</option>
            <option value="disconnection">Disconnection</option>
            <option value="complaint">Complaint</option>
          </select>
          <input
            type="date"
            className="input w-full"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            placeholder="Start Date"
          />
          <input
            type="date"
            className="input w-full"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            placeholder="End Date"
          />
        </div>
        <div className="flex justify-end mt-4">
          <button 
            onClick={() => refetch()}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Apply Filters</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No audit logs found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Table</th>
                  <th>Transaction Type</th>
                  <th>Amount</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.log_id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap">
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-1">
                        <User className="w-3 h-3 text-gray-400" />
                        <span className="text-sm">{log.first_name} {log.last_name}</span>
                        <span className="text-xs text-gray-500">({log.user_role})</span>
                      </div>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="text-sm font-medium text-gray-700">
                      {log.table_name}
                    </td>
                    <td>
                      {log.transaction_type && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTransactionTypeColor(log.transaction_type)}`}>
                          {log.transaction_type}
                        </span>
                      )}
                    </td>
                    <td className="text-sm">
                      {log.amount ? (
                        <span className="font-medium">KES {parseFloat(log.amount).toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td>
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
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
              Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, pagination.total)} of {pagination.total} logs
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

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Audit Log Details</h3>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Log ID:</span>
                  <span className="ml-2 font-medium">{selectedLog.log_id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Timestamp:</span>
                  <span className="ml-2 font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">User:</span>
                  <span className="ml-2 font-medium">{selectedLog.first_name} {selectedLog.last_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">Role:</span>
                  <span className="ml-2 font-medium">{selectedLog.user_role}</span>
                </div>
                <div>
                  <span className="text-gray-500">Action:</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${getActionColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Table:</span>
                  <span className="ml-2 font-medium">{selectedLog.table_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">Record ID:</span>
                  <span className="ml-2 font-medium">{selectedLog.record_id}</span>
                </div>
                {selectedLog.amount && (
                  <div>
                    <span className="text-gray-500">Amount:</span>
                    <span className="ml-2 font-medium">KES {parseFloat(selectedLog.amount).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {selectedLog.old_values && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Old Values</h4>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                    {formatJson(selectedLog.old_values)}
                  </pre>
                </div>
              )}

              {selectedLog.new_values && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">New Values</h4>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                    {formatJson(selectedLog.new_values)}
                  </pre>
                </div>
              )}

              <div className="pt-4 border-t">
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="btn btn-secondary w-full"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuditLogsPage
