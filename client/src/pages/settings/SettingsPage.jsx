import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../../api/axios'
import { Edit3, Save, Monitor, MessageSquare, Layers, ShieldCheck, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const humanizeKey = (key) =>
  key
    .replace(/_/g, ' ')
    .replace(/(^| )\w/g, (match) => match.toUpperCase())

const SettingsPage = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('company')
  const [editedSettings, setEditedSettings] = useState({})
  const [editedTemplates, setEditedTemplates] = useState({})

  const { data: settingsData, isLoading: settingsLoading } = useQuery(
    ['settings'],
    async () => {
      const res = await api.get('/settings')
      return res.data.data || []
    }
  )

  const { data: smsTemplates, isLoading: templatesLoading } = useQuery(
    ['sms-templates'],
    async () => {
      const res = await api.get('/sms/templates')
      return res.data.data || []
    }
  )

  const updateSettingMutation = useMutation(
    async ({ key, value }) => {
      const res = await api.put(`/settings/${key}`, { settingValue: value })
      return res.data
    },
    {
      onSuccess: (_, variables) => {
        toast.success(`${humanizeKey(variables.key)} updated`)
        queryClient.invalidateQueries(['settings'])
        setEditedSettings((prev) => {
          const next = { ...prev }
          delete next[variables.key]
          return next
        })
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to update setting')
      }
    }
  )

  const updateTemplateMutation = useMutation(
    async ({ id, template, isActive }) => {
      const res = await api.put(`/sms/templates/${id}`, { template, isActive })
      return res.data
    },
    {
      onSuccess: (_, variables) => {
        toast.success('Template updated')
        queryClient.invalidateQueries(['sms-templates'])
        setEditedTemplates((prev) => {
          const next = { ...prev }
          delete next[variables.id]
          return next
        })
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to update template')
      }
    }
  )

  const settings = useMemo(() => settingsData || [], [settingsData])
  const settingMap = useMemo(
    () => settings.reduce((acc, item) => ({ ...acc, [item.setting_key]: item.setting_value }), {}),
    [settings]
  )

  const companySettings = settings.filter((item) =>
    ['company_name', 'company_address', 'company_phone', 'company_email', 'company_logo_url'].includes(item.setting_key)
  )

  const billingSettings = settings.filter((item) =>
    item.setting_key.startsWith('billing_') || ['due_date_offset', 'penalty_grace_period'].includes(item.setting_key)
  )

  const lookupSettings = settings.filter((item) => item.setting_key.startsWith('lookup_'))
  const otherSettings = settings.filter(
    (item) =>
      !companySettings.includes(item) &&
      !billingSettings.includes(item) &&
      !lookupSettings.includes(item)
  )

  const handleSettingChange = (key, value) => {
    setEditedSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveSetting = (key) => {
    const value = editedSettings[key] ?? settingMap[key] ?? ''
    updateSettingMutation.mutate({ key, value })
  }

  const handleTemplateChange = (id, value) => {
    setEditedTemplates((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), template: value } }))
  }

  const handleTemplateActive = (id, value) => {
    setEditedTemplates((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), isActive: value } }))
  }

  const handleSaveTemplate = (template) => {
    const edits = editedTemplates[template.id] || {}
    updateTemplateMutation.mutate({
      id: template.id,
      template: edits.template ?? template.template,
      isActive: edits.isActive ?? template.is_active
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-500 mt-1">Manage company information, billing rules, lookups, and SMS templates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['company', 'billing', 'templates', 'lookups', 'other'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab === 'company' ? 'Company' : tab === 'billing' ? 'Billing' : tab === 'templates' ? 'SMS Templates' : tab === 'lookups' ? 'Lookup Tables' : 'Other'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          {(activeTab === 'company' || activeTab === 'billing' || activeTab === 'other' || activeTab === 'lookups') && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {activeTab === 'company'
                      ? 'Company Settings'
                      : activeTab === 'billing'
                        ? 'Billing Parameters'
                        : activeTab === 'lookups'
                          ? 'Lookup Tables'
                          : 'Additional Settings'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {activeTab === 'company'
                      ? 'Update company details and contact information.'
                      : activeTab === 'billing'
                        ? 'Adjust billing offsets, grace periods, and payment terms.'
                        : activeTab === 'lookups'
                          ? 'Manage system lookup values for dropdowns and rules.'
                          : 'Edit additional system settings and lookup values.'}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                  <RefreshCw className="w-4 h-4" />
                  Auto-refreshes settings from the server.
                </div>
              </div>

              <div className="grid gap-4">
                {(activeTab === 'company'
                  ? companySettings
                  : activeTab === 'billing'
                    ? billingSettings
                    : activeTab === 'lookups'
                      ? lookupSettings
                      : otherSettings).map((item) => (
                  <div key={item.setting_key} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{humanizeKey(item.setting_key)}</label>
                      <input
                        type="text"
                        className="input w-full"
                        value={editedSettings[item.setting_key] ?? item.setting_value ?? ''}
                        onChange={(e) => handleSettingChange(item.setting_key, e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveSetting(item.setting_key)}
                      disabled={updateSettingMutation.isLoading}
                      className="btn btn-primary whitespace-nowrap"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </button>
                  </div>
                ))}
                {activeTab === 'company' && companySettings.length === 0 && (
                  <div className="text-sm text-gray-500">No company settings available.</div>
                )}
                {activeTab === 'billing' && billingSettings.length === 0 && (
                  <div className="text-sm text-gray-500">No billing parameters available.</div>
                )}
                {activeTab === 'lookups' && lookupSettings.length === 0 && (
                  <div className="text-sm text-gray-500">No lookup settings available.</div>
                )}
                {activeTab === 'other' && otherSettings.length === 0 && (
                  <div className="text-sm text-gray-500">No additional settings available.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">SMS Templates</h2>
                  <p className="text-sm text-gray-500">Edit SMS template content and toggle active templates.</p>
                </div>
              </div>

              {templatesLoading ? (
                <div className="text-center py-12 text-gray-500">Loading templates...</div>
              ) : smsTemplates.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No SMS templates found.</div>
              ) : (
                <div className="space-y-4">
                  {smsTemplates.map((template) => (
                    <div key={template.id} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{template.name}</p>
                          <p className="text-xs text-gray-500 mt-1">Purpose: {template.purpose}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={editedTemplates[template.id]?.isActive ?? template.is_active}
                              onChange={(e) => handleTemplateActive(template.id, e.target.checked)}
                            />
                            Active
                          </label>
                          <button
                            type="button"
                            onClick={() => handleSaveTemplate(template)}
                            disabled={updateTemplateMutation.isLoading}
                            className="btn btn-primary"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Save Template
                          </button>
                        </div>
                      </div>
                      <textarea
                        rows="5"
                        className="input w-full font-mono text-sm mt-4"
                        value={editedTemplates[template.id]?.template ?? template.template}
                        onChange={(e) => handleTemplateChange(template.id, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card p-6 space-y-3">
            <div className="flex items-center gap-3 text-primary-700">
              <Monitor className="w-5 h-5" />
              <h3 className="text-sm font-semibold">Settings Summary</h3>
            </div>
            <p className="text-sm text-gray-500">
              Use this panel to maintain system-wide company details, billing rules, lookup tables, and SMS templates.
            </p>
            <div className="grid gap-3 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-gray-400" />
                <span>{settings.length} settings loaded</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span>{smsTemplates?.length ?? 0} SMS templates available</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gray-400" />
                <span>Admin-only access to template updates</span>
              </div>
            </div>
          </div>

          {activeTab !== 'templates' && (
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Recommended Keys</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>- company_name</li>
                <li>- company_address</li>
                <li>- company_phone</li>
                <li>- billing_due_date_offset</li>
                <li>- penalty_grace_period</li>
                <li>- lookup_customer_status</li>
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export default SettingsPage
