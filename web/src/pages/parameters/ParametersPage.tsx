import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Settings, Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from 'lucide-react'

const tables = [
  { key: 'billing-groups', label: 'Billing Groups' },
  { key: 'billing-routes', label: 'Billing Routes' },
  { key: 'zones', label: 'Zones' },
  { key: 'customer-categories', label: 'Customer Categories' },
  { key: 'customer-typologies', label: 'Customer Typologies' },
  { key: 'payment-modes', label: 'Payment Modes' },
  { key: 'reading-codes', label: 'Reading Codes' },
  { key: 'disconnection-profiles', label: 'Disconnection Profiles' },
  { key: 'departments', label: 'Departments' },
  { key: 'meter-types', label: 'Meter Types' },
  { key: 'financial-periods', label: 'Financial Periods' },
]

export default function ParametersPage() {
  const [selectedTable, setSelectedTable] = useState('billing-groups')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const queryClient = useQueryClient()

  const { data: records, isLoading } = useQuery({
    queryKey: ['parameters', selectedTable],
    queryFn: async () => {
      const res = await api.get(`/parameters/${selectedTable}`)
      return res.data.data
    },
  })

  const createRecord = useMutation({
    mutationFn: (data: any) => api.post(`/parameters/${selectedTable}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters', selectedTable] })
      setShowForm(false)
      setFormData({})
    },
  })

  const updateRecord = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.put(`/parameters/${selectedTable}/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters', selectedTable] })
      setEditingId(null)
      setEditData({})
    },
  })

  const deleteRecord = useMutation({
    mutationFn: (id: number) => api.delete(`/parameters/${selectedTable}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters', selectedTable] })
    },
  })

  const getFormFields = () => {
    if (!records || records.length === 0) return ['code', 'name', 'description']
    const first = records[0]
    return Object.keys(first).filter((k) => !['id', 'created_at', 'updated_at'].includes(k))
  }

  const fields = getFormFields()
  const displayFields = fields

  const toggleRow = (id: number) => {
    const next = new Set(expandedRows)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedRows(next)
  }

  const startEdit = (record: any) => {
    setEditingId(record.id)
    setEditData({ ...record })
  }

  const saveEdit = (id: number) => {
    const payload: Record<string, any> = {}
    fields.forEach((f) => {
      if (editData[f] !== undefined) payload[f] = editData[f]
    })
    updateRecord.mutate({ id, data: payload })
  }

  const isBooleanField = (field: string, record?: any) => {
    if (record && typeof record[field] === 'boolean') return true
    return field === 'is_active' || field === 'affects_billing'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parameters Management</h1>
          <p className="text-gray-500">Manage system lookup tables and configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tables</h3>
          <div className="space-y-1">
            {tables.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setSelectedTable(t.key)
                  setShowForm(false)
                  setEditingId(null)
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedTable === t.key ? 'bg-sky-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{tables.find((t) => t.key === selectedTable)?.label}</h2>
            <button
              onClick={() => { setShowForm(!showForm); setFormData({}) }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Cancel' : 'Add New'}
            </button>
          </div>

          {/* Create Form */}
          {showForm && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">New Record</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const payload: Record<string, any> = {}
                  fields.forEach((f) => {
                    if (formData[f] !== undefined && formData[f] !== '') payload[f] = formData[f]
                  })
                  createRecord.mutate(payload)
                }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                {fields.map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">{field.replace(/_/g, ' ')}</label>
                    {isBooleanField(field) ? (
                      <select
                        value={formData[field] ?? 'true'}
                        onChange={(e) => setFormData({ ...formData, [field]: e.target.value === 'true' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <input
                        value={formData[field] || ''}
                        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                      />
                    )}
                  </div>
                ))}
                <div className="md:col-span-3">
                  <button
                    type="submit"
                    disabled={createRecord.isPending}
                    className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 text-sm"
                  >
                    {createRecord.isPending ? 'Saving...' : 'Save Record'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Records Table */}
          <div className="bg-white rounded-lg border border-gray-200">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : records?.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No records found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {displayFields.map((k) => (
                        <th key={k} className="text-left px-4 py-3 font-medium text-gray-700 capitalize">{k.replace(/_/g, ' ')}</th>
                      ))}
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records?.map((record: any) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        {editingId === record.id ? (
                          <>
                            {displayFields.map((field) => (
                              <td key={field} className="px-4 py-2">
                                {isBooleanField(field, record) ? (
                                  <select
                                    value={editData[field] ?? true}
                                    onChange={(e) => setEditData({ ...editData, [field]: e.target.value === 'true' })}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                  </select>
                                ) : (
                                  <input
                                    value={editData[field] || ''}
                                    onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                )}
                              </td>
                            ))}
                            <td className="px-4 py-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${record.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {record.is_active !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <button onClick={() => saveEdit(record.id)} className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Save">
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => { setEditingId(null); setEditData({}) }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Cancel">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            {displayFields.map((k) => (
                              <td key={k} className="px-4 py-3">
                                {typeof record[k] === 'boolean' ? (record[k] ? 'Yes' : 'No') : String(record[k] || '')}
                              </td>
                            ))}
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${record.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                {record.is_active !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => startEdit(record)} className="p-1.5 hover:bg-sky-50 rounded text-sky-600" title="Edit">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => { if (confirm('Deactivate this record?')) deleteRecord.mutate(record.id) }}
                                  className="p-1.5 hover:bg-red-50 rounded text-red-600"
                                  title="Deactivate"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
