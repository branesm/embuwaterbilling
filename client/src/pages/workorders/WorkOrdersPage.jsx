import { useState } from 'react'
import { useQuery } from 'react-query'
import api from '../../api/axios'
import { ClipboardList, Plus, Filter, Search, Calendar, User, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

const WorkOrdersPage = () => {
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    priority: ''
  })

  const { data: workOrders, isLoading } = useQuery(
    ['workorders', filters],
    async () => {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.type) params.append('type', filters.type)
      if (filters.priority) params.append('priority', filters.priority)
      
      const response = await api.get(`/workorders?${params.toString()}`)
      return response.data.data
    }
  )

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      assigned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-600',
      medium: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      urgent: 'bg-red-100 text-red-600'
    }
    return colors[priority] || 'bg-gray-100 text-gray-600'
  }

  const formatType = (type) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-gray-500 mt-1">Manage field operations and maintenance tasks</p>
        </div>
        <Link to="/workorders/new" className="btn btn-primary flex items-center justify-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Create Work Order</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: '12', color: 'bg-yellow-50 border-yellow-200' },
          { label: 'In Progress', value: '8', color: 'bg-purple-50 border-purple-200' },
          { label: 'Completed Today', value: '5', color: 'bg-green-50 border-green-200' },
          { label: 'Urgent', value: '3', color: 'bg-red-50 border-red-200' }
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
              placeholder="Search work orders..."
              className="input pl-10 w-full"
            />
          </div>
          <select
            className="input w-full sm:w-40"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <select
            className="input w-full sm:w-40"
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="">All Types</option>
            <option value="new_connection">New Connection</option>
            <option value="meter_replacement">Meter Replacement</option>
            <option value="leak_repair">Leak Repair</option>
            <option value="disconnection">Disconnection</option>
          </select>
        </div>
      </div>

      {/* Work Orders List */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading work orders...</p>
          </div>
        ) : workOrders?.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No work orders found</p>
            <p className="text-sm text-gray-400 mt-1">Create your first work order to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Work Order</th>
                  <th>Type</th>
                  <th>Customer</th>
                  <th>Assigned To</th>
                  <th>Scheduled</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workOrders?.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50">
                    <td>
                      <div className="font-medium text-gray-900">{wo.work_order_number}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">{wo.description?.substring(0, 50)}...</div>
                    </td>
                    <td>
                      <span className="text-sm text-gray-700">{formatType(wo.work_order_type)}</span>
                    </td>
                    <td>
                      <div className="text-sm text-gray-900">{wo.customer_name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{wo.account_number}</div>
                    </td>
                    <td>
                      {wo.technician_first_name ? (
                        <div className="flex items-center space-x-1">
                          <User className="w-3 h-3 text-gray-400" />
                          <span className="text-sm">{wo.technician_first_name} {wo.technician_last_name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td>
                      {wo.scheduled_date ? (
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className="text-sm">{new Date(wo.scheduled_date).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not scheduled</span>
                      )}
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(wo.priority)}`}>
                        {wo.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wo.status)}`}>
                        {wo.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <Link to={`/workorders/${wo.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default WorkOrdersPage