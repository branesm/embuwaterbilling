import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../../api/axios'
import {
  Map,
  MapPin,
  Route,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  Users,
  Gauge
} from 'lucide-react'

/* ───────────────────── Zone Modal ───────────────────── */
const ZoneModal = ({ zone, onClose }) => {
  const queryClient = useQueryClient()
  const isEdit = !!zone
  const [form, setForm] = useState({
    name: zone?.name || '',
    code: zone?.code || '',
    description: zone?.description || ''
  })
  const [error, setError] = useState('')

  const mutation = useMutation(
    (data) => isEdit ? api.put(`/zones/${zone.id}`, data) : api.post('/zones', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('zones')
        onClose()
      },
      onError: (err) => {
        setError(err?.response?.data?.message || 'Failed to save zone')
      }
    }
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Zone name is required'); return }
    if (!form.code.trim()) { setError('Zone code is required'); return }
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Zone' : 'New Zone'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zone Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input w-full"
              placeholder="e.g. Central Business District"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zone Code *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="input w-full"
              placeholder="e.g. CBD"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input w-full"
              rows={3}
              placeholder="Optional description of the zone"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button
              type="submit"
              disabled={mutation.isLoading}
              className="btn btn-primary flex items-center space-x-2"
            >
              {mutation.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isEdit ? 'Update Zone' : 'Create Zone'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ───────────────────── Route Modal ───────────────────── */
const RouteModal = ({ route, zones, onClose }) => {
  const queryClient = useQueryClient()
  const isEdit = !!route
  const [form, setForm] = useState({
    zoneId: route?.zone_id || (zones.length > 0 ? zones[0].id : ''),
    name: route?.name || '',
    code: route?.code || '',
    description: route?.description || ''
  })
  const [error, setError] = useState('')

  const mutation = useMutation(
    (data) => isEdit ? api.put(`/routes/${route.id}`, data) : api.post('/routes', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('routes')
        onClose()
      },
      onError: (err) => {
        setError(err?.response?.data?.message || 'Failed to save route')
      }
    }
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Route name is required'); return }
    if (!form.code.trim()) { setError('Route code is required'); return }
    if (!form.zoneId) { setError('Please select a zone'); return }
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Route' : 'New Route'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zone *</label>
            <select
              value={form.zoneId}
              onChange={(e) => setForm({ ...form, zoneId: e.target.value })}
              className="input w-full"
            >
              <option value="">Select a zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.name} ({z.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input w-full"
              placeholder="e.g. Market Street Loop"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route Code *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="input w-full"
              placeholder="e.g. MSL"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input w-full"
              rows={3}
              placeholder="Optional description of the route"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button
              type="submit"
              disabled={mutation.isLoading}
              className="btn btn-primary flex items-center space-x-2"
            >
              {mutation.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isEdit ? 'Update Route' : 'Create Route'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ───────────────────── Delete Confirmation ───────────────────── */
const DeleteConfirmModal = ({ title, message, onConfirm, onCancel, isLoading }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
      <div className="p-6 text-center">
        <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex justify-center space-x-3">
          <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="btn bg-red-600 hover:bg-red-700 text-white flex items-center space-x-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
)

/* ───────────────────── Main Page ───────────────────── */
const ZoneRoutePage = () => {
  const [activeTab, setActiveTab] = useState('zones')
  const [zoneModal, setZoneModal] = useState(null)       // null=closed, {}=new, zone=edit
  const [routeModal, setRouteModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null) // { type, item }

  const { data: zonesData, isLoading: zonesLoading } = useQuery(
    'zones',
    async () => {
      const res = await api.get('/zones')
      return res.data
    }
  )

  const { data: routesData, isLoading: routesLoading } = useQuery(
    'routes',
    async () => {
      const res = await api.get('/routes')
      return res.data
    }
  )

  const queryClient = useQueryClient()

  const deleteMutation = useMutation(
    ({ type, id }) => api.delete(`/${type}/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('zones')
        queryClient.invalidateQueries('routes')
        setDeleteTarget(null)
      },
      onError: (err) => {
        setDeleteTarget({ ...deleteTarget, error: err?.response?.data?.message || 'Failed to delete' })
      }
    }
  )

  const zones = zonesData?.data || []
  const routes = routesData?.data || []

  const tabs = [
    { key: 'zones', label: 'Zones', icon: Map },
    { key: 'routes', label: 'Routes', icon: Route }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zones & Routes</h1>
          <p className="text-gray-500 mt-1">Manage geographic zones and meter reading routes</p>
        </div>
        <button
          onClick={() => activeTab === 'zones' ? setZoneModal({}) : setRouteModal({})}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>{activeTab === 'zones' ? 'New Zone' : 'New Route'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Zones Tab */}
      {activeTab === 'zones' && (
        <div className="card">
          {zonesLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading zones...</p>
            </div>
          ) : zones.length === 0 ? (
            <div className="text-center py-12">
              <Map className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No zones found</p>
              <p className="text-sm text-gray-400 mt-1">Create your first zone to get started</p>
              <button
                onClick={() => setZoneModal({})}
                className="btn btn-primary mt-4 inline-flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Zone</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Zone Name</th>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Customer Count</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((zone) => (
                    <tr key={zone.id} className="hover:bg-gray-50">
                      <td>
                        <div className="flex items-center space-x-2">
                          <Map className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-gray-900">{zone.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono font-semibold">
                          {zone.code}
                        </span>
                      </td>
                      <td className="text-sm text-gray-500 max-w-xs truncate">
                        {zone.description || '—'}
                      </td>
                      <td>
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span>{zone.customer_count || 0}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          zone.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {zone.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setZoneModal(zone)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit zone"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ type: 'zones', item: zone })}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete zone"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Routes Tab */}
      {activeTab === 'routes' && (
        <div className="card">
          {routesLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading routes...</p>
            </div>
          ) : routes.length === 0 ? (
            <div className="text-center py-12">
              <Route className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No routes found</p>
              <p className="text-sm text-gray-400 mt-1">Create your first route to get started</p>
              <button
                onClick={() => setRouteModal({})}
                className="btn btn-primary mt-4 inline-flex items-center space-x-2"
                disabled={zones.length === 0}
              >
                <Plus className="w-4 h-4" />
                <span>Create Route</span>
              </button>
              {zones.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">Create a zone first before adding routes</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Route Name</th>
                    <th>Code</th>
                    <th>Zone</th>
                    <th>Meter Count</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => (
                    <tr key={route.id} className="hover:bg-gray-50">
                      <td>
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-emerald-500" />
                          <span className="font-medium text-gray-900">{route.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-mono font-semibold">
                          {route.code}
                        </span>
                      </td>
                      <td>
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                          {route.zone_name || 'Unassigned'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <Gauge className="w-4 h-4 text-gray-400" />
                          <span>{route.meter_count || 0}</span>
                        </div>
                      </td>
                      <td className="text-sm text-gray-500 max-w-xs truncate">
                        {route.description || '—'}
                      </td>
                      <td>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setRouteModal(route)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit route"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ type: 'routes', item: route })}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete route"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Zone Modal */}
      {zoneModal !== null && (
        <ZoneModal zone={zoneModal.id ? zoneModal : null} onClose={() => setZoneModal(null)} />
      )}

      {/* Route Modal */}
      {routeModal !== null && (
        <RouteModal
          route={routeModal.id ? routeModal : null}
          zones={zones}
          onClose={() => setRouteModal(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          title={`Delete ${deleteTarget.type === 'zones' ? 'Zone' : 'Route'}`}
          message={
            deleteTarget.error
              ? deleteTarget.error
              : `Are you sure you want to delete "${deleteTarget.item.name}"? This action cannot be undone.`
          }
          onConfirm={() => deleteMutation.mutate({ type: deleteTarget.type, id: deleteTarget.item.id })}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteMutation.isLoading}
        />
      )}
    </div>
  )
}

export default ZoneRoutePage
