import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import {
  ClipboardList, Plus, Search, Calendar, User, MapPin, X, Wrench,
  AlertTriangle, CheckCircle, Clock, Loader2, ChevronDown, ChevronUp,
  MessageSquare, Trash2, Edit3
} from 'lucide-react'

interface WorkOrder {
  id: number
  work_order_number: string
  work_order_type: string
  priority: string
  status: string
  customer_name: string
  account_number: string
  description: string
  scheduled_date: string
  technician_first_name: string
  technician_last_name: string
  created_at: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-50 text-gray-700 border-gray-200',
  on_hold: 'bg-orange-50 text-orange-700 border-orange-200',
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  medium: 'bg-blue-50 text-blue-600 border-blue-200',
  high: 'bg-orange-50 text-orange-600 border-orange-200',
  urgent: 'bg-red-50 text-red-600 border-red-200',
}

const typeOptions = [
  { value: 'new_connection', label: 'New Connection' },
  { value: 'disconnection', label: 'Disconnection' },
  { value: 'reconnection', label: 'Reconnection' },
  { value: 'meter_replacement', label: 'Meter Replacement' },
  { value: 'meter_repair', label: 'Meter Repair' },
  { value: 'leak_repair', label: 'Leak Repair' },
  { value: 'pipe_repair', label: 'Pipe Repair' },
  { value: 'valve_repair', label: 'Valve Repair' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
]

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', type: '', priority: '' })
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detailData, setDetailData] = useState<any>(null)
  const [technicians, setTechnicians] = useState<any[]>([])
  const [form, setForm] = useState<any>({
    work_order_type: '', priority: 'medium', description: '',
    customer_name: '', customer_phone: '', customer_address: '',
    account_number: '', meter_number: '', scheduled_date: '',
    instructions: '', estimated_cost: ''
  })
  const [commentText, setCommentText] = useState('')
  const [assignForm, setAssignForm] = useState({ technician_id: '', scheduled_date: '', notes: '' })

  useEffect(() => {
    loadData()
    loadTechnicians()
  }, [filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.type) params.append('type', filters.type)
      if (filters.priority) params.append('priority', filters.priority)

      const [woRes, statsRes] = await Promise.all([
        api.get(`/workorders?${params.toString()}`),
        api.get('/workorders/stats/summary'),
      ])

      setWorkOrders(woRes.data.data || [])
      setStats(statsRes.data.data)
    } catch (error) {
      console.error('Load work orders error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTechnicians = async () => {
    try {
      const res = await api.get('/technicians?limit=100')
      setTechnicians(res.data.data || [])
    } catch (error) {
      console.error('Load technicians error:', error)
    }
  }

  const loadDetail = async (id: number) => {
    try {
      const res = await api.get(`/workorders/${id}`)
      setDetailData(res.data.data)
      setDetailId(id)
    } catch (error) {
      console.error('Load detail error:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await api.put(`/workorders/${editingId}`, form)
      } else {
        await api.post('/workorders', form)
      }
      setShowModal(false)
      setEditingId(null)
      setForm({
        work_order_type: '', priority: 'medium', description: '',
        customer_name: '', customer_phone: '', customer_address: '',
        account_number: '', meter_number: '', scheduled_date: '',
        instructions: '', estimated_cost: ''
      })
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this work order?')) return
    try {
      await api.delete(`/workorders/${id}`)
      loadData()
    } catch (error) {
      alert('Failed to delete')
    }
  }

  const handleAssign = async () => {
    if (!assignForm.technician_id) return
    try {
      await api.post(`/workorders/${detailId}/assign`, {
        technician_id: parseInt(assignForm.technician_id),
        scheduled_date: assignForm.scheduled_date || null,
        notes: assignForm.notes || null,
      })
      setAssignForm({ technician_id: '', scheduled_date: '', notes: '' })
      loadDetail(detailId!)
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to assign')
    }
  }

  const handleAddComment = async () => {
    if (!commentText.trim()) return
    try {
      await api.post(`/workorders/${detailId}/comments`, { comment: commentText })
      setCommentText('')
      loadDetail(detailId!)
    } catch (error) {
      alert('Failed to add comment')
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.put(`/workorders/${detailId}`, { status: newStatus })
      loadDetail(detailId!)
      loadData()
    } catch (error) {
      alert('Failed to update status')
    }
  }

  const formatType = (type: string) => type?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

  const openEdit = (wo: WorkOrder) => {
    setForm({
      work_order_type: wo.work_order_type,
      priority: wo.priority,
      description: wo.description,
      customer_name: wo.customer_name || '',
      account_number: wo.account_number || '',
      scheduled_date: wo.scheduled_date || '',
    })
    setEditingId(wo.id)
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-gray-500 mt-1">Manage field operations and maintenance tasks</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setShowModal(true) }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Work Order
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total', value: stats.overview?.total || 0, color: 'bg-gray-50 border-gray-200' },
            { label: 'Pending', value: stats.overview?.pending || 0, color: 'bg-amber-50 border-amber-200' },
            { label: 'Assigned', value: stats.overview?.assigned || 0, color: 'bg-blue-50 border-blue-200' },
            { label: 'In Progress', value: stats.overview?.in_progress || 0, color: 'bg-purple-50 border-purple-200' },
            { label: 'Completed', value: stats.overview?.completed || 0, color: 'bg-green-50 border-green-200' },
            { label: 'Urgent Open', value: stats.overview?.urgent_open || 0, color: 'bg-red-50 border-red-200' },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl border p-3 ${stat.color}`}>
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="">All Types</option>
            {typeOptions.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : workOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No work orders found</h3>
            <p className="text-sm text-gray-500 mt-1">Create your first work order to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Work Order</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Assigned</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Scheduled</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Priority</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{wo.work_order_number}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{wo.description?.substring(0, 50)}...</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatType(wo.work_order_type)}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{wo.customer_name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{wo.account_number}</div>
                    </td>
                    <td className="px-4 py-3">
                      {wo.technician_first_name ? (
                        <span className="text-sm text-gray-700">{wo.technician_first_name} {wo.technician_last_name}</span>
                      ) : (
                        <span className="text-sm text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{wo.scheduled_date ? new Date(wo.scheduled_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColors[wo.priority]}`}>
                        {wo.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[wo.status]}`}>
                        {wo.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => loadDetail(wo.id)} className="text-primary-600 hover:text-primary-700 text-xs font-medium">View</button>
                        <button onClick={() => openEdit(wo)} className="text-gray-400 hover:text-gray-600"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(wo.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Work Order' : 'Create Work Order'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select required value={form.work_order_type} onChange={(e) => setForm({ ...form, work_order_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                    <option value="">Select type</option>
                    {typeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input type="text" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input type="text" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                  <input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                  <input type="text" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost</label>
                  <input type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {detailId && detailData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{detailData.work_order_number}</h2>
                <p className="text-sm text-gray-500">{formatType(detailData.work_order_type)}</p>
              </div>
              <button onClick={() => setDetailId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Status & Priority */}
              <div className="flex flex-wrap gap-3">
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${priorityColors[detailData.priority]}`}>
                  {detailData.priority} priority
                </span>
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[detailData.status]}`}>
                  {detailData.status?.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Status Actions */}
              <div className="flex flex-wrap gap-2">
                {['pending', 'assigned', 'in_progress', 'completed', 'cancelled'].map((s) => (
                  <button key={s} onClick={() => handleStatusChange(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      detailData.status === s
                        ? 'bg-primary-50 text-primary-700 border-primary-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}>
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <p className="text-gray-500">Customer</p>
                  <p className="font-medium text-gray-900">{detailData.customer_name || 'N/A'}</p>
                  <p className="text-gray-500 text-xs">{detailData.account_number}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-500">Assigned To</p>
                  <p className="font-medium text-gray-900">
                    {detailData.technician_first_name ? `${detailData.technician_first_name} ${detailData.technician_last_name}` : 'Unassigned'}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{detailData.customer_phone || '-'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-500">Scheduled</p>
                  <p className="font-medium text-gray-900">{detailData.scheduled_date ? new Date(detailData.scheduled_date).toLocaleDateString() : '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3">{detailData.description}</p>
              </div>

              {/* Assignment */}
              {detailData.status !== 'completed' && detailData.status !== 'cancelled' && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">Assign to Technician</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select value={assignForm.technician_id} onChange={(e) => setAssignForm({ ...assignForm, technician_id: e.target.value })}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      <option value="">Select technician</option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.id}>{t.first_name} {t.last_name} ({t.employee_id})</option>
                      ))}
                    </select>
                    <input type="date" value={assignForm.scheduled_date} onChange={(e) => setAssignForm({ ...assignForm, scheduled_date: e.target.value })}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    <button onClick={handleAssign} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">Assign</button>
                  </div>
                </div>
              )}

              {/* Comments */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Comments
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(detailData.comments || []).length === 0 && (
                    <p className="text-sm text-gray-400">No comments yet.</p>
                  )}
                  {(detailData.comments || []).map((c: any) => (
                    <div key={c.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                      <p className="text-gray-900">{c.comment}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {c.first_name} {c.last_name} · {new Date(c.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <button onClick={handleAddComment} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
