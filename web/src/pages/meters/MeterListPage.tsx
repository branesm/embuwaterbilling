import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Search, Gauge, Plus } from 'lucide-react'

export default function MeterListPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['meters', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      params.append('limit', '50')
      const res = await api.get(`/meters?${params.toString()}`)
      return res.data
    },
  })

  const meters = data?.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meters</h1>
          <p className="text-gray-500">Manage water meters and readings</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">
          <Plus className="w-4 h-4" />
          Register Meter
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search meters..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="faulty">Faulty</option>
            <option value="removed">Removed</option>
            <option value="in_store">In Store</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading meters...</div>
        ) : meters.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Gauge className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No meters found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Meter No</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Reading</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Install Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {meters.map((meter: any) => (
                  <tr key={meter.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-sky-600">{meter.meter_no}</td>
                    <td className="px-4 py-3 text-gray-600">{meter.meter_type_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{meter.customer_name || 'Not assigned'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        meter.meter_status === 'active' ? 'bg-green-100 text-green-700' :
                        meter.meter_status === 'faulty' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{meter.meter_status}</span>
                    </td>
                    <td className="px-4 py-3">{meter.current_reading}</td>
                    <td className="px-4 py-3">{meter.install_date ? new Date(meter.install_date).toLocaleDateString() : '-'}</td>
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
