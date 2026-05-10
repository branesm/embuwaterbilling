import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ArrowLeft, Save, Upload, AlertTriangle } from 'lucide-react'

export default function CustomerCreatePage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null)

  const [formData, setFormData] = useState<any>({
    account_no: '', conn_no: '', name: '', first_name: '', last_name: '',
    national_id: '', kra_pin: '', telephone: '', email: '',
    address: '', town: '', po_box: '', plot_no: '', house_no: '', estate: '', walk_no: '',
    landlord_name: '', employer_cert: '', comments: '',
    application_date: new Date().toISOString().split('T')[0],
    deposit_amount: '', charge_refuse: false,
    connected_to_sewer: false, managed_by_ewasco: true,
    latitude: '', longitude: '',
    customer_type_id: '', category_id: '', typology_id: '',
    billing_group_id: '', route_id: '', zone_id: '',
    company_id: '', bill_dispatch_method_id: '', disconnection_profile_id: '',
  })

  const [files, setFiles] = useState({
    id_copy: null as File | null,
    kra_pin_certificate: null as File | null,
    plot_copy_or_letter: null as File | null,
  })

  // Lookup data queries
  const { data: customerTypes } = useQuery({
    queryKey: ['lookup-customer-types'],
    queryFn: async () => { const res = await api.get('/customers/lookup/customer-types'); return res.data.data }
  })
  const { data: companies } = useQuery({
    queryKey: ['lookup-companies'],
    queryFn: async () => { const res = await api.get('/customers/lookup/companies'); return res.data.data }
  })
  const { data: dispatchMethods } = useQuery({
    queryKey: ['lookup-dispatch-methods'],
    queryFn: async () => { const res = await api.get('/customers/lookup/bill-dispatch-methods'); return res.data.data }
  })
  const { data: categories } = useQuery({
    queryKey: ['lookup-categories'],
    queryFn: async () => { const res = await api.get('/parameters/customer-categories'); return res.data.data }
  })
  const { data: billingGroups } = useQuery({
    queryKey: ['lookup-billing-groups'],
    queryFn: async () => { const res = await api.get('/parameters/billing-groups'); return res.data.data }
  })
  const { data: zones } = useQuery({
    queryKey: ['lookup-zones'],
    queryFn: async () => { const res = await api.get('/parameters/zones'); return res.data.data }
  })
  const { data: routes } = useQuery({
    queryKey: ['lookup-routes'],
    queryFn: async () => { const res = await api.get('/parameters/billing-routes'); return res.data.data }
  })
  const { data: typologies } = useQuery({
    queryKey: ['lookup-typologies'],
    queryFn: async () => { const res = await api.get('/parameters/customer-typologies'); return res.data.data }
  })
  const { data: discProfiles } = useQuery({
    queryKey: ['lookup-disc-profiles'],
    queryFn: async () => { const res = await api.get('/disconnections/profiles'); return res.data.data }
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: (e.target as HTMLInputElement).checked })
    } else {
      setFormData({ ...formData, [name]: value })
    }
    setDuplicateWarning(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [field]: e.target.files[0] })
    }
  }

  const checkDuplicates = async () => {
    if (!formData.national_id && !formData.plot_no && !formData.kra_pin) return
    try {
      const res = await api.post('/customers/check-duplicates', {
        national_id: formData.national_id || undefined,
        plot_no: formData.plot_no || undefined,
        kra_pin: formData.kra_pin || undefined,
      })
      if (res.data.hasDuplicates) {
        setDuplicateWarning(res.data.duplicates[0])
      } else {
        setDuplicateWarning(null)
      }
    } catch (err) { /* ignore */ }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setDuplicateWarning(null)

    try {
      const data = new FormData()
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          data.append(key, String(value))
        }
      })
      if (files.id_copy) data.append('id_copy', files.id_copy)
      if (files.kra_pin_certificate) data.append('kra_pin_certificate', files.kra_pin_certificate)
      if (files.plot_copy_or_letter) data.append('plot_copy_or_letter', files.plot_copy_or_letter)

      const res = await api.post('/customers', data)
      if (res.data.success) {
        navigate(`/customers/${res.data.data.id}`)
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create customer'
      if (err.response?.status === 409) {
        setDuplicateWarning(err.response?.data?.duplicate)
      }
      alert(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"
  const requiredLabel = (text: string) => <label className={labelClass}>{text} <span className="text-red-500">*</span></label>

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Application</h1>
          <p className="text-gray-500">New water connection application</p>
        </div>
      </div>

      {duplicateWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              A customer with this {duplicateWarning.field?.replace('_', ' ')} already exists
            </p>
            <p className="text-sm text-amber-700 mt-1">
              {duplicateWarning.customer?.account_no} — {duplicateWarning.customer?.name}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* Customer Type */}
        <div>
          <label className={labelClass}>Type of Customer</label>
          <select name="customer_type_id" value={formData.customer_type_id} onChange={handleChange} className={inputClass}>
            <option value="">Select Type</option>
            {customerTypes?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Names */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            {requiredLabel('Customer Name')}
            <input name="name" value={formData.name} onChange={handleChange} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>LandLord Name</label>
            <input name="landlord_name" value={formData.landlord_name} onChange={handleChange} className={inputClass} />
          </div>
        </div>

        {/* Address & Contact */}
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Billing Postal Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>P. O. Box</label>
              <input name="po_box" value={formData.po_box} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Town</label>
              <input name="town" value={formData.town} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Hse.No / Estate</label>
              <input name="house_no" value={formData.house_no} onChange={handleChange} className={inputClass} placeholder="House No" />
              <input name="estate" value={formData.estate} onChange={handleChange} className={`${inputClass} mt-2`} placeholder="Estate" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Address</label>
              <input name="address" value={formData.address} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              {requiredLabel('Plot No.')}
              <input name="plot_no" value={formData.plot_no} onChange={handleChange} onBlur={checkDuplicates} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Walk Number</label>
              <input name="walk_no" value={formData.walk_no} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Email</label>
              <input name="email" type="email" value={formData.email} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              {requiredLabel('Telephone')}
              <input name="telephone" value={formData.telephone} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Employer Cert.</label>
              <input name="employer_cert" value={formData.employer_cert} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Application Details */}
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Application Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Date</label>
              <input name="application_date" type="date" value={formData.application_date} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Connection No</label>
              <input name="conn_no" value={formData.conn_no || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              {requiredLabel('Account No.')}
              <input name="account_no" value={formData.account_no} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Deposit Amount</label>
              <input name="deposit_amount" type="number" value={formData.deposit_amount} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              {requiredLabel('National ID')}
              <input name="national_id" value={formData.national_id} onChange={handleChange} onBlur={checkDuplicates} required className={inputClass} />
            </div>
            <div>
              {requiredLabel('KRA PIN')}
              <input name="kra_pin" value={formData.kra_pin} onChange={handleChange} onBlur={checkDuplicates} required className={inputClass} />
            </div>
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="charge_refuse" checked={formData.charge_refuse} onChange={handleChange} className="w-4 h-4" />
                Charge Refuse
              </label>
            </div>
          </div>
        </div>

        {/* Comments */}
        <div>
          <label className={labelClass}>Comments on Customer</label>
          <textarea name="comments" value={formData.comments} onChange={handleChange} rows={3} className={inputClass} />
        </div>

        {/* Mandatory Documents */}
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Mandatory Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-sky-400 transition-colors">
              <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
              {requiredLabel('ID Copy')}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange(e, 'id_copy')} required className="text-xs w-full mt-1" />
              {files.id_copy && <p className="text-xs text-green-600 mt-1">{files.id_copy.name}</p>}
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-sky-400 transition-colors">
              <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
              {requiredLabel('KRA PIN Certificate')}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange(e, 'kra_pin_certificate')} required className="text-xs w-full mt-1" />
              {files.kra_pin_certificate && <p className="text-xs text-green-600 mt-1">{files.kra_pin_certificate.name}</p>}
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-sky-400 transition-colors">
              <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
              {requiredLabel('Plot Copy / Land Letter')}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange(e, 'plot_copy_or_letter')} required className="text-xs w-full mt-1" />
              {files.plot_copy_or_letter && <p className="text-xs text-green-600 mt-1">{files.plot_copy_or_letter.name}</p>}
            </div>
          </div>
        </div>

        {/* Management Information */}
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Management Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Company</label>
              <select name="company_id" value={formData.company_id} onChange={handleChange} className={inputClass}>
                <option value="">Select Company</option>
                {companies?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Billing Group</label>
              <select name="billing_group_id" value={formData.billing_group_id} onChange={handleChange} className={inputClass}>
                <option value="">Select Billing Group</option>
                {billingGroups?.map((bg: any) => <option key={bg.id} value={bg.id}>{bg.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Route</label>
              <select name="route_id" value={formData.route_id} onChange={handleChange} className={inputClass}>
                <option value="">Select Route</option>
                {routes?.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Customer Typology</label>
              <select name="typology_id" value={formData.typology_id} onChange={handleChange} className={inputClass}>
                <option value="">Select Typology</option>
                {typologies?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Disconnection Profile</label>
              <select name="disconnection_profile_id" value={formData.disconnection_profile_id} onChange={handleChange} className={inputClass}>
                <option value="">Select Profile</option>
                {discProfiles?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Customer Category</label>
              <select name="category_id" value={formData.category_id} onChange={handleChange} className={inputClass}>
                <option value="">Select Category</option>
                {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Connection & GIS */}
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Connection & GIS Data</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="connected_to_sewer" checked={formData.connected_to_sewer} onChange={handleChange} className="w-4 h-4" />
                Connected to Sewer
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="managed_by_ewasco" checked={formData.managed_by_ewasco} onChange={handleChange} className="w-4 h-4" />
                Managed By EWASCO
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input name="latitude" type="number" step="any" value={formData.latitude} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input name="longitude" type="number" step="any" value={formData.longitude} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Zone</label>
              <select name="zone_id" value={formData.zone_id} onChange={handleChange} className={inputClass}>
                <option value="">Select Zone</option>
                {zones?.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Bill Dispatch Method</label>
              <select name="bill_dispatch_method_id" value={formData.bill_dispatch_method_id} onChange={handleChange} className={inputClass}>
                <option value="">Select Method</option>
                {dispatchMethods?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
          <button type="submit" disabled={isSubmitting}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center gap-2">
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Create Application'}
          </button>
        </div>
      </form>
    </div>
  )
}
