import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { Plus, Search, UserPlus, Trash2 } from 'lucide-react'

const roles = ['admin', 'manager', 'clerk', 'cashier', 'reader']

const UserManagementPage = () => {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'clerk',
    password: '',
  })

  const queryClient = useQueryClient()

  const {
    data: usersData,
    isLoading,
    isError,
    refetch,
  } = useQuery(
    ['users', search, page],
    async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      params.append('page', page)
      params.append('limit', 20)
      const res = await api.get(`/users?${params.toString()}`)
      return res.data
    },
    { keepPreviousData: true }
  )

  const createUserMutation = useMutation(
    async (data) => {
      const res = await api.post('/users', data)
      return res.data
    },
    {
      onSuccess: () => {
        toast.success('User created successfully')
        setForm({ username: '', email: '', firstName: '', lastName: '', phone: '', role: 'clerk', password: '' })
        queryClient.invalidateQueries('users')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create user')
      },
    }
  )

  const handleCreateUser = async (event) => {
    event.preventDefault()
    if (!form.username || !form.email || !form.firstName || !form.lastName || !form.password) {
      toast.error('Please fill in all required fields')
      return
    }
    createUserMutation.mutate(form)
  }

  const users = usersData?.data || []
  const pagination = usersData?.pagination || { page: 1, pages: 1 }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Users</h1>
        <p className="text-gray-500 mt-1">Manage system users and create staff accounts</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Active Users</h2>
              <p className="text-sm text-gray-500">Search, page and review existing accounts.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search users..."
                  className="pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-6 text-center text-gray-500">Loading users...</td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-6 text-center text-red-600">Unable to load users.</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-6 text-center text-gray-500">No users found.</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{user.username}</td>
                      <td className="px-4 py-3">{user.firstName} {user.lastName}</td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3 capitalize">{user.role}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {pagination.page} of {pagination.pages || 1}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPage((prev) => Math.min(pagination.pages, prev + 1))}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 text-gray-900">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Create New User</h2>
              <p className="text-sm text-gray-500">Add a new staff account to the system.</p>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleCreateUser}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-gray-700">
                Username
                <input
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  placeholder="jdoe"
                />
              </label>
              <label className="block text-sm text-gray-700">
                Email
                <input
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  placeholder="john@example.com"
                />
              </label>
              <label className="block text-sm text-gray-700">
                First Name
                <input
                  value={form.firstName}
                  onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  placeholder="John"
                />
              </label>
              <label className="block text-sm text-gray-700">
                Last Name
                <input
                  value={form.lastName}
                  onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  placeholder="Doe"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-gray-700">
                Role
                <select
                  value={form.role}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  {roles.map((role) => (
                    <option key={role} value={role} className="capitalize">
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-gray-700">
                Password
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  placeholder="Minimum 6 characters"
                />
              </label>
            </div>

            <label className="block text-sm text-gray-700">
              Phone
              <input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="254700000000"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={createUserMutation.isLoading}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                Create User
              </button>
              <button
                type="button"
                onClick={() => setForm({ username: '', email: '', firstName: '', lastName: '', phone: '', role: 'clerk', password: '' })}
                className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}

export default UserManagementPage
