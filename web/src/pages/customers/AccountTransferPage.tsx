import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ArrowLeft, Save, AlertTriangle, UserCheck } from 'lucide-react'
import { useState } from 'react'

export default function AccountTransferPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: customerData } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const res = await api.get(`/customers/${id}`)
      return res.data
    },
  })

  const customer = customerData?.data

  const [formData, setFormData] = useState({
    new_name: '',
    new_first_name: '',
    new_last_name: '',
    new_national_id: '',
    new_telephone: '',
    new_email: '',
    transfer_reason: '',
    reference_no: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.new_name || !formData.new_national_id) {
      alert('New owner name and National ID are required')
      return
    }
    if (!confirm('Are you sure you want to transfer this account to the new owner?')) return

    setIsSubmitting(true)
    try {
      await api.post(`/customers/${id}/transfer`, formData)
      alert('Account transferred successfully')
      navigate(`/customers/${id}`)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to transfer account')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!customer) {
    return <div className="p-8 text-center text-gray-500">Loading customer...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/customers/${id}`)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contract Transfer</h1>
          <p className="text-gray-500">Transfer account {customer.account_no} to a new owner</p>
        </div>
      </div>

      {/* Current Owner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">Current Owner</p>
            <p className="text-sm text-amber-800">
              <span className="font-medium">Name:</span> {customer.name} &nbsp;|&nbsp;
              <span className="font-medium">National ID:</span> {customer.national_id || '-'} &nbsp;|&nbsp;
              <span className="font-medium">Phone:</span> {customer.telephone || '-'}
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Transferring this account will update the ownership records and create an audit trail.
            </p>
          </div>
        </div>
      </div>

      {/* Transfer Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck className="w-5 h-5 text-sky-600" />
          <h3 className="font-semibold text-gray-900">New Owner Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input
              name="new_name"
              value={formData.new_name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              placeholder="New owner's full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">National ID <span className="text-red-500">*</span></label>
            <input
              name="new_national_id"
              value={formData.new_national_id}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              placeholder="e.g. 12345678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              name="new_first_name"
              value={formData.new_first_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              placeholder="First name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              name="new_last_name"
              value={formData.new_last_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              placeholder="Last name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
            <input
              name="new_telephone"
              value={formData.new_telephone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              placeholder="e.g. 0712345678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              name="new_email"
              type="email"
              value={formData.new_email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              placeholder="email@example.com"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Transfer Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
              <input
                name="reference_no"
                value={formData.reference_no}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                placeholder="e.g. REF-2026-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Reason <span className="text-red-500">*</span></label>
              <input
                name="transfer_reason"
                value={formData.transfer_reason}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                placeholder="Reason for transfer"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate(`/customers/${id}`)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 text-sm"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Transferring...' : 'Transfer Account'}
          </button>
        </div>
      </form>
    </div>
  )
}
