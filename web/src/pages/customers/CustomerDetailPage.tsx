import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, User, Phone, Mail, MapPin, FileText, CreditCard, History, FileCheck, ExternalLink, Activity, Power, PowerOff, RotateCcw, AlertTriangle, ArrowRightLeft, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [actionLoading, setActionLoading] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const res = await api.get(`/customers/${id}`)
      return res.data
    },
  })

  const handleLifecycleAction = async (action: string) => {
    if (!confirm(`Are you sure you want to ${action} this account?`)) return
    setActionLoading(true)
    try {
      const reason = prompt(`Enter reason for ${action}:`) || ''
      const reference = prompt('Enter reference number (optional):') || ''
      const payload: any = { reason, reference }
      if (action === 'activate') {
        const connectionFee = prompt('Connection fee amount (optional):') || '0'
        const depositAmount = prompt('Deposit amount (optional):') || '0'
        payload.connection_fee = connectionFee
        payload.deposit_amount = depositAmount
      }
      if (action === 'terminate') {
        const ledgerNo = prompt('Ledger number (optional):') || ''
        payload.ledger_no = ledgerNo
        payload.termination_comments = reason
      }
      await api.put(`/customers/${id}/${action}`, payload)
      refetch()
    } catch (err: any) {
      alert(err.response?.data?.message || `Failed to ${action} account`)
    } finally {
      setActionLoading(false)
    }
  }

  const customer = data?.data

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading customer...</div>
  }

  if (!customer) {
    return <div className="p-8 text-center text-gray-500">Customer not found</div>
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'bills', label: 'Bills', icon: FileText },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'history', label: 'History', icon: History },
    { id: 'documents', label: 'Documents', icon: FileCheck },
    { id: 'status', label: 'Status History', icon: Activity },
    { id: 'connections', label: 'Connection Payments', icon: FileSpreadsheet },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/customers')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <p className="text-gray-500">{customer.account_no}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            customer.account_status === 'active' ? 'bg-green-100 text-green-700' :
            customer.account_status === 'inactive' ? 'bg-amber-100 text-amber-700' :
            customer.account_status === 'terminated' ? 'bg-red-100 text-red-700' :
            customer.account_status === 'pending' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {customer.account_status}
          </span>
          <div className="flex gap-2">
            {customer.account_status === 'pending' && (
              <button onClick={() => handleLifecycleAction('activate')} disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50">
                <Power className="w-3 h-3" /> Activate
              </button>
            )}
            {customer.account_status === 'active' && (
              <>
                <button onClick={() => handleLifecycleAction('inactivate')} disabled={actionLoading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  <PowerOff className="w-3 h-3" /> Inactivate
                </button>
                <button onClick={() => handleLifecycleAction('terminate')} disabled={actionLoading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50">
                  <AlertTriangle className="w-3 h-3" /> Terminate
                </button>
              </>
            )}
            {customer.account_status === 'inactive' && (
              <button onClick={() => handleLifecycleAction('reactivate')} disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50">
                <RotateCcw className="w-3 h-3" /> Reactivate
              </button>
            )}
            <button onClick={() => navigate(`/customers/${id}/transfer`)} disabled={actionLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700 disabled:opacity-50">
              <ArrowRightLeft className="w-3 h-3" /> Transfer
            </button>
            <button onClick={() => navigate(`/customers/${id}/statement`)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700">
              <FileSpreadsheet className="w-3 h-3" /> Statement
            </button>
          </div>
        </div>
      </div>

      {/* Customer Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Account Balance</p>
          <p className={`text-xl font-bold ${customer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(customer.balance)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Category</p>
          <p className="text-xl font-bold text-gray-900">{customer.category_name || '-'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Billing Group</p>
          <p className="text-xl font-bold text-gray-900">{customer.billing_group_name || '-'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Deposit</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(customer.deposit_amount)}</p>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">{customer.telephone || 'No phone'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">{customer.email || 'No email'}</span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">{customer.address || 'No address'}</span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">{customer.town || 'No town'}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Meters</h4>
              {customer.meters?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2">Meter No</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">Current Reading</th>
                      <th className="text-left px-3 py-2">Install Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.meters.map((meter: any) => (
                      <tr key={meter.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{meter.meter_no}</td>
                        <td className="px-3 py-2">{meter.meter_status}</td>
                        <td className="px-3 py-2">{meter.current_reading}</td>
                        <td className="px-3 py-2">{meter.install_date ? formatDate(meter.install_date) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-sm">No meters assigned</p>
              )}
            </div>
          )}

          {activeTab === 'bills' && (
            <div>
              {customer.bills?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2">Bill No</th>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Amount</th>
                      <th className="text-left px-3 py-2">Balance</th>
                      <th className="text-left px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.bills.map((bill: any) => (
                      <tr key={bill.id} className="border-t">
                        <td className="px-3 py-2">{bill.bill_no}</td>
                        <td className="px-3 py-2">{formatDate(bill.bill_date)}</td>
                        <td className="px-3 py-2">{formatCurrency(bill.total_amount)}</td>
                        <td className="px-3 py-2">{formatCurrency(bill.balance)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            bill.status === 'paid' ? 'bg-green-100 text-green-700' :
                            bill.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>{bill.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-sm">No bills found</p>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              {customer.payments?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2">Receipt No</th>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Amount</th>
                      <th className="text-left px-3 py-2">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.payments.map((payment: any) => (
                      <tr key={payment.id} className="border-t">
                        <td className="px-3 py-2">{payment.receipt_no}</td>
                        <td className="px-3 py-2">{formatDate(payment.payment_date)}</td>
                        <td className="px-3 py-2">{formatCurrency(payment.amount)}</td>
                        <td className="px-3 py-2">{payment.payment_mode_id || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-sm">No payments found</p>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {customer.history?.length > 0 ? (
                <div className="space-y-2">
                  {customer.history.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <History className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.change_type}</p>
                        <p className="text-xs text-gray-500">{formatDate(item.created_at)}</p>
                        {item.change_reason && <p className="text-xs text-gray-600 mt-1">{item.change_reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No history found</p>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              {customer.documents?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {customer.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <FileCheck className="w-5 h-5 text-sky-600 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 capitalize">{doc.document_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-500 truncate">{doc.file_name}</p>
                        <p className="text-xs text-gray-400">{formatDate(doc.created_at)}</p>
                      </div>
                      <a
                        href={`http://localhost:5000/uploads/${doc.file_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-gray-200 rounded-lg text-gray-600"
                        title="View document"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No documents uploaded</p>
              )}
            </div>
          )}

          {activeTab === 'status' && (
            <div>
              {customer.statusHistory?.length > 0 ? (
                <div className="space-y-2">
                  {customer.statusHistory.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <Activity className="w-4 h-4 text-sky-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 capitalize">{item.previous_status || 'new'}</span>
                          <ArrowRightLeft className="w-3 h-3 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 capitalize">{item.new_status}</span>
                        </div>
                        <p className="text-xs text-gray-500">{formatDate(item.created_at)} by {item.changed_by_name || 'System'}</p>
                        {item.reason && <p className="text-xs text-gray-600 mt-1">{item.reason}</p>}
                        {item.reference && <p className="text-xs text-gray-500">Ref: {item.reference}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No status history found</p>
              )}
            </div>
          )}

          {activeTab === 'connections' && (
            <div>
              {customer.connectionPayments?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-left px-3 py-2">Amount</th>
                      <th className="text-left px-3 py-2">Receipt No</th>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Processed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.connectionPayments.map((payment: any) => (
                      <tr key={payment.id} className="border-t">
                        <td className="px-3 py-2 capitalize">{payment.payment_type.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2">{formatCurrency(payment.amount)}</td>
                        <td className="px-3 py-2">{payment.receipt_no || '-'}</td>
                        <td className="px-3 py-2">{formatDate(payment.payment_date)}</td>
                        <td className="px-3 py-2">{payment.processed_by_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-sm">No connection payments found</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
