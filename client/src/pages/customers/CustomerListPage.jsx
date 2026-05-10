import { useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { Search, Plus, Users, CheckCircle, XCircle, DollarSign } from 'lucide-react'
import api from '../../api/axios'

const CustomerListPage = () => {
  const [search, setSearch] = useState('')
  const [zone, setZone] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  // Fetch customer stats
  const { data: statsData } = useQuery(
    'customer-stats',
    async () => {
      const response = await api.get('/customers/stats')
      return response.data
    },
    { keepPreviousData: true }
  )

  // Fetch zones for filter dropdown
  const { data: zonesData } = useQuery(
    'zones',
    async () => {
      const response = await api.get('/zones')
      return response.data
    },
    { keepPreviousData: true }
  )

  const stats = statsData?.data || {}
  const zones = zonesData?.data || []

  // Fetch customers with filters
  const { data, isLoading } = useQuery(
    ['customers', search, zone, status, page],
    async () => {
      const response = await api.get(`/customers?search=${search}&zone=${zone}&status=${status}&page=${page}&limit=20`)
      return response.data
    },
    { keepPreviousData: true }
  )

  const customers = data?.data || []
  const pagination = data?.pagination

  // Reset page to 1 when filters change
  const handleSearchChange = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handleZoneChange = (e) => {
    setZone(e.target.value)
    setPage(1)
  }

  const handleStatusChange = (e) => {
    setStatus(e.target.value)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage customer accounts</p>
        </div>
        <Link to="/customers/new" className="btn-primary inline-flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <div className="card p-4 bg-blue-50 border-blue-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600">Total Customers</p>
              <p className="text-2xl font-bold text-blue-900">{stats.totalCustomers ?? '-'}</p>
            </div>
          </div>
        </div>

        {/* Active */}
        <div className="card p-4 bg-green-50 border-green-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-600">Active</p>
              <p className="text-2xl font-bold text-green-900">{stats.active ?? '-'}</p>
            </div>
          </div>
        </div>

        {/* Disconnected */}
        <div className="card p-4 bg-red-50 border-red-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-600">Disconnected</p>
              <p className="text-2xl font-bold text-red-900">{stats.disconnected ?? '-'}</p>
            </div>
          </div>
        </div>

        {/* Total Balance */}
        <div className="card p-4 bg-amber-50 border-amber-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-600">Total Balance</p>
              <p className="text-2xl font-bold text-amber-900">
                KES {stats.totalBalance?.toLocaleString() ?? '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, account number, or phone..."
              value={search}
              onChange={handleSearchChange}
              className="input pl-10"
            />
          </div>
          <select
            value={zone}
            onChange={handleZoneChange}
            className="input w-full sm:w-48"
          >
            <option value="">All Zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={handleStatusChange}
            className="input w-full sm:w-48"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="disconnected">Disconnected</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No customers found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your search or add a new customer.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Account #</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Property Type</th>
                    <th>Zone</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="cursor-pointer hover:bg-gray-50">
                      <td>
                        <Link to={`/customers/${customer.id}`} className="text-primary-600 hover:underline font-medium">
                          {customer.accountNumber}
                        </Link>
                      </td>
                      <td>{customer.firstName} {customer.lastName}</td>
                      <td>{customer.phone}</td>
                      <td className="capitalize">{customer.propertyType}</td>
                      <td>{customer.zoneName || '-'}</td>
                      <td className={customer.balance > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                        KES {customer.balance?.toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${customer.connectionStatus === 'active' ? 'badge-success' : 'badge-warning'}`}>
                          {customer.connectionStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-gray-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                </p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={pagination.page === pagination.pages}
                    className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CustomerListPage
