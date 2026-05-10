import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Settings, Users, Shield, FileText } from 'lucide-react'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users')

  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin/users')
      return res.data
    },
  })

  const { data: groupsData } = useQuery({
    queryKey: ['admin-groups'],
    queryFn: async () => {
      const res = await api.get('/admin/groups')
      return res.data
    },
  })

  const { data: settingsData } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await api.get('/admin/settings')
      return res.data
    },
  })

  const users = usersData?.data || []
  const groups = groupsData?.data || []
  const settings = settingsData?.data || []

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'groups', label: 'User Groups', icon: Shield },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="text-gray-500">System configuration and user management</p>
      </div>

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
          {activeTab === 'users' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-900">System Users</h3>
                <button className="px-3 py-1.5 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700">
                  Add User
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2">Username</th>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Group</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: any) => (
                    <tr key={user.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{user.username}</td>
                      <td className="px-3 py-2">{user.first_name} {user.other_names}</td>
                      <td className="px-3 py-2">{user.group_name || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>{user.status}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'groups' && (
            <div>
              <h3 className="font-medium text-gray-900 mb-4">User Groups & Permissions</h3>
              <div className="space-y-3">
                {groups.map((group: any) => (
                  <div key={group.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{group.name}</h4>
                        <p className="text-sm text-gray-500">{group.description || 'No description'}</p>
                      </div>
                      <button className="text-sm text-sky-600 hover:underline">Edit Permissions</button>
                    </div>
                    {group.permissions && (
                      <div className="mt-2 text-xs text-gray-600">
                        <pre className="bg-white p-2 rounded border overflow-x-auto">
                          {JSON.stringify(group.permissions, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h3 className="font-medium text-gray-900 mb-4">System Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings.map((setting: any) => (
                  <div key={setting.id} className="p-4 border rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {setting.setting_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </label>
                    <input
                      type={setting.setting_type === 'number' ? 'number' : 'text'}
                      defaultValue={setting.setting_value}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">{setting.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
