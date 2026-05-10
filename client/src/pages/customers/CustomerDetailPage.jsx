import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import {
  ArrowLeft, User, Phone, MapPin, Droplets,
  Pencil, Trash2, ChevronDown, FileText, CreditCard
} from 'lucide-react'
import api from '../../api/axios'

const STATUS_OPTIONS = ['active', 'inactive', 'disconnected', 'suspended']

const statusBadgeClass = (status) => {
  const map = {
    active: 'badge-success',
    inactive: 'badge-warning',
    disconnected: 'badge-danger',
    suspended: 'badge-warning'
  }
  return map[status] || 'badge-warning'
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return '-'
  }
}

const CustomerDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)

  const { data, isLoading } = useQuery(
    ['customer', id],
    async () => {
      const response = await api.get(`/customers/${id}`)
      return response.data.data
    }
  )

  const { data: billsData, isError: billsError } = useQuery(
    ['customer-bills', id],
    async () => {
      const response = await api.get(`/billing?customer=${id}&limit=5`)
      return response.data.data
    },
    { retry: false, refetchOnWindowFocus: false }
  )

  const { data: paymentsData, isError: paymentsError } = useQuery(
    ['customer-payments', id],
    async () => {
      const response = await api.get(`/payments?customer=${id}&limit=5`)
      return response.data.data
    },
    { retry: false, refetchOnWindowFocus: false }
  )

  const statusMutation = useMutation(
    (newStatus) => api.put(`/customers/${id}`, { connectionStatus: newStatus }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['customer', id])
        setStatusDropdownOpen(false)
      }
    }
  )

  const deactivateMutation = useMutation(
    () => api.delete(`/customers/${id}`),
    {
      onSuccess: () => {
        navigate('/customers')
      }
    }
  )

  const customer = data

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Customer not found</h3>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/customers" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.firstName} {customer.lastName}</h1>
            <p className="text-gray-500">{customer.accountNumber}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Edit Button */}
          <Link
            to={`/customers/${id}/edit`}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <Pencil className="w-4 h-4" />
            <span>Edit</span>
          </Link>

          {/* Change Status Dropdown */}
          <div className="relative">
            <button
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className="btn-secondary inline-flex items-center space-x-2"
            >
              <span>Change Status</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {statusDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    disabled={status === customer.connectionStatus}
                    onClick={() => statusMutation.mutate(status)}
                    className={`w-full text-left px-4 py-2 text-sm capitalize flex items-center justify-between ${
                      status === customer.connectionStatus
                        ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span>{status}</span>
                    {status === customer.connectionStatus && (
                      <span className="text-xs text-gray-400">(current)</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Deactivate Button */}
          <button
            onClick={() => setShowDeactivateModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Deactivate</span>
          </button>
        </div>
      </div>

      {/* Deactivate Confirmation Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Deactivate Customer</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to deactivate <strong>{customer.firstName} {customer.lastName}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeactivateModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => deactivateMutation.mutate()}
                disabled={deactivateMutation.isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deactivateMutation.isLoading ? 'Deactivating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Info + Account Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">Full Name</label>
              <p className="font-medium">{customer.firstName} {customer.lastName}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Phone</label>
              <p className="font-medium flex items-center">
                <Phone className="w-4 h-4 mr-1 text-gray-400" />
                {customer.phone}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Email</label>
              <p className="font-medium">{customer.email || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">ID Number</label>
              <p className="font-medium">{customer.idNumber || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Property Type</label>
              <p className="font-medium capitalize">{customer.propertyType}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Property Name</label>
              <p className="font-medium">{customer.propertyName || '-'}</p>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-500">Address</label>
              <p className="font-medium flex items-center">
                <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                {customer.address}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Connection Date</label>
              <p className="font-medium">{formatDate(customer.connectionDate)}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Deposit Amount</label>
              <p className="font-medium">KES {customer.depositAmount?.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Portal Enabled</label>
              <div className="mt-1">
                {customer.portalEnabled ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Enabled
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    Disabled
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Summary</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500">Current Balance</label>
              <p className={`text-2xl font-bold ${customer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                KES {customer.balance?.toLocaleString()}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Connection Status</label>
              <div className="mt-1">
                <span className={`badge ${statusBadgeClass(customer.connectionStatus)}`}>
                  {customer.connectionStatus}
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Zone</label>
              <p className="font-medium">{customer.zoneName || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Route</label>
              <p className="font-medium">{customer.routeName || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Meters */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Meters</h2>
        {customer.meters?.length === 0 ? (
          <p className="text-gray-500">No meters assigned</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customer.meters?.map((meter) => (
              <div key={meter.id} className="border rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Droplets className="w-5 h-5 text-primary-600" />
                  <span className="font-medium">{meter.serialNumber}</span>
                </div>
                <p className="text-sm text-gray-500">Size: {meter.meterSize}</p>
                <p className="text-sm text-gray-500">Current Reading: {meter.currentReading}</p>
                <span className={`badge ${meter.status === 'active' ? 'badge-success' : 'badge-warning'} mt-2`}>
                  {meter.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Bills */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <FileText className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Bills</h2>
        </div>
        {billsError || !billsData || billsData.length === 0 ? (
          <p className="text-gray-500">
            {billsError ? 'Billing data unavailable' : 'No bills found'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {billsData.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{bill.bill_number || bill.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{bill.billing_period || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">KES {parseFloat(bill.total_amount)?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`badge ${bill.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(bill.bill_date || bill.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Payments */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <CreditCard className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Payments</h2>
        </div>
        {paymentsError || !paymentsData || paymentsData.length === 0 ? (
          <p className="text-gray-500">
            {paymentsError ? 'Payment data unavailable' : 'No payments found'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paymentsData.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{payment.payment_number || payment.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">KES {parseFloat(payment.amount)?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{payment.payment_method || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(payment.payment_date || payment.created_at)}</td>
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

export default CustomerDetailPage
