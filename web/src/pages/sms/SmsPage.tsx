import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { MessageSquare, Send, CheckCircle, Clock, XCircle, AlertCircle, Search, Plus, Pencil, Trash2, X, Check, Smartphone, FileText } from 'lucide-react'

export default function SmsPage() {
  const [activeTab, setActiveTab] = useState<'send' | 'templates' | 'logs'>('send')
  const [sendForm, setSendForm] = useState({ phone_number: '', message: '', customer_id: '' })
  const [templateForm, setTemplateForm] = useState({ name: '', purpose: 'custom', template: '', variables: '' })
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const queryClient = useQueryClient()

  const { data: config } = useQuery({
    queryKey: ['sms-config'],
    queryFn: async () => {
      const res = await api.get('/sms/config')
      return res.data.data
    },
  })

  const { data: templates } = useQuery({
    queryKey: ['sms-templates'],
    queryFn: async () => {
      const res = await api.get('/sms/templates')
      return res.data.data
    },
  })

  const { data: logsData } = useQuery({
    queryKey: ['sms-logs', filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      const res = await api.get(`/sms/logs?${params}`)
      return res.data
    },
  })

  const logs = logsData?.data || []

  const sendSms = useMutation({
    mutationFn: (data: any) => api.post('/sms/send', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-logs'] })
      setSendForm({ phone_number: '', message: '', customer_id: '' })
    },
  })

  const createTemplate = useMutation({
    mutationFn: (data: any) => api.post('/sms/templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] })
      setShowTemplateForm(false)
      setTemplateForm({ name: '', purpose: 'custom', template: '', variables: '' })
    },
  })

  const updateTemplate = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/sms/templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] })
      setEditingTemplate(null)
    },
  })

  const deleteTemplate = useMutation({
    mutationFn: (id: number) => api.delete(`/sms/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] })
    },
  })

  const statusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Delivered</span>
      case 'sent':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><CheckCircle className="w-3 h-3" /> Sent</span>
      case 'failed':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Failed</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" /> Pending</span>
    }
  }

  const filteredLogs = logs.filter((log: any) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      (log.phone_number || '').toLowerCase().includes(term) ||
      (log.message || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SMS & Notifications</h1>
          <p className="text-gray-500">Send messages, manage templates, and view delivery logs</p>
        </div>
        {config && (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${config.configured ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            <AlertCircle className="w-3.5 h-3.5" />
            {config.configured ? `Africa's Talking (${config.senderId})` : 'SMS not configured'}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex border-b border-gray-200">
          {[
            { key: 'send' as const, label: 'Send SMS', icon: Send },
            { key: 'templates' as const, label: 'Templates', icon: FileText },
            { key: 'logs' as const, label: 'Delivery Logs', icon: MessageSquare },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* Send SMS Tab */}
          {activeTab === 'send' && (
            <div className="max-w-xl">
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Send Single SMS</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    sendSms.mutate({
                      phone_number: sendForm.phone_number,
                      message: sendForm.message,
                      customer_id: sendForm.customer_id ? parseInt(sendForm.customer_id) : null,
                    })
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        required
                        placeholder="254712345678"
                        value={sendForm.phone_number}
                        onChange={(e) => setSendForm({ ...sendForm, phone_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Customer ID (optional)</label>
                      <input
                        type="number"
                        placeholder="Link to customer"
                        value={sendForm.customer_id}
                        onChange={(e) => setSendForm({ ...sendForm, customer_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                    <textarea
                      required
                      rows={4}
                      maxLength={480}
                      value={sendForm.message}
                      onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <div className="text-right text-xs text-gray-500 mt-1">{sendForm.message.length}/480</div>
                  </div>
                  <button
                    type="submit"
                    disabled={sendSms.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 text-sm"
                  >
                    <Send className="w-4 h-4" />
                    {sendSms.isPending ? 'Sending...' : 'Send SMS'}
                  </button>
                  {!config?.configured && (
                    <p className="text-xs text-yellow-600 mt-2">
                      Africa's Talking API not configured. Set AFRICASTALKING_API_KEY environment variable to send real SMS.
                    </p>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">Message Templates</h3>
                <button
                  onClick={() => { setShowTemplateForm(!showTemplateForm); setEditingTemplate(null) }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-xs"
                >
                  {showTemplateForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showTemplateForm ? 'Cancel' : 'New Template'}
                </button>
              </div>

              {showTemplateForm && (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const payload = {
                        name: templateForm.name,
                        purpose: templateForm.purpose,
                        template: templateForm.template,
                        variables: templateForm.variables.split(',').map((v: string) => v.trim()).filter(Boolean),
                      }
                      if (editingTemplate) {
                        updateTemplate.mutate({ id: editingTemplate.id, data: payload })
                      } else {
                        createTemplate.mutate(payload)
                      }
                    }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                      <input required value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Purpose</label>
                      <select value={templateForm.purpose} onChange={(e) => setTemplateForm({ ...templateForm, purpose: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="bill_notification">Bill Notification</option>
                        <option value="payment_confirmation">Payment Confirmation</option>
                        <option value="payment_reminder">Payment Reminder</option>
                        <option value="disconnection_notice">Disconnection Notice</option>
                        <option value="welcome">Welcome</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Template</label>
                      <textarea required rows={3} value={templateForm.template} onChange={(e) => setTemplateForm({ ...templateForm, template: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Use {{variable}} for personalization" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Variables (comma separated)</label>
                      <input value={templateForm.variables} onChange={(e) => setTemplateForm({ ...templateForm, variables: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="name, amount, due_date" />
                    </div>
                    <div className="md:col-span-2">
                      <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm">
                        {editingTemplate ? 'Update Template' : 'Save Template'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Purpose</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Template</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Variables</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {templates?.map((t: any) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{t.name}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">{t.purpose.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{t.template}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{Array.isArray(t.variables) ? t.variables.join(', ') : t.variables}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setEditingTemplate(t); setTemplateForm({ name: t.name, purpose: t.purpose, template: t.template, variables: Array.isArray(t.variables) ? t.variables.join(', ') : t.variables }); setShowTemplateForm(true) }} className="p-1.5 hover:bg-sky-50 rounded text-sky-600" title="Edit"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => { if (confirm('Deactivate this template?')) deleteTemplate.mutate(t.id) }} className="p-1.5 hover:bg-red-50 rounded text-red-600" title="Deactivate"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!templates || templates.length === 0) && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No templates found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Phone</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Message</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Sent At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLogs.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No logs found</td></tr>
                    ) : (
                      filteredLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{log.phone_number}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs text-gray-600 capitalize">{log.message_type}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-sm truncate">{log.message}</td>
                          <td className="px-4 py-3">{statusBadge(log.status)}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{log.sent_at ? new Date(log.sent_at).toLocaleString() : new Date(log.created_at).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
