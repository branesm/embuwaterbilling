import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Gauge,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  MapPin,
  X,
  ArrowRight,
  Repeat,
  Tool,
  Save,
  Loader2,
} from 'lucide-react'

const today = new Date().toISOString().split('T')[0]

const AddMeterModal = ({ onClose, onSuccess, meterTypes }) => {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState('single')
  const [form, setForm] = useState({
    customerId: '',
    serialNumber: '',
    meterTypeId: '',
    meterLocation: '',
    installDate: today,
    digits: 6,
    maxReading: '',
    condition: 'new',
    barcodeNo: '',
    supplier: '',
    manufactureDate: '',
    expectedYears: '',
    comments: ''
  })
  const [batch, setBatch] = useState({ prefix: '', from: '', to: '', suffix: '' })
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerOptions, setCustomerOptions] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomerOptions([])
      setShowDropdown(false)
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/customers?search=${encodeURIComponent(customerSearch)}&limit=10`)
        setCustomerOptions(res.data?.data || [])
        setShowDropdown(true)
      } catch {
        setCustomerOptions([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const createMeter = async (data) => {
    const res = await api.post('/meters', data)
    return res.data.data
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.meterTypeId) {
      setError('Meter type is required')
      return
    }
    if (mode === 'single') {
      if (!form.serialNumber.trim()) {
        setError('Serial number is required')
        return
      }
      setSaving(true)
      try {
        await createMeter({
          customer_id: selectedCustomer?.id || null,
          meter_no: form.serialNumber,
          meter_type_id: form.meterTypeId,
          meter_location: form.meterLocation,
          install_date: form.installDate,
          digits: form.digits,
          max_reading: form.maxReading || null,
          condition: form.condition,
          barcode_no: form.barcodeNo,
          supplier: form.supplier,
          manufacture_date: form.manufactureDate || null,
          expected_years: form.expectedYears || null,
          comments: form.comments || null
        })
        toast.success('Meter created successfully')
        queryClient.invalidateQueries('meters')
        onSuccess()
        onClose()
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to add meter')
      } finally {
        setSaving(false)
      }
      return
    }

    if (mode === 'batch') {
      if (!batch.prefix.trim() || !batch.from || !batch.to) {
        setError('Batch prefix and range are required')
        return
      }
      const start = parseInt(batch.from, 10)
      const end = parseInt(batch.to, 10)
      if (isNaN(start) || isNaN(end) || end < start) {
        setError('Invalid batch range')
        return
      }
      setSaving(true)
      try {
        const promises = []
        for (let i = start; i <= end; i += 1) {
          const meterNo = `${batch.prefix}${i}${batch.suffix}`
          promises.push(createMeter({
            customer_id: selectedCustomer?.id || null,
            meter_no: meterNo,
            meter_type_id: form.meterTypeId,
            meter_location: form.meterLocation,
            install_date: form.installDate,
            digits: form.digits,
            max_reading: form.maxReading || null,
            condition: form.condition,
            barcode_no: form.barcodeNo,
            supplier: form.supplier,
            manufacture_date: form.manufactureDate || null,
            expected_years: form.expectedYears || null,
            comments: form.comments || null
          }))
        }
        await Promise.all(promises)
        toast.success(`Created ${end - start + 1} meters`)
        queryClient.invalidateQueries('meters')
        onSuccess()
        onClose()
      } catch (err) {
        setError(err?.response?.data?.message || 'Batch creation failed')
      } finally {
        setSaving(false)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Register Meter</h2>
            <p className="text-sm text-gray-500">Create single meters or batch register using range suffixes.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`rounded-full px-4 py-2 text-sm font-medium ${mode === 'single' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`rounded-full px-4 py-2 text-sm font-medium ${mode === 'batch' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Batch
            </button>
          </div>

          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                className="input pl-10 w-full"
                placeholder="Search customer..."
                value={selectedCustomer ? `${selectedCustomer.account_number} — ${selectedCustomer.first_name} ${selectedCustomer.last_name}` : customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null) }}
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
            {showDropdown && customerOptions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {customerOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b last:border-b-0"
                    onClick={() => {
                      setSelectedCustomer(c)
                      setCustomerSearch('')
                      setShowDropdown(false)
                    }}
                  >
                    <span className="font-medium text-blue-700">{c.account_number}</span>
                    {' — '}{c.first_name} {c.last_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {mode === 'single' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meter Number</label>
              <input
                type="text"
                className="input w-full"
                placeholder="MTR-2026-1001"
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prefix</label>
                <input
                  className="input w-full"
                  value={batch.prefix}
                  onChange={(e) => setBatch({ ...batch, prefix: e.target.value })}
                  placeholder="MTR-2026-"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <input
                  type="number"
                  className="input w-full"
                  value={batch.from}
                  onChange={(e) => setBatch({ ...batch, from: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="number"
                  className="input w-full"
                  value={batch.to}
                  onChange={(e) => setBatch({ ...batch, to: e.target.value })}
                />
              </div>
              <div className="lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Suffix</label>
                <input
                  className="input w-full"
                  value={batch.suffix}
                  onChange={(e) => setBatch({ ...batch, suffix: e.target.value })}
                  placeholder="-A"
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meter Type</label>
              <select
                className="input w-full"
                value={form.meterTypeId}
                onChange={(e) => setForm({ ...form, meterTypeId: e.target.value })}
              >
                <option value="">Select meter type</option>
                {meterTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.type_id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                className="input w-full"
                value={form.meterLocation}
                onChange={(e) => setForm({ ...form, meterLocation: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Install Date</label>
              <input
                type="date"
                className="input w-full"
                value={form.installDate}
                onChange={(e) => setForm({ ...form, installDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Digits</label>
              <input
                type="number"
                className="input w-full"
                min="0"
                value={form.digits}
                onChange={(e) => setForm({ ...form, digits: parseInt(e.target.value, 10) || 6 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Reading</label>
              <input
                type="number"
                className="input w-full"
                value={form.maxReading}
                onChange={(e) => setForm({ ...form, maxReading: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
              <select
                className="input w-full"
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
              >
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="faulty">Faulty</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <input
                className="input w-full"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Years</label>
              <input
                type="number"
                className="input w-full"
                value={form.expectedYears}
                onChange={(e) => setForm({ ...form, expectedYears: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
            <textarea
              className="input w-full min-h-[100px] resize-none"
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex items-center space-x-2"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>{mode === 'single' ? 'Add Meter' : 'Create Batch'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const EditMeterModal = ({ meter, onClose, onSuccess, meterTypes }) => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    meter_no: meter?.meter_no || '',
    meter_type_id: meter?.meter_type_id || '',
    meter_status: meter?.meter_status || 'in_store',
    meter_location: meter?.meter_location || '',
    install_date: meter?.install_date || '',
    barcode_no: meter?.barcode_no || '',
    digits: meter?.digits || 6,
    max_reading: meter?.max_reading || '',
    condition: meter?.condition || 'new',
    supplier: meter?.supplier || '',
    manufacture_date: meter?.manufacture_date || '',
    expected_years: meter?.expected_years || '',
    comments: meter?.comments || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.put(`/meters/${meter.id}`, form)
      toast.success('Meter updated successfully')
      queryClient.invalidateQueries('meters')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Meter</h2>
            <p className="text-sm text-gray-500">Modify meter details, status, and assignment.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meter Number</label>
              <input
                className="input w-full"
                value={form.meter_no}
                onChange={(e) => setForm({ ...form, meter_no: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meter Type</label>
              <select
                className="input w-full"
                value={form.meter_type_id}
                onChange={(e) => setForm({ ...form, meter_type_id: e.target.value })}
              >
                <option value="">Select type</option>
                {meterTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.type_id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                className="input w-full"
                value={form.meter_status}
                onChange={(e) => setForm({ ...form, meter_status: e.target.value })}
              >
                <option value="in_store">In Store</option>
                <option value="active">Active</option>
                <option value="faulty">Faulty</option>
                <option value="inactive">Inactive</option>
                <option value="removed">Removed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                className="input w-full"
                value={form.meter_location}
                onChange={(e) => setForm({ ...form, meter_location: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Install Date</label>
              <input
                type="date"
                className="input w-full"
                value={form.install_date || ''}
                onChange={(e) => setForm({ ...form, install_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
              <input
                className="input w-full"
                value={form.barcode_no}
                onChange={(e) => setForm({ ...form, barcode_no: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Digits</label>
              <input
                type="number"
                className="input w-full"
                value={form.digits}
                onChange={(e) => setForm({ ...form, digits: parseInt(e.target.value, 10) || 6 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Reading</label>
              <input
                type="number"
                className="input w-full"
                value={form.max_reading}
                onChange={(e) => setForm({ ...form, max_reading: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
              <select
                className="input w-full"
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
              >
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="faulty">Faulty</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <input
                className="input w-full"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacture Date</label>
              <input
                type="date"
                className="input w-full"
                value={form.manufacture_date || ''}
                onChange={(e) => setForm({ ...form, manufacture_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Years</label>
              <input
                type="number"
                className="input w-full"
                value={form.expected_years}
                onChange={(e) => setForm({ ...form, expected_years: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
            <textarea
              className="input w-full min-h-[100px] resize-none"
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary flex items-center space-x-2" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Save</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const MeterMovementsTab = () => {
  const [search, setSearch] = useState('')
  const [selectedMeter, setSelectedMeter] = useState(null)
  const [movementType, setMovementType] = useState('issue')
  const [toStatus, setToStatus] = useState('active')
  const [referenceNo, setReferenceNo] = useState('')
  const [comments, setComments] = useState('')
  const [movementFilter, setMovementFilter] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerOptions, setCustomerOptions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomerOptions([])
      setShowDropdown(false)
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/customers?search=${encodeURIComponent(customerSearch)}&limit=10`)
        setCustomerOptions(res.data?.data || [])
        setShowDropdown(true)
      } catch {
        setCustomerOptions([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  useEffect(() => {
    if (selectedMeter) {
      setLoadingHistory(true)
      api.get(`/meters/${selectedMeter.id}/movements`)
        .then((res) => setHistory(res.data?.data || []))
        .catch(() => setHistory([]))
        .finally(() => setLoadingHistory(false))
    }
  }, [selectedMeter])

  const handleSearch = async () => {
    if (search.length < 2) return
    try {
      const res = await api.get(`/meters?q=${encodeURIComponent(search)}&limit=20`)
      return res.data?.data || []
    } catch {
      return []
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedMeter) {
      setError('Select a meter first')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.post(`/meters/${selectedMeter.id}/movement`, {
        movement_type: movementType,
        to_customer_id: selectedCustomer?.id || null,
        to_status: toStatus,
        reference_no: referenceNo,
        comments
      })
      toast.success('Movement recorded')
      setReferenceNo('')
      setComments('')
      setSelectedCustomer(null)
      setMovementType('issue')
      const refresh = await api.get(`/meters/${selectedMeter.id}/movements`)
      setHistory(refresh.data?.data || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to record movement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Meter Movement</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lookup Meter</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Type meter number or customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button type="button" className="btn btn-secondary" onClick={async () => {
                  const results = await handleSearch()
                  if (results.length === 1) {
                    setSelectedMeter(results[0])
                  } else {
                    toast('Please refine your search and choose one meter', { icon: '🔎' })
                  }
                }}>
                  Search
                </button>
              </div>
            </div>
            {selectedMeter && (
              <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-500">Selected Meter</p>
                <p className="font-semibold text-gray-900">{selectedMeter.meter_no}</p>
                <p className="text-sm text-gray-700">Status: {selectedMeter.meter_status}</p>
                <p className="text-sm text-gray-700">Location: {selectedMeter.meter_location || 'N/A'}</p>
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Movement Type</label>
                <select className="input w-full" value={movementType} onChange={(e) => setMovementType(e.target.value)}>
                  <option value="issue">Meter Issue</option>
                  <option value="re_issue">Meter Re-Issue</option>
                  <option value="return_to_store">Return to Store</option>
                  <option value="installation">Installation</option>
                  <option value="removal">Removal</option>
                  <option value="transfer">InterSection Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                <select className="input w-full" value={toStatus} onChange={(e) => setToStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="in_store">In Store</option>
                  <option value="faulty">Faulty</option>
                  <option value="inactive">Inactive</option>
                  <option value="removed">Removed</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Customer (optional)</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Search customer for installation/transfer"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              {showDropdown && customerOptions.length > 0 && (
                <div className="mt-1 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm max-h-44">
                  {customerOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50"
                      onClick={() => {
                        setSelectedCustomer(c)
                        setCustomerSearch('')
                        setShowDropdown(false)
                      }}
                    >
                      <span className="font-medium">{c.account_number}</span>
                      {' — '}{c.first_name} {c.last_name}
                    </button>
                  ))}
                </div>
              )}
              {selectedCustomer && (
                <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Selected: {selectedCustomer.account_number} — {selectedCustomer.first_name} {selectedCustomer.last_name}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference No</label>
              <input
                className="input w-full"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
              <textarea
                className="input w-full min-h-[100px] resize-none"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                className="btn btn-primary flex items-center space-x-2"
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>Record Movement</span>
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Movement History</h2>
              <p className="text-sm text-gray-500">Review meter movements for the selected asset.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Filter</span>
              <select className="input text-sm" value={movementFilter} onChange={(e) => setMovementFilter(e.target.value)}>
                <option value="">All</option>
                <option value="issue">Issue</option>
                <option value="re_issue">Re-Issue</option>
                <option value="return_to_store">Return to Store</option>
                <option value="installation">Installation</option>
                <option value="removal">Removal</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
          </div>
          {loadingHistory ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : history.length === 0 ? (
            <p className="text-gray-500">No movement history available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Status</th>
                    <th>Reference</th>
                    <th>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {history
                    .filter((item) => !movementFilter || item.movement_type === movementFilter)
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td>{new Date(item.movement_date).toLocaleDateString()}</td>
                        <td className="capitalize">{item.movement_type.replace(/_/g, ' ')}</td>
                        <td>{item.from_customer_name || 'N/A'}</td>
                        <td>{item.to_customer_name || 'N/A'}</td>
                        <td>{item.to_status || item.from_status}</td>
                        <td>{item.reference_no || '—'}</td>
                        <td>{item.comments || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const MeterServicingTab = () => {
  const [search, setSearch] = useState('')
  const [selectedMeter, setSelectedMeter] = useState(null)
  const [serviceForm, setServiceForm] = useState({
    serviced_by: '',
    reading: '',
    service_date: today,
    meter_status: 'active',
    comments: ''
  })
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [userOptions, setUserOptions] = useState([])

  useEffect(() => {
    api.get('/users?limit=100')
      .then((res) => setUserOptions(res.data?.data || []))
      .catch(() => setUserOptions([]))
  }, [])

  useEffect(() => {
    if (selectedMeter) {
      setLoadingHistory(true)
      api.get(`/meters/${selectedMeter.id}/servicing`)
        .then((res) => setHistory(res.data?.data || []))
        .catch(() => setHistory([]))
        .finally(() => setLoadingHistory(false))
    }
  }, [selectedMeter])

  const handleMeterSelect = async () => {
    if (search.length < 2) return
    try {
      const res = await api.get(`/meters?q=${encodeURIComponent(search)}&limit=20`)
      const list = res.data?.data || []
      if (list.length === 1) {
        setSelectedMeter(list[0])
      } else {
        toast('Please refine your search and choose one meter', { icon: '🔎' })
      }
    } catch {
      toast.error('Meter lookup failed')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedMeter) {
      setError('Select a meter first')
      return
    }
    if (!serviceForm.serviced_by) {
      setError('Select service technician')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.post(`/meters/${selectedMeter.id}/servicing`, {
        serviced_by: serviceForm.serviced_by,
        reading: serviceForm.reading,
        service_date: serviceForm.service_date,
        meter_status: serviceForm.meter_status,
        comments: serviceForm.comments
      })
      toast.success('Service record saved')
      setServiceForm((prev) => ({ ...prev, reading: '', comments: '' }))
      const refresh = await api.get(`/meters/${selectedMeter.id}/servicing`)
      setHistory(refresh.data?.data || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to record service')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Meter Servicing</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meter Lookup</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Meter number or customer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn btn-secondary" onClick={handleMeterSelect}>
                Search
              </button>
            </div>
          </div>

          {selectedMeter && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Selected meter</p>
              <p className="font-semibold text-gray-900">{selectedMeter.meter_no}</p>
              <p className="text-sm text-gray-700">Status: {selectedMeter.meter_status}</p>
              <p className="text-sm text-gray-700">Customer: {selectedMeter.customer_name || 'Unassigned'}</p>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Serviced By</label>
              <select
                className="input w-full"
                value={serviceForm.serviced_by}
                onChange={(e) => setServiceForm({ ...serviceForm, serviced_by: e.target.value })}
              >
                <option value="">Select technician</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>{user.username}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Date</label>
              <input
                type="date"
                className="input w-full"
                value={serviceForm.service_date}
                onChange={(e) => setServiceForm({ ...serviceForm, service_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meter Reading</label>
              <input
                type="number"
                className="input w-full"
                value={serviceForm.reading}
                onChange={(e) => setServiceForm({ ...serviceForm, reading: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meter Status</label>
              <select
                className="input w-full"
                value={serviceForm.meter_status}
                onChange={(e) => setServiceForm({ ...serviceForm, meter_status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="faulty">Faulty</option>
                <option value="inactive">Inactive</option>
                <option value="in_store">In Store</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
            <textarea
              className="input w-full min-h-[100px] resize-none"
              value={serviceForm.comments}
              onChange={(e) => setServiceForm({ ...serviceForm, comments: e.target.value })}
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary flex items-center gap-2"
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tool className="w-4 h-4" />}
              <span>Record Service</span>
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Servicing History</h2>
        {loadingHistory ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : history.length === 0 ? (
          <p className="text-gray-500">No servicing records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Serviced By</th>
                  <th>Reading</th>
                  <th>Status</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td>{new Date(entry.service_date).toLocaleDateString()}</td>
                    <td>{entry.serviced_by_name || '—'}</td>
                    <td>{entry.reading || '—'}</td>
                    <td>{entry.meter_status || '—'}</td>
                    <td>{entry.comments || '—'}</td>
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

const MeterTypesTab = () => {
  const queryClient = useQueryClient()
  const { data: typesData = [], isLoading } = useQuery('meterTypes', async () => {
    const res = await api.get('/meters/types')
    return res.data?.data || []
  }, { staleTime: 60000 })

  const [form, setForm] = useState({
    type_id: '',
    manufacturer: '',
    category: '',
    model: '',
    meter_size: '',
    normal_consumption: '',
    number_of_digits: 6,
    tariff_for_rent: '',
    rent_value: '',
    expected_years: ''
  })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleEdit = (type) => {
    setEditingId(type.id)
    setForm({
      type_id: type.type_id,
      manufacturer: type.manufacturer || '',
      category: type.category || '',
      model: type.model || '',
      meter_size: type.meter_size || '',
      normal_consumption: type.normal_consumption || '',
      number_of_digits: type.number_of_digits || 6,
      tariff_for_rent: type.tariff_for_rent || '',
      rent_value: type.rent_value || '',
      expected_years: type.expected_years || ''
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/meters/types/${editingId}`, form)
        toast.success('Meter type updated')
      } else {
        await api.post('/meters/types', form)
        toast.success('Meter type created')
      }
      queryClient.invalidateQueries('meterTypes')
      setForm({ type_id: '', manufacturer: '', category: '', model: '', meter_size: '', normal_consumption: '', number_of_digits: 6, tariff_for_rent: '', rent_value: '', expected_years: '' })
      setEditingId(null)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save meter type')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Meter Type Maintenance</h2>
            <p className="text-sm text-gray-500">Add or edit meter type definitions used by inventory.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary flex items-center gap-2"
            onClick={() => { setEditingId(null); setForm({ type_id: '', manufacturer: '', category: '', model: '', meter_size: '', normal_consumption: '', number_of_digits: 6, tariff_for_rent: '', rent_value: '', expected_years: '' }) }}
          >
            <Repeat className="w-4 h-4" />
            Reset Form
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type ID</label>
            <input className="input w-full" value={form.type_id} onChange={(e) => setForm({ ...form, type_id: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
            <input className="input w-full" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input className="input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input className="input w-full" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meter Size</label>
            <input className="input w-full" value={form.meter_size} onChange={(e) => setForm({ ...form, meter_size: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Normal Consumption</label>
            <input type="number" className="input w-full" value={form.normal_consumption} onChange={(e) => setForm({ ...form, normal_consumption: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Digits</label>
            <input type="number" className="input w-full" value={form.number_of_digits} onChange={(e) => setForm({ ...form, number_of_digits: parseInt(e.target.value, 10) || 6 })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tariff for Rent</label>
            <input type="number" className="input w-full" value={form.tariff_for_rent} onChange={(e) => setForm({ ...form, tariff_for_rent: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rent Value</label>
            <input type="number" className="input w-full" value={form.rent_value} onChange={(e) => setForm({ ...form, rent_value: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Years</label>
            <input type="number" className="input w-full" value={form.expected_years} onChange={(e) => setForm({ ...form, expected_years: e.target.value })} />
          </div>
          {error && <div className="text-sm text-red-600 lg:col-span-2">{error}</div>}
          <div className="lg:col-span-2 flex justify-end gap-3">
            <button type="submit" className="btn btn-primary flex items-center gap-2" disabled={saving}>
              <Save className="w-4 h-4" />
              <span>{editingId ? 'Update Type' : 'Create Type'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Existing Meter Types</h2>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : typesData.length === 0 ? (
          <p className="text-gray-500">No meter types defined yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Type ID</th>
                  <th>Manufacturer</th>
                  <th>Category</th>
                  <th>Model</th>
                  <th>Size</th>
                  <th>Rent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {typesData.map((type) => (
                  <tr key={type.id} className="hover:bg-gray-50">
                    <td>{type.type_id}</td>
                    <td>{type.manufacturer || '—'}</td>
                    <td>{type.category || '—'}</td>
                    <td>{type.model || '—'}</td>
                    <td>{type.meter_size || '—'}</td>
                    <td>{type.tariff_for_rent ? `KES ${parseFloat(type.tariff_for_rent).toLocaleString()}` : '—'}</td>
                    <td>
                      <button type="button" className="text-blue-600 hover:text-blue-800 text-sm" onClick={() => handleEdit(type)}>
                        Edit
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

const MasterMetersTab = () => {
  const queryClient = useQueryClient()
  const { data: masterMetersData = [], isLoading } = useQuery('masterMeters', async () => {
    const res = await api.get('/meters/master-meters')
    return res.data?.data || []
  }, { staleTime: 60000 })

  const { data: dmaRegions = [] } = useQuery('dmaRegions', async () => {
    const res = await api.get('/meters/dma-regions')
    return res.data?.data || []
  }, { staleTime: 60000 })

  const [form, setForm] = useState({
    serial_no: '',
    location: '',
    meter_size: '',
    meter_status: 'active',
    install_date: today,
    northings: '',
    eastings: '',
    height: '',
    inflow_dma_id: '',
    outflow_dma_id: ''
  })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleEdit = (meter) => {
    setEditingId(meter.id)
    setForm({
      serial_no: meter.serial_no,
      location: meter.location || '',
      meter_size: meter.meter_size || '',
      meter_status: meter.meter_status || 'active',
      install_date: meter.install_date || today,
      northings: meter.northings || '',
      eastings: meter.eastings || '',
      height: meter.height || '',
      inflow_dma_id: meter.inflow_dma_id || '',
      outflow_dma_id: meter.outflow_dma_id || ''
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editingId) {
        await api.put(`/meters/master-meters/${editingId}`, form)
        toast.success('Master meter updated')
      } else {
        await api.post('/meters/master-meters', form)
        toast.success('Master meter created')
      }
      queryClient.invalidateQueries('masterMeters')
      setForm({ serial_no: '', location: '', meter_size: '', meter_status: 'active', install_date: today, northings: '', eastings: '', height: '', inflow_dma_id: '', outflow_dma_id: '' })
      setEditingId(null)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save master meter')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Master Meters (NRW)</h2>
            <p className="text-sm text-gray-500">Maintain master meter records for DMA flow monitoring.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary flex items-center gap-2"
            onClick={() => { setEditingId(null); setForm({ serial_no: '', location: '', meter_size: '', meter_status: 'active', install_date: today, northings: '', eastings: '', height: '', inflow_dma_id: '', outflow_dma_id: '' }) }}
          >
            <Repeat className="w-4 h-4" />
            Reset
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serial No</label>
            <input className="input w-full" value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input className="input w-full" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meter Size</label>
            <input className="input w-full" value={form.meter_size} onChange={(e) => setForm({ ...form, meter_size: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select className="input w-full" value={form.meter_status} onChange={(e) => setForm({ ...form, meter_status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Install Date</label>
            <input type="date" className="input w-full" value={form.install_date} onChange={(e) => setForm({ ...form, install_date: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Northings</label>
            <input className="input w-full" value={form.northings} onChange={(e) => setForm({ ...form, northings: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Eastings</label>
            <input className="input w-full" value={form.eastings} onChange={(e) => setForm({ ...form, eastings: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
            <input className="input w-full" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Inflow DMA</label>
            <select className="input w-full" value={form.inflow_dma_id} onChange={(e) => setForm({ ...form, inflow_dma_id: e.target.value })}>
              <option value="">Select DMA</option>
              {dmaRegions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Outflow DMA</label>
            <select className="input w-full" value={form.outflow_dma_id} onChange={(e) => setForm({ ...form, outflow_dma_id: e.target.value })}>
              <option value="">Select DMA</option>
              {dmaRegions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          {error && <div className="text-sm text-red-600 lg:col-span-3">{error}</div>}
          <div className="lg:col-span-3 flex justify-end">
            <button type="submit" className="btn btn-primary flex items-center gap-2" disabled={saving}>
              <Save className="w-4 h-4" />
              <span>{editingId ? 'Update Master Meter' : 'Create Master Meter'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Master Meter Records</h2>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : masterMetersData.length === 0 ? (
          <p className="text-gray-500">No master meters have been registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Serial No</th>
                  <th>Location</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Inflow DMA</th>
                  <th>Outflow DMA</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {masterMetersData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td>{item.serial_no}</td>
                    <td>{item.location || '—'}</td>
                    <td>{item.meter_size || '—'}</td>
                    <td>{item.meter_status}</td>
                    <td>{item.inflow_dma_name || '—'}</td>
                    <td>{item.outflow_dma_name || '—'}</td>
                    <td>
                      <button type="button" className="text-blue-600 hover:text-blue-800 text-sm" onClick={() => handleEdit(item)}>
                        Edit
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

const MeterListPage = () => {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab')
    return ['inventory', 'movements', 'servicing', 'types', 'master'].includes(tabParam)
      ? tabParam
      : 'inventory'
  })
  const [filters, setFilters] = useState({ status: '', search: '', type: '', location: '' })
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedMeter, setSelectedMeter] = useState(null)

  const { data: meterTypes = [] } = useQuery('meterTypesAll', async () => {
    const res = await api.get('/meters/types/all')
    return res.data?.data || []
  }, { staleTime: 60000 })

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab')
    if (tab && ['inventory', 'movements', 'servicing', 'types', 'master'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [location.search])

  const {
    data: metersData,
    isLoading,
    refetch,
  } = useQuery(
    ['meters', filters, page],
    async () => {
      const params = new URLSearchParams()
      if (filters.search) params.append('q', filters.search)
      if (filters.status) params.append('status', filters.status)
      if (filters.type) params.append('meter_type_id', filters.type)
      if (filters.location) params.append('meter_location', filters.location)
      params.append('page', page.toString())
      params.append('limit', '20')
      const response = await api.get(`/meters?${params.toString()}`)
      return response.data
    },
    { keepPreviousData: true }
  )

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'faulty':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'inactive':
        return <XCircle className="w-5 h-5 text-gray-400" />
      default:
        return <Gauge className="w-5 h-5 text-blue-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'faulty':
        return 'bg-red-100 text-red-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'in_store':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const meters = metersData?.data || []
  const pagination = metersData?.pagination

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab')
    if (tab && ['inventory', 'movements', 'servicing', 'types', 'master'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [location.search])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meter Management</h1>
          <p className="text-gray-500 mt-1">Register meters, track movements, service equipment, and maintain types.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center justify-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Meter</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'inventory', label: 'Inventory' },
          { id: 'movements', label: 'Movements' },
          { id: 'servicing', label: 'Servicing' },
          { id: 'types', label: 'Meter Types' },
          { id: 'master', label: 'Master Meters' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === tab.id ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'inventory' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Meters', value: pagination?.total || 0, color: 'bg-blue-50 border-blue-200' },
              { label: 'Active', value: meters.filter(m => m.meter_status === 'active').length, color: 'bg-green-50 border-green-200' },
              { label: 'Faulty', value: meters.filter(m => m.meter_status === 'faulty').length, color: 'bg-red-50 border-red-200' },
              { label: 'In Store', value: meters.filter(m => m.meter_status === 'in_store').length, color: 'bg-gray-50 border-gray-200' }
            ].map((stat, index) => (
              <div key={index} className={`card ${stat.color}`}>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr_1fr_0.8fr]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search meters by number, type, location..."
                  className="input pl-10 w-full"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              <select
                className="input w-full"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="faulty">Faulty</option>
                <option value="inactive">Inactive</option>
                <option value="in_store">In Store</option>
              </select>
              <select
                className="input w-full"
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              >
                <option value="">All Types</option>
                {meterTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.type_id}</option>
                ))}
              </select>
              <button
                onClick={() => refetch()}
                className="btn btn-secondary flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          <div className="card">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading meters...</p>
              </div>
            ) : meters.length === 0 ? (
              <div className="text-center py-12">
                <Gauge className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No meters found</p>
                <p className="text-sm text-gray-400 mt-1">Add meters or refine your search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Meter No</th>
                      <th>Customer</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Location</th>
                      <th>Install Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meters.map((meter) => (
                      <tr key={meter.id} className="hover:bg-gray-50">
                        <td>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(meter.meter_status)}
                            <span className="font-medium text-gray-900">{meter.meter_no}</span>
                          </div>
                        </td>
                        <td>
                          {meter.customer_name ? (
                            <div>
                              <div className="text-sm text-gray-900">{meter.customer_name}</div>
                              <div className="text-xs text-gray-500">{meter.account_no}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td>{meter.meter_type_name || 'N/A'}</td>
                        <td>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(meter.meter_status)}`}>
                            {meter.meter_status}
                          </span>
                        </td>
                        <td>{meter.meter_location || '—'}</td>
                        <td>{meter.install_date ? new Date(meter.install_date).toLocaleDateString() : '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            onClick={() => setSelectedMeter(meter)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">
                  Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total} meters
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="btn btn-secondary text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'movements' && <MeterMovementsTab />}
      {activeTab === 'servicing' && <MeterServicingTab />}
      {activeTab === 'types' && <MeterTypesTab />}
      {activeTab === 'master' && <MasterMetersTab />}

      {showAddModal && <AddMeterModal onClose={() => setShowAddModal(false)} onSuccess={() => setShowAddModal(false)} meterTypes={meterTypes} />}
      {selectedMeter && <EditMeterModal meter={selectedMeter} onClose={() => setSelectedMeter(null)} onSuccess={() => setSelectedMeter(null)} meterTypes={meterTypes} />}
    </div>
  )
}

export default MeterListPage
