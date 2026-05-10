import { useState } from 'react'
import { useQuery } from 'react-query'
import api from '../../api/axios'
import { 
  Plus, 
  Search, 
  Filter, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  RefreshCw,
  User,
  Calendar,
  Tag,
  ArrowRight
} from 'lucide-react'

const ComplaintsPage = () => {
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: ''
  })
  const [page, setPage] = useState(1)

  const { data: complaintsData, isLoading, refetch } = useQuery(
    ['complaints', filters, page],
    async () => {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.category) params.append('category', filters.category)
      if (filters.priority) params.append('priority', filters.priority)
      params.append('page', page.toString())
      params.append('limit', '20')
      
      const response = await api.get(`/complaints?${params.toString()}`)
      return response.data
    }
  )

  const { data: statsData } = useQuery(
    ['complaints-stats'],
    async () => {
      const response = await api.get('/complaints/stats/summary')
      return response.data
    }
  )

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'bg-gray-100 text-gray-800'
      case 'assigned':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'closed':
        return 'bg-gray-100 text-gray-600'
      case 'escalated':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'billing':
        return <Tag className="w-4 h-4" />
      case 'meter':
        return <Clock className="w-4 h-4" />
      case 'leakage':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <MessageSquare className="w-4 h-4" />
    }
  }

  const complaints = complaintsData?.data || []
  const pagination = complaintsData?.pagination
  const stats = statsData?.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complaints Management</h1>
          <p className="text-gray-500 mt-1">Track and resolve customer complaints</p>
        </div>
        <button className="btn btn-primary flex items-center justify-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Register Complaint</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats?.overview?.total_complaints || 0, color: 'bg-blue-50 border-blue-200' },
          { label: 'Open', value: stats?.overview?.open_complaints || 0, color: 'bg-yellow-50 border-yellow-200' },
          { label: 'Resolved', value: stats?.overview?.resolved_complaints || 0, color: 'bg-green-50 border-green-200' },
          { label: 'Closed', value: stats?.overview?.closed_complaints || 0, color: 'bg-gray-50 border-gray-200' },
          { label: 'Urgent Pending', value: stats?.overview?.urgent_pending || 0, color: 'bg-red-50 border-red-200' }
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
              placeholder="Search complaints..."
              className="input pl-10 w-full"
            />
          </div>
          <select
            className="input w-full sm:w-40"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            className="input w-full sm:w-40"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          >
            <option value="">All Categories</option>
            <option value="billing">Billing</option>
            <option value="meter">Meter</option>
            <option value="leakage">Leakage</option>
            <option value="water_quality">Water Quality</option>
            <option value="service_interruption">Service Interruption</option>
          </select>
          <select
            className="input w-full sm:w-40"
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
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

      {/* Kanban Board View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {['open', 'assigned', 'in_progress', 'resolved'].map((status) => (
          <div key={status} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700 capitalize">{status.replace('_', ' ')}</h3>
              <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded-full text-xs">
                {complaints.filter(c => c.status === status).length}
              </span>
            </div>
            <div className="space-y-3">
              {complaints
                .filter(c => c.status === status)
                .map((complaint) => (
                  <div key={complaint.complaint_id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">{complaint.complaint_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(complaint.priority)}`}>
                        {complaint.priority}
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">{complaint.subject}</h4>
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{complaint.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <User className="w-3 h-3" />
                        <span>{complaint.first_name} {complaint.last_name}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {complaint.assigned_first_name && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500">
                          Assigned to: {complaint.assigned_first_name} {complaint.assigned_last_name}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              {complaints.filter(c => c.status === status).length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No complaints</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* List View */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Complaints</h3>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading complaints...</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No complaints found</p>
            <p className="text-sm text-gray-400 mt-1">Register a new complaint to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Complaint #</th>
                  <th>Customer</th>
                  <th>Category</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((complaint) => (
                  <tr key={complaint.complaint_id} className="hover:bg-gray-50">
                    <td className="font-medium text-gray-900">{complaint.complaint_number}</td>
                    <td>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {complaint.first_name} {complaint.last_name}
                        </div>
                        <div className="text-xs text-gray-500">{complaint.account_number}</div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-1 text-sm text-gray-700">
                        {getCategoryIcon(complaint.category)}
                        <span className="capitalize">{complaint.category.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="max-w-xs truncate">{complaint.subject}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(complaint.priority)}`}>
                        {complaint.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
                        {complaint.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {complaint.assigned_first_name ? (
                        <span className="text-sm text-gray-700">
                          {complaint.assigned_first_name} {complaint.assigned_last_name}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="text-sm text-gray-500">
                      {new Date(complaint.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View
                      </button>
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

export default ComplaintsPage
