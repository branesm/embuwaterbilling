import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { HardHat, Plus, X, Loader2, Trash2, Edit3 } from 'lucide-react'

interface Technician {
  id: number
  employee_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  department: string
  status: string
}

const departments = [
  { value: 'meter_reading', label: 'Meter Reading' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'connections', label: 'Connections' },
  { value: 'leak_repair', label: 'Leak Repair' },
  { value: 'general', label: 'General' },
]

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<any>({
    employee_id: '', first_name: '', last_name: '', email: '', phone: '', department: 'general'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/technicians?limit=100')
      setTechnicians(res.data.data || [])
    } catch (error) {
      console.error('Load technicians error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await api.put(`/technicians/${editingId}`, form)
      } else {
        await api.post('/technicians', form)
      }
      setShowModal(false)
      setEditingId(null)
      setForm({ employee_id: '', first_name: '', last_name: '', email: '', phone: '', department: 'general' })
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this technician?')) return
    try {
      await api.delete(`/technicians/${id}`)
      loadData()
    } catch (error) {
      alert('Failed to delete')
    }
  }

  const openEdit = (t: Technician) => {
    setForm({
      employee_id: t.employee_id, first_name: t.first_name, last_name: t.last_name,
      email: t.email || '', phone: t.phone, department: t.department
    })
    setEditingId(t.id)
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Technicians</h1>
          <p className="text-gray-500 mt-1">Manage field staff and work order assignees</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setShowModal(true) }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Technician
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : technicians.length === 0 ? (
          <div className="p-12 text-center">
            <HardHat className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No technicians found</h3>
            <p className="text-sm text-gray-500 mt-1">Add your first technician to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Employee ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Department</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {technicians.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-600">{t.employee_id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{t.first_name} {t.last_name}</div>
                      <div className="text-xs text-gray-500">{t.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{t.phone}</td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{t.department?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                        t.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                        t.status === 'inactive' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(t)} className="text-gray-400 hover:text-gray-600"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Technician' : 'Add Technician'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                  {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
