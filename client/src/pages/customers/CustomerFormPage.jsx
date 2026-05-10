import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { ArrowLeft, Save, UserPlus } from 'lucide-react'
import api from '../../api/axios'

const emptyForm = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  idNumber: '',
  propertyType: 'residential',
  propertyName: '',
  address: '',
  zoneId: '',
  routeId: '',
  connectionDate: '',
  depositAmount: 0
}

const propertyTypes = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'institutional', label: 'Institutional' }
]

const CustomerFormPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditMode = !!id

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')

  // Fetch customer data in edit mode
  const { data: customerData, isLoading: loadingCustomer } = useQuery(
    ['customer', id],
    async () => {
      const response = await api.get(`/customers/${id}`)
      return response.data.data
    },
    { enabled: isEditMode }
  )

  // Fetch zones
  const { data: zonesData } = useQuery(
    ['zones'],
    async () => {
      const response = await api.get('/zones')
      return response.data.data
    }
  )

  // Fetch routes based on selected zone
  const { data: routesData } = useQuery(
    ['routes', form.zoneId],
    async () => {
      if (!form.zoneId) return []
      const response = await api.get(`/routes?zone=${form.zoneId}`)
      return response.data.data
    },
    { enabled: !!form.zoneId }
  )

  const zones = zonesData || []
  const routes = routesData || []

  // Populate form when customer data loads
  useEffect(() => {
    if (customerData) {
      setForm({
        firstName: customerData.firstName || '',
        lastName: customerData.lastName || '',
        phone: customerData.phone || '',
        email: customerData.email || '',
        idNumber: customerData.idNumber || '',
        propertyType: customerData.propertyType || 'residential',
        propertyName: customerData.propertyName || '',
        address: customerData.address || '',
        zoneId: customerData.zoneId || '',
        routeId: customerData.routeId || '',
        connectionDate: customerData.connectionDate
          ? customerData.connectionDate.split('T')[0]
          : '',
        depositAmount: customerData.depositAmount || 0
      })
    }
  }, [customerData])

  // Reset route when zone changes
  useEffect(() => {
    if (form.routeId && form.zoneId !== customerData?.zoneId) {
      setForm(prev => ({ ...prev, routeId: '' }))
    }
  }, [form.zoneId])

  const handleChange = (e) => {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    }))
    // Clear field error on change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required'
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required'
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required'
    if (!form.address.trim()) newErrors.address = 'Address is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/customers', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['customers'])
      const newId = response.data?.data?.id || response.data?.id
      navigate(`/customers/${newId}`)
    },
    onError: (error) => {
      setSubmitError(error.response?.data?.message || 'Failed to create customer')
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data) => api.put(`/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['customers'])
      queryClient.invalidateQueries(['customer', id])
      navigate(`/customers/${id}`)
    },
    onError: (error) => {
      setSubmitError(error.response?.data?.message || 'Failed to update customer')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitError('')

    if (!validate()) return

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      idNumber: form.idNumber.trim() || null,
      propertyType: form.propertyType,
      propertyName: form.propertyName.trim() || null,
      address: form.address.trim(),
      zoneId: form.zoneId || null,
      routeId: form.routeId || null,
      connectionDate: form.connectionDate || null,
      depositAmount: form.depositAmount || 0
    }

    if (isEditMode) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSubmitting = createMutation.isLoading || updateMutation.isLoading
  const isFormValid = form.firstName.trim() && form.lastName.trim() && form.phone.trim() && form.address.trim()

  if (isEditMode && loadingCustomer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          to={isEditMode ? `/customers/${id}` : '/customers'}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex items-center space-x-3">
          {isEditMode ? (
            <Save className="w-6 h-6 text-primary-600" />
          ) : (
            <UserPlus className="w-6 h-6 text-primary-600" />
          )}
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Customer' : 'New Customer'}
          </h1>
        </div>
      </div>

      {/* Error message */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Personal Information */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input
                type="text"
                name="firstName"
                className="input w-full"
                value={form.firstName}
                onChange={handleChange}
                placeholder="Enter first name"
              />
              {errors.firstName && (
                <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
              )}
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input
                type="text"
                name="lastName"
                className="input w-full"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Enter last name"
              />
              {errors.lastName && (
                <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
              )}
            </div>
            <div>
              <label className="label">Phone *</label>
              <input
                type="tel"
                name="phone"
                className="input w-full"
                value={form.phone}
                onChange={handleChange}
                placeholder="+254 7XX XXX XXX"
              />
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
              )}
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                name="email"
                className="input w-full"
                value={form.email}
                onChange={handleChange}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <label className="label">ID Number</label>
              <input
                type="text"
                name="idNumber"
                className="input w-full"
                value={form.idNumber}
                onChange={handleChange}
                placeholder="National ID number"
              />
            </div>
          </div>
        </div>

        {/* Property & Location */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Property & Location</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="label">Property Type *</label>
              <select
                name="propertyType"
                className="input w-full"
                value={form.propertyType}
                onChange={handleChange}
              >
                {propertyTypes.map(pt => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Property Name</label>
              <input
                type="text"
                name="propertyName"
                className="input w-full"
                value={form.propertyName}
                onChange={handleChange}
                placeholder="e.g. Sunrise Apartments"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="label">Address *</label>
              <textarea
                name="address"
                className="input w-full h-20"
                value={form.address}
                onChange={handleChange}
                placeholder="Full physical address"
              />
              {errors.address && (
                <p className="text-red-500 text-xs mt-1">{errors.address}</p>
              )}
            </div>
            <div>
              <label className="label">Zone</label>
              <select
                name="zoneId"
                className="input w-full"
                value={form.zoneId}
                onChange={handleChange}
              >
                <option value="">Select Zone</option>
                {zones.map(zone => (
                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Route</label>
              <select
                name="routeId"
                className="input w-full"
                value={form.routeId}
                onChange={handleChange}
                disabled={!form.zoneId}
              >
                <option value="">Select Route</option>
                {routes.map(route => (
                  <option key={route.id} value={route.id}>{route.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Connection Details */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection Details</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="label">Connection Date</label>
              <input
                type="date"
                name="connectionDate"
                className="input w-full"
                value={form.connectionDate}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="label">Deposit Amount (KES)</label>
              <input
                type="number"
                name="depositAmount"
                className="input w-full"
                value={form.depositAmount}
                onChange={handleChange}
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-3">
          <Link
            to={isEditMode ? `/customers/${id}` : '/customers'}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className="btn-primary inline-flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isEditMode ? 'Update Customer' : 'Create Customer'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CustomerFormPage
