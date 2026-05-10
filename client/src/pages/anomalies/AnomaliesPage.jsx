import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../../api/axios'
import { 
  AlertTriangle, 
  AlertCircle,
  AlertOctagon,
  Info,
  Search, 
  Filter,
  CheckCircle,
  RefreshCw,
  User,
  Calendar,
  Gauge,
  Play,
  X
} from 'lucide-react'

const AnomaliesPage = () => {
  const [filters, setFilters] = useState({
    severity: '',
    isResolved: 'false'
  })
  const [page, setPage] = useState(1)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [selectedAnomaly, setSelectedAnomaly] = useState(null)
  const [showBulkDetectModal, setShowBulkDetectModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: anomaliesData, isLoading, refetch } = useQuery(
    ['anomalies', filters, page],
    async () => {
      const params = new URLSearchParams()
      if (filters.severity) params.append('severity', filters.severity)
      if (filters.isResolved) params.append('isResolved', filters.isResolved)
      params.append('page', page.toString())
      params.append('limit', '20')
      
      const response = await api.get(`/anomalies?${params.toString()}`)
      return response.data
    }
  )

  const { data: statsData } = useQuery(
    ['anomalies-stats'],
    async () => {
      const response = await api.get('/anomalies/stats/summary')
      return response.data
    }
  )

  const resolveMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.post(`/anomalies/${id}/resolve`, data)
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['anomalies'])
        queryClient.invalidateQueries(['anomalies-stats'])
        setShowResolveModal(false)
        setSelectedAnomaly(null)
      }
    }
  )

  const bulkDetectMutation = useMutation(
    async (data) => {
      const response = await api.post('/anomalies/bulk-detect', data)
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['anomalies'])
        queryClient.invalidateQueries(['anomalies-stats'])
        setShowBulkDetectModal(false)
      }
    }
  )

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertOctagon className="w-5 h-5 text-red-600" />
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const handleResolve = (anomaly) => {
    setSelectedAnomaly(anomaly)
    setShowResolveModal(true)
  }

  const submitResolve = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    resolveMutation.mutate({
      id: selectedAnomaly.id,
      data: {
        resolutionNotes: formData.get('resolutionNotes'),
        resolutionType: formData.get('resolutionType')
      }
    })
  }

  const submitBulkDetect = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    bulkDetectMutation.mutate({
      billingPeriod: formData.get('billingPeriod')
    })
  }

  const anomalies = anomaliesData?.data || []
  const pagination = anomaliesData?.pagination
  const stats = statsData?.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meter Reading Anomalies</h1>
          <p className="text-gray-500 mt-1">Detect and resolve unusual meter readings</p>
        </div>
        <button 
          onClick={() => setShowBulkDetectModal(true)}
          className="btn btn-primary flex items-center justify-center space-x-2"
        >
          <Play className="w-4 h-4" />
          <span>Run Detection</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: 'Total Anomalies', 
            value: stats?.overview?.total_anomalies || 0, 
            color: 'bg-blue-50 border-blue-200' 
          },
          { 
            label: 'Unresolved', 
            value: stats?.overview?.unresolved || 0, 
            color: 'bg-yellow-50 border-yellow-200' 
          },
          { 
            label: 'Critical', 
            value: stats?.overview?.critical_unresolved || 0, 
            color: 'bg-red-50 border-red-200' 
          },
          { 
            label: 'High Priority', 
            value: stats?.overview?.high_unresolved || 0, 
            color: 'bg-orange-50 border-orange-200' 
          }
        ].map((stat, index) => (
          <div key={index} className={`card ${stat.color}`}>
            <p className="text-sm text-gray-600">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Anomaly Types */}
      {stats?.byType && stats.byType.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Anomalies by Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {stats.byType.map((type, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">{type.anomaly_name}</p>
                <p className="text-xl font-bold text-gray-900">{type.count}</p>
                <p className="text-xs text-red-500">{type.unresolved} unresolved</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search anomalies..."
              className="input pl-10 w-full"
            />
          </div>
          <select
            className="input w-full sm:w-40"
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            className="input w-full sm:w-40"
            value={filters.isResolved}
            onChange={(e) => setFilters({ ...filters, isResolved: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
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

      {/* Anomalies List */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading anomalies...</p>
          </div>
        ) : anomalies.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
            <p className="text-gray-500">No anomalies found</p>
            <p className="text-sm text-gray-400 mt-1">Run detection to check for meter reading anomalies</p>
          </div>
        ) : (
          <div className="space-y-4">
            {anomalies.map((anomaly) => (
              <div 
                key={anomaly.id} 
                className={`border rounded-lg p-4 ${anomaly.is_resolved ? 'bg-gray-50 opacity-75' : 'bg-white hover:shadow-md'} transition-shadow`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Anomaly Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getSeverityIcon(anomaly.severity)}
                      <span className="font-semibold text-gray-900">{anomaly.anomaly_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(anomaly.severity)}`}>
                        {anomaly.severity}
                      </span>
                      {anomaly.is_resolved && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{anomaly.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center space-x-1">
                        <Gauge className="w-4 h-4" />
                        <span>{anomaly.meter_number}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <User className="w-4 h-4" />
                        <span>{anomaly.first_name} {anomaly.last_name}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(anomaly.detected_at).toLocaleDateString()}</span>
                      </span>
                    </div>

                    {anomaly.consumption !== null && (
                      <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
                        <span className="text-gray-600">Consumption: </span>
                        <span className="font-medium">{anomaly.consumption} m³</span>
                        <span className="text-gray-400 mx-2">|</span>
                        <span className="text-gray-600">Reading: </span>
                        <span className="font-medium">{anomaly.previous_reading} → {anomaly.current_reading}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-3">
                    {!anomaly.is_resolved ? (
                      <button 
                        onClick={() => handleResolve(anomaly)}
                        className="btn btn-primary text-sm flex items-center space-x-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Resolve</span>
                      </button>
                    ) : (
                      <div className="text-sm text-gray-500">
                        <p>Resolved by: {anomaly.detected_by_first_name} {anomaly.detected_by_last_name}</p>
                        <p>{anomaly.resolved_at && new Date(anomaly.resolved_at).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total} anomalies
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

      {/* Resolve Modal */}
      {showResolveModal && selectedAnomaly && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolve Anomaly</h3>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Anomaly: <span className="font-medium">{selectedAnomaly.anomaly_name}</span></p>
              <p className="text-sm text-gray-600">Meter: <span className="font-medium">{selectedAnomaly.meter_number}</span></p>
              <p className="text-sm text-gray-600">Customer: <span className="font-medium">{selectedAnomaly.first_name} {selectedAnomaly.last_name}</span></p>
            </div>
            <form onSubmit={submitResolve} className="space-y-4">
              <div>
                <label className="label">Resolution Type</label>
                <select name="resolutionType" className="input w-full" required>
                  <option value="">Select type...</option>
                  <option value="manual_review">Manual Review - No Action</option>
                  <option value="re_reading">Re-reading Required</option>
                  <option value="meter_replacement">Meter Replacement</option>
                  <option value="billing_adjustment">Billing Adjustment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Resolution Notes</label>
                <textarea 
                  name="resolutionNotes" 
                  className="input w-full h-24" 
                  placeholder="Enter notes about how this was resolved..."
                  required
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolveMutation.isLoading}
                  className="btn btn-primary flex-1 flex items-center justify-center space-x-2"
                >
                  {resolveMutation.isLoading ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Resolving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Resolve</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Detect Modal */}
      {showBulkDetectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Run Anomaly Detection</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will analyze all meter readings for the selected billing period and detect any anomalies based on historical patterns.
            </p>
            <form onSubmit={submitBulkDetect} className="space-y-4">
              <div>
                <label className="label">Billing Period</label>
                <input 
                  type="month" 
                  name="billingPeriod" 
                  className="input w-full"
                  defaultValue={new Date().toISOString().slice(0, 7)}
                  required
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBulkDetectModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkDetectMutation.isLoading}
                  className="btn btn-primary flex-1 flex items-center justify-center space-x-2"
                >
                  {bulkDetectMutation.isLoading ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Run Detection</span>
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

export default AnomaliesPage
