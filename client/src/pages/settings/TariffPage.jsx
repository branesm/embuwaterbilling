import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../../api/axios'
import {
  Plus,
  Eye,
  Pencil,
  Power,
  PowerOff,
  X,
  Trash2,
  Loader2,
  AlertCircle,
  Layers,
  DollarSign,
  Calendar,
  ChevronRight
} from 'lucide-react'

const PROPERTY_TYPE_COLORS = {
  residential: 'bg-blue-100 text-blue-800',
  commercial: 'bg-green-100 text-green-800',
  industrial: 'bg-orange-100 text-orange-800',
  institutional: 'bg-purple-100 text-purple-800'
}

const TIER_BAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-red-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500'
]

const EMPTY_FORM = {
  name: '',
  propertyType: 'residential',
  standingCharge: '',
  sewerageRate: '',
  meterRent: '',
  effectiveFrom: '',
  tiers: [{ minConsumption: '0', maxConsumption: '', ratePerUnit: '' }]
}

const TariffPage = () => {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTiersModal, setShowTiersModal] = useState(false)
  const [selectedTariff, setSelectedTariff] = useState(null)
  const [editingTariff, setEditingTariff] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})

  // Fetch tariffs
  const { data: tariffsData, isLoading } = useQuery(
    ['tariffs'],
    async () => {
      const res = await api.get('/tariffs')
      return res.data.data
    }
  )

  // Fetch tiers for selected tariff
  const { data: tiersData, isLoading: tiersLoading } = useQuery(
    ['tariff-tiers', selectedTariff?.id],
    async () => {
      const res = await api.get(`/tariffs/${selectedTariff.id}/tiers`)
      return res.data.data
    },
    { enabled: !!selectedTariff }
  )

  // Create tariff
  const createMutation = useMutation(
    (data) => api.post('/tariffs', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tariffs'])
        closeModal()
      }
    }
  )

  // Update tariff
  const updateMutation = useMutation(
    ({ id, data }) => api.put(`/tariffs/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tariffs'])
        closeModal()
      }
    }
  )

  // Toggle active status
  const toggleActiveMutation = useMutation(
    ({ id, isActive }) => api.put(`/tariffs/${id}`, { isActive }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tariffs'])
      }
    }
  )

  const tariffs = tariffsData || []
  const tiers = tiersData || []

  // Form handlers
  const openCreateModal = () => {
    setEditingTariff(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setShowCreateModal(true)
  }

  const openEditModal = (tariff) => {
    setEditingTariff(tariff)
    setForm({
      name: tariff.name || '',
      propertyType: tariff.property_type || 'residential',
      standingCharge: tariff.standing_charge?.toString() || '',
      sewerageRate: tariff.sewerage_rate?.toString() || '',
      meterRent: tariff.meter_rent?.toString() || '',
      effectiveFrom: tariff.effective_from ? tariff.effective_from.split('T')[0] : '',
      tiers: [{ minConsumption: '0', maxConsumption: '', ratePerUnit: '' }]
    })
    setFormErrors({})
    setShowCreateModal(true)
    // Fetch existing tiers for editing
    fetchTiersForEdit(tariff.id)
  }

  const fetchTiersForEdit = async (tariffId) => {
    try {
      const res = await api.get(`/tariffs/${tariffId}/tiers`)
      const existingTiers = res.data.data
      if (existingTiers && existingTiers.length > 0) {
        setForm(prev => ({
          ...prev,
          tiers: existingTiers.map(t => ({
            minConsumption: t.min_consumption?.toString() || '0',
            maxConsumption: t.max_consumption?.toString() || '',
            ratePerUnit: t.rate_per_unit?.toString() || ''
          }))
        }))
      }
    } catch (err) {
      // Use default tier
    }
  }

  const closeModal = () => {
    setShowCreateModal(false)
    setEditingTariff(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
  }

  const openTiersModal = (tariff) => {
    setSelectedTariff(tariff)
    setShowTiersModal(true)
  }

  const closeTiersModal = () => {
    setShowTiersModal(false)
    setSelectedTariff(null)
  }

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const handleTierChange = (index, field, value) => {
    setForm(prev => {
      const newTiers = [...prev.tiers]
      newTiers[index] = { ...newTiers[index], [field]: value }
      return { ...prev, tiers: newTiers }
    })
    if (formErrors.tiers) {
      setFormErrors(prev => ({ ...prev, tiers: null }))
    }
  }

  const addTier = () => {
    const lastTier = form.tiers[form.tiers.length - 1]
    const newMin = lastTier.maxConsumption || ''
    setForm(prev => ({
      ...prev,
      tiers: [...prev.tiers, { minConsumption: newMin, maxConsumption: '', ratePerUnit: '' }]
    }))
  }

  const removeTier = (index) => {
    if (form.tiers.length <= 1) return
    setForm(prev => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== index)
    }))
  }

  const validateForm = () => {
    const errors = {}

    if (!form.name.trim()) errors.name = 'Name is required'
    if (!form.standingCharge || isNaN(parseFloat(form.standingCharge)))
      errors.standingCharge = 'Valid standing charge is required'
    if (!form.sewerageRate || isNaN(parseFloat(form.sewerageRate)))
      errors.sewerageRate = 'Valid sewerage rate is required'
    if (!form.meterRent || isNaN(parseFloat(form.meterRent)))
      errors.meterRent = 'Valid meter rent is required'
    if (!form.effectiveFrom) errors.effectiveFrom = 'Effective date is required'

    // Validate tiers
    const tierErrors = []
    let hasTierError = false
    form.tiers.forEach((tier, i) => {
      const tErr = {}
      if (tier.minConsumption === '' || isNaN(parseFloat(tier.minConsumption)))
        tErr.minConsumption = 'Required'
      if (tier.maxConsumption === '' || isNaN(parseFloat(tier.maxConsumption)))
        tErr.maxConsumption = 'Required'
      if (tier.ratePerUnit === '' || isNaN(parseFloat(tier.ratePerUnit)))
        tErr.ratePerUnit = 'Required'
      if (Object.keys(tErr).length > 0) {
        tierErrors[i] = tErr
        hasTierError = true
      }
    })

    // Contiguity check
    for (let i = 1; i < form.tiers.length; i++) {
      const prevMax = parseFloat(form.tiers[i - 1].maxConsumption)
      const currMin = parseFloat(form.tiers[i].minConsumption)
      if (!isNaN(prevMax) && !isNaN(currMin) && prevMax !== currMin) {
        if (!tierErrors[i]) tierErrors[i] = {}
        tierErrors[i].minConsumption = `Must equal tier ${i} max (${prevMax})`
        hasTierError = true
      }
    }

    if (hasTierError) errors.tiers = tierErrors

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload = {
      name: form.name.trim(),
      propertyType: form.propertyType,
      standingCharge: parseFloat(form.standingCharge),
      sewerageRate: parseFloat(form.sewerageRate),
      meterRent: parseFloat(form.meterRent),
      effectiveFrom: form.effectiveFrom,
      tiers: form.tiers.map(t => ({
        minConsumption: parseFloat(t.minConsumption),
        maxConsumption: parseFloat(t.maxConsumption),
        ratePerUnit: parseFloat(t.ratePerUnit)
      }))
    }

    if (editingTariff) {
      updateMutation.mutate({ id: editingTariff.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleToggleActive = (tariff) => {
    toggleActiveMutation.mutate({
      id: tariff.id,
      isActive: !tariff.is_active
    })
  }

  const formatCurrency = (value) => {
    if (value == null) return '0'
    return parseFloat(value).toLocaleString()
  }

  const isSaving = createMutation.isLoading || updateMutation.isLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tariff Management</h1>
          <p className="text-gray-500 mt-1">Manage water billing tariffs and pricing tiers</p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>New Tariff</span>
        </button>
      </div>

      {/* Tariff Table */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading tariffs...</p>
          </div>
        ) : tariffs.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No tariffs found</p>
            <p className="text-sm text-gray-400 mt-1">Create a new tariff to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Property Type</th>
                  <th>Standing Charge</th>
                  <th>Sewerage Rate %</th>
                  <th>Meter Rent</th>
                  <th>Tiers</th>
                  <th>Effective From</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tariffs.map((tariff) => (
                  <tr key={tariff.id} className="hover:bg-gray-50">
                    <td className="font-medium text-gray-900">{tariff.name}</td>
                    <td>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PROPERTY_TYPE_COLORS[tariff.property_type] || 'bg-gray-100 text-gray-800'}`}>
                        {tariff.property_type}
                      </span>
                    </td>
                    <td className="text-gray-700">KES {formatCurrency(tariff.standing_charge)}</td>
                    <td className="text-gray-700">{tariff.sewerage_rate}%</td>
                    <td className="text-gray-700">KES {formatCurrency(tariff.meter_rent)}</td>
                    <td>
                      <span className="inline-flex items-center justify-center bg-gray-100 text-gray-700 rounded-full w-7 h-7 text-sm font-medium">
                        {tariff.tier_count || 0}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">
                      {tariff.effective_from ? new Date(tariff.effective_from).toLocaleDateString() : '-'}
                    </td>
                    <td>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${tariff.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {tariff.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openTiersModal(tariff)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="View Tiers"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(tariff)}
                          className="text-gray-600 hover:text-gray-800 p-1"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(tariff)}
                          className={`p-1 ${tariff.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}
                          title={tariff.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {tariff.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
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

      {/* View Tiers Modal */}
      {showTiersModal && selectedTariff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Tiers for {selectedTariff.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PROPERTY_TYPE_COLORS[selectedTariff.property_type] || 'bg-gray-100 text-gray-800'}`}>
                    {selectedTariff.property_type}
                  </span>
                </p>
              </div>
              <button onClick={closeTiersModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {tiersLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Loading tiers...</p>
                </div>
              ) : tiers.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No tiers configured</p>
                </div>
              ) : (
                <>
                  {/* Tiers Table */}
                  <table className="table mb-6">
                    <thead>
                      <tr>
                        <th>Tier #</th>
                        <th>Min Units</th>
                        <th>Max Units</th>
                        <th>Rate/Unit (KES)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((tier, idx) => (
                        <tr key={tier.id || idx}>
                          <td className="font-medium text-gray-900">{tier.tier_order || idx + 1}</td>
                          <td className="text-gray-700">{tier.min_consumption}</td>
                          <td className="text-gray-700">{tier.max_consumption}</td>
                          <td className="text-gray-700 font-medium">{formatCurrency(tier.rate_per_unit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Visual Tier Chart */}
                  <div className="border-t border-gray-200 pt-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Rate Progression</h3>
                    <div className="space-y-2">
                      {tiers.map((tier, idx) => {
                        const maxRate = Math.max(...tiers.map(t => parseFloat(t.rate_per_unit) || 0), 1)
                        const ratePercent = Math.max((parseFloat(tier.rate_per_unit) / maxRate) * 100, 8)
                        return (
                          <div key={tier.id || idx} className="flex items-center space-x-3">
                            <span className="text-xs text-gray-500 w-12 text-right">Tier {tier.tier_order || idx + 1}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                              <div
                                className={`h-full rounded-full ${TIER_BAR_COLORS[idx % TIER_BAR_COLORS.length]} transition-all duration-500`}
                                style={{ width: `${ratePercent}%` }}
                              />
                              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-800">
                                KES {formatCurrency(tier.rate_per_unit)} / unit
                              </span>
                            </div>
                            <span className="text-xs text-gray-400 w-28">
                              {tier.min_consumption} - {tier.max_consumption}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end p-6 border-t border-gray-200">
              <button onClick={closeTiersModal} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Tariff Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingTariff ? 'Edit Tariff' : 'Create New Tariff'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-5">
                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tariff Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      className={`input w-full ${formErrors.name ? 'border-red-500' : ''}`}
                      placeholder="e.g. Residential Tariff 2025"
                    />
                    {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property Type *</label>
                    <select
                      value={form.propertyType}
                      onChange={(e) => handleFormChange('propertyType', e.target.value)}
                      className="input w-full"
                    >
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="institutional">Institutional</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Effective From *</label>
                    <input
                      type="date"
                      value={form.effectiveFrom}
                      onChange={(e) => handleFormChange('effectiveFrom', e.target.value)}
                      className={`input w-full ${formErrors.effectiveFrom ? 'border-red-500' : ''}`}
                    />
                    {formErrors.effectiveFrom && <p className="text-xs text-red-500 mt-1">{formErrors.effectiveFrom}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Standing Charge (KES) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.standingCharge}
                      onChange={(e) => handleFormChange('standingCharge', e.target.value)}
                      className={`input w-full ${formErrors.standingCharge ? 'border-red-500' : ''}`}
                      placeholder="0.00"
                    />
                    {formErrors.standingCharge && <p className="text-xs text-red-500 mt-1">{formErrors.standingCharge}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sewerage Rate (%) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.sewerageRate}
                      onChange={(e) => handleFormChange('sewerageRate', e.target.value)}
                      className={`input w-full ${formErrors.sewerageRate ? 'border-red-500' : ''}`}
                      placeholder="0.00"
                    />
                    {formErrors.sewerageRate && <p className="text-xs text-red-500 mt-1">{formErrors.sewerageRate}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meter Rent (KES) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.meterRent}
                      onChange={(e) => handleFormChange('meterRent', e.target.value)}
                      className={`input w-full ${formErrors.meterRent ? 'border-red-500' : ''}`}
                      placeholder="0.00"
                    />
                    {formErrors.meterRent && <p className="text-xs text-red-500 mt-1">{formErrors.meterRent}</p>}
                  </div>
                </div>

                {/* Tier Builder */}
                <div className="border-t border-gray-200 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Pricing Tiers</h3>
                    <button
                      type="button"
                      onClick={addTier}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Tier</span>
                    </button>
                  </div>

                  {formErrors.tiers && typeof formErrors.tiers === 'string' && (
                    <p className="text-xs text-red-500 mb-2">{formErrors.tiers}</p>
                  )}

                  <div className="space-y-2">
                    {/* Tier Header */}
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                      <div className="col-span-1">#</div>
                      <div className="col-span-3">Min Consumption</div>
                      <div className="col-span-3">Max Consumption</div>
                      <div className="col-span-4">Rate per Unit (KES)</div>
                      <div className="col-span-1"></div>
                    </div>

                    {form.tiers.map((tier, idx) => {
                      const tierErrs = formErrors.tiers?.[idx] || {}
                      return (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-1 flex items-center justify-center h-10">
                            <span className="text-sm font-semibold text-gray-600">{idx + 1}</span>
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              step="0.01"
                              value={tier.minConsumption}
                              onChange={(e) => handleTierChange(idx, 'minConsumption', e.target.value)}
                              className={`input w-full text-sm ${tierErrs.minConsumption ? 'border-red-500' : ''}`}
                              placeholder="0"
                            />
                            {tierErrs.minConsumption && (
                              <p className="text-xs text-red-500 mt-0.5">{tierErrs.minConsumption}</p>
                            )}
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              step="0.01"
                              value={tier.maxConsumption}
                              onChange={(e) => handleTierChange(idx, 'maxConsumption', e.target.value)}
                              className={`input w-full text-sm ${tierErrs.maxConsumption ? 'border-red-500' : ''}`}
                              placeholder="0"
                            />
                            {tierErrs.maxConsumption && (
                              <p className="text-xs text-red-500 mt-0.5">{tierErrs.maxConsumption}</p>
                            )}
                          </div>
                          <div className="col-span-4">
                            <input
                              type="number"
                              step="0.01"
                              value={tier.ratePerUnit}
                              onChange={(e) => handleTierChange(idx, 'ratePerUnit', e.target.value)}
                              className={`input w-full text-sm ${tierErrs.ratePerUnit ? 'border-red-500' : ''}`}
                              placeholder="0.00"
                            />
                            {tierErrs.ratePerUnit && (
                              <p className="text-xs text-red-500 mt-0.5">{tierErrs.ratePerUnit}</p>
                            )}
                          </div>
                          <div className="col-span-1 flex items-center justify-center h-10">
                            {form.tiers.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeTier(idx)}
                                className="text-red-400 hover:text-red-600 p-1"
                                title="Remove tier"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Contiguity hint */}
                  <div className="mt-3 flex items-start space-x-2 text-xs text-gray-400">
                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>Tiers must be contiguous: tier N max consumption must equal tier N+1 min consumption.</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
                <button type="button" onClick={closeModal} className="btn btn-secondary">Cancel</button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary flex items-center space-x-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingTariff ? 'Update Tariff' : 'Create Tariff'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TariffPage
