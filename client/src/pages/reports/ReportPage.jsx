import { useState, useCallback, useEffect } from 'react'
import { useQuery } from 'react-query'
import { useLocation } from 'react-router-dom'
import api from '../../api/axios'
import {
  FileText,
  Download,
  Search,
  Filter,
  BarChart3,
  TrendingUp,
  Users,
  Droplets,
  AlertTriangle,
} from 'lucide-react'

// ─── Report Definitions ───────────────────────────────────────────────────────
const REPORT_CATEGORIES = [
  {
    label: 'Revenue & Collections',
    icon: TrendingUp,
    reports: [
      {
        id: 'revenue',
        title: 'Revenue Summary',
        description: 'Revenue breakdown by date and payment method',
        endpoint: '/reports/revenue',
        filters: ['startDate', 'endDate'],
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'payment_method', label: 'Payment Method' },
          { key: 'transaction_count', label: 'Transactions' },
          { key: 'total_amount', label: 'Total Amount', monetary: true },
        ],
        totalKeys: ['total_amount'],
      },
      {
        id: 'collection-efficiency',
        title: 'Collection Efficiency',
        description: 'Collections ratio and performance metrics',
        endpoint: '/reports/collection-efficiency',
        filters: ['startDate', 'endDate'],
        columns: [
          { key: 'billing_period', label: 'Period' },
          { key: 'total_billed', label: 'Total Billed', monetary: true },
          { key: 'total_collected', label: 'Total Collected', monetary: true },
          { key: 'efficiency_rate', label: 'Efficiency %', percentage: true },
        ],
        totalKeys: ['total_billed', 'total_collected'],
      },
      {
        id: 'cashier-collections',
        title: 'Cashier Collections',
        description: 'Collections performance by cashier',
        endpoint: '/reports/cashier-collections',
        filters: ['startDate', 'endDate'],
        columns: [
          { key: 'cashier_name', label: 'Cashier' },
          { key: 'transaction_count', label: 'Transactions' },
          { key: 'total_collected', label: 'Total Collected', monetary: true },
          { key: 'avg_transaction', label: 'Avg Transaction', monetary: true },
        ],
        totalKeys: ['total_collected'],
      },
    ],
  },
  {
    label: 'Billing',
    icon: FileText,
    reports: [
      {
        id: 'billing-summary',
        title: 'Billing Summary',
        description: 'Bills by period and status overview',
        endpoint: '/reports/billing-summary',
        filters: ['startDate', 'endDate'],
        columns: [
          { key: 'billing_period', label: 'Billing Period' },
          { key: 'status', label: 'Status' },
          { key: 'count', label: 'Bill Count' },
          { key: 'total_amount', label: 'Total Amount', monetary: true },
          { key: 'total_balance', label: 'Outstanding', monetary: true },
        ],
        totalKeys: ['total_amount', 'total_balance'],
      },
      {
        id: 'customer-statement',
        title: 'Customer Statement',
        description: 'Detailed statement for a specific customer',
        endpoint: '/reports/customer-statement',
        filters: ['customerId', 'startDate', 'endDate'],
        columns: [
          { key: 'date', label: 'Date', date: true },
          { key: 'description', label: 'Description' },
          { key: 'debit', label: 'Debit', monetary: true },
          { key: 'credit', label: 'Credit', monetary: true },
          { key: 'running_balance', label: 'Balance', monetary: true },
        ],
        totalKeys: ['debit', 'credit'],
        customerSearch: true,
      },
    ],
  },
  {
    label: 'Debt Management',
    icon: AlertTriangle,
    reports: [
      {
        id: 'arrears-aging',
        title: 'Arrears Aging',
        description: 'Aged arrears by customer, zone, and route',
        endpoint: '/arrears/aged-analysis',
        filters: ['zoneId', 'routeId'],
        columns: [
          { key: 'account_number', label: 'Account' },
          { key: 'customer_name', label: 'Customer' },
          { key: 'zone_name', label: 'Zone' },
          { key: 'route_name', label: 'Route' },
          { key: 'bucket_30', label: '0-30 days', monetary: true },
          { key: 'bucket_60', label: '31-60 days', monetary: true },
          { key: 'bucket_90', label: '61-90 days', monetary: true },
          { key: 'bucket_120', label: '91-120 days', monetary: true },
          { key: 'bucket_over_120', label: '120+ days', monetary: true },
          { key: 'total_outstanding', label: 'Total Outstanding', monetary: true },
        ],
        totalKeys: ['bucket_30', 'bucket_60', 'bucket_90', 'bucket_120', 'bucket_over_120', 'total_outstanding'],
      },
      {
        id: 'top-debtors',
        title: 'Top Debtors',
        description: 'Customers with the highest outstanding balances',
        endpoint: '/arrears/top-debtors',
        filters: [],
        columns: [
          { key: 'account_number', label: 'Account' },
          { key: 'customer_name', label: 'Customer' },
          { key: 'unpaid_bills', label: 'Unpaid Bills' },
          { key: 'total_debt', label: 'Total Debt', monetary: true },
          { key: 'oldest_due_date', label: 'Oldest Due', date: true },
        ],
        totalKeys: ['total_debt'],
      },
    ],
  },
  {
    label: 'Operations',
    icon: Users,
    reports: [
      {
        id: 'meter-reader-performance',
        title: 'Meter Reader Performance',
        description: 'Reading performance statistics by meter reader',
        endpoint: '/reports/meter-reader-performance',
        filters: ['startDate', 'endDate'],
        columns: [
          { key: 'reader_name', label: 'Reader' },
          { key: 'total_readings', label: 'Total Readings' },
          { key: 'actual_readings', label: 'Actual', monetary: false },
          { key: 'estimated_readings', label: 'Estimated', monetary: false },
          { key: 'avg_consumption', label: 'Avg Consumption', monetary: false },
          { key: 'routes_covered', label: 'Routes Covered' },
          { key: 'days_worked', label: 'Days Worked' },
        ],
        totalKeys: ['total_readings'],
      },
      {
        id: 'disconnection-summary',
        title: 'Disconnection Report',
        description: 'Summary of disconnections over a period',
        endpoint: '/reports/disconnection-summary',
        filters: ['startDate', 'endDate'],
        columns: [
          { key: 'period', label: 'Period' },
          { key: 'status', label: 'Status' },
          { key: 'count', label: 'Count' },
        ],
        totalKeys: ['count'],
      },
    ],
  },
  {
    label: 'Water Loss',
    icon: Droplets,
    reports: [
      {
        id: 'nrw-analysis',
        title: 'NRW Analysis',
        description: 'Non-Revenue Water analysis and trends',
        endpoint: '/reports/nrw-summary',
        filters: ['startDate', 'endDate'],
        columns: [
          { key: 'zone_name', label: 'Zone' },
          { key: 'active_connections', label: 'Active Connections' },
          { key: 'total_billed_consumption', label: 'Billed Consumption (m³)' },
        ],
        totalKeys: ['total_billed_consumption'],
      },
      {
        id: 'consumption-analysis',
        title: 'Consumption Analysis',
        description: 'Consumption trends and patterns',
        endpoint: '/reports/consumption-analysis',
        filters: ['startDate', 'endDate', 'groupBy'],
        columns: [
          { key: 'group_name', label: 'Group' },
          { key: 'reading_count', label: 'Readings' },
          { key: 'total_consumption', label: 'Total Consumption', monetary: false },
          { key: 'avg_consumption', label: 'Avg Consumption', monetary: false },
          { key: 'min_consumption', label: 'Min Consumption', monetary: false },
          { key: 'max_consumption', label: 'Max Consumption', monetary: false },
        ],
        totalKeys: ['total_consumption'],
      },
    ],
  },
]

// Flatten for quick lookup
const ALL_REPORTS = REPORT_CATEGORIES.flatMap((cat) => cat.reports)
const reportMap = Object.fromEntries(ALL_REPORTS.map((r) => [r.id, r]))

// ─── CSV Export Helper ────────────────────────────────────────────────────────
const exportCSV = (data, columns, filename) => {
  const header = columns.map((c) => `"${c.label}"`).join(',')
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key] ?? ''
        return `"${String(val).replace(/"/g, '""')}"`
      })
      .join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Format Helpers ───────────────────────────────────────────────────────────
const fmt = (val) =>
  val != null ? parseFloat(val).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'
const fmtPct = (val) => (val != null ? `${parseFloat(val).toFixed(1)}%` : '-')
const fmtDate = (val) => (val ? new Date(val).toLocaleDateString() : '-')

// ─── Component ────────────────────────────────────────────────────────────────
const ReportPage = () => {
  const location = useLocation()
  const reportQuery = new URLSearchParams(location.search).get('report')
  const [selectedReport, setSelectedReport] = useState(reportMap[reportQuery] ? reportQuery : 'revenue')
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    zoneId: '',
    routeId: '',
    customerId: '',
    customerSearch: '',
    groupBy: 'month',
  })
  const [generated, setGenerated] = useState(false)

  const report = reportMap[selectedReport]

  // ── Zone & Route lookups ──
  const { data: zonesData } = useQuery(
    ['zones'],
    async () => {
      const res = await api.get('/zones')
      return res.data.data || res.data || []
    },
    { staleTime: 60000 }
  )
  const zones = Array.isArray(zonesData) ? zonesData : []

  const { data: routesData } = useQuery(
    ['routes', filters.zoneId],
    async () => {
      if (!filters.zoneId) return []
      const res = await api.get(`/routes?zone=${filters.zoneId}`)
      return res.data.data || res.data || []
    },
    { enabled: !!filters.zoneId, staleTime: 60000 }
  )
  const routes = Array.isArray(routesData) ? routesData : []

  // ── Customer search ──
  const { data: customerSearchData } = useQuery(
    ['customer-search', filters.customerSearch],
    async () => {
      if (!filters.customerSearch || filters.customerSearch.length < 2) return []
      const res = await api.get(`/customers?search=${encodeURIComponent(filters.customerSearch)}&limit=10`)
      return res.data.data || res.data || []
    },
    { enabled: filters.customerSearch && filters.customerSearch.length >= 2, staleTime: 10000 }
  )
  const customerResults = Array.isArray(customerSearchData) ? customerSearchData : []

  // ── Build query params ──
  const buildParams = useCallback(() => {
    const p = new URLSearchParams()
    if (filters.startDate) p.append('startDate', filters.startDate)
    if (filters.endDate) p.append('endDate', filters.endDate)
    if (filters.zoneId) p.append('zoneId', filters.zoneId)
    if (filters.routeId) p.append('routeId', filters.routeId)
    if (filters.customerId) p.append('customerId', filters.customerId)
    if (filters.groupBy) p.append('groupBy', filters.groupBy)
    return p
  }, [filters])

  // ── Report data query ──
  const {
    data: reportData,
    isLoading,
    error,
    refetch,
  } = useQuery(
    ['report', selectedReport, filters.startDate, filters.endDate, filters.zoneId, filters.routeId, filters.customerId, filters.groupBy],
    async () => {
      const config = reportMap[selectedReport]
      if (!config) return null

      // Customer statement has a different URL pattern
      let url = config.endpoint
      const params = buildParams()
      if (selectedReport === 'customer-statement') {
        if (!filters.customerId) return null
        url = `${config.endpoint}/${filters.customerId}`
      }
      const sep = url.includes('?') ? '&' : '?'
      const res = await api.get(`${url}${sep}${params.toString()}`)
      return res.data
    },
    { enabled: generated, refetchOnWindowFocus: false }
  )

  // ── Extract rows ──
  const originalRows = (() => {
    if (!reportData) return []
    const d = reportData.data || reportData
    if (Array.isArray(d)) return d
    if (d.records && Array.isArray(d.records)) return d.records
    if (d.rows && Array.isArray(d.rows)) return d.rows
    if (d.results && Array.isArray(d.results)) return d.results
    if (d.statement && Array.isArray(d.statement)) return d.statement
    if (d.customers && Array.isArray(d.customers)) return d.customers
    if (d.data && Array.isArray(d.data)) return d.data
    return []
  })()

  const rows = originalRows.map((row) => ({
    ...row,
    customer_name: row.customer_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    reader_name: row.reader_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    cashier_name: row.cashier_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
  }))

  // ── Handlers ──
  useEffect(() => {
    if (reportQuery && reportMap[reportQuery]) {
      setSelectedReport(reportQuery)
      setGenerated(false)
    }
  }, [reportQuery])

  const handleSelectReport = (id) => {
    setSelectedReport(id)
    setGenerated(false)
  }

  const handleGenerate = () => {
    setGenerated(true)
    refetch()
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setGenerated(false)
    if (key === 'zoneId') {
      setFilters((prev) => ({ ...prev, routeId: '' }))
    }
  }

  const handleExport = () => {
    if (!rows.length) return
    const filename = `${selectedReport}-report-${new Date().toISOString().slice(0, 10)}.csv`
    exportCSV(rows, report.columns, filename)
  }

  // ── Totals row ──
  const totals = (() => {
    if (!report || !rows.length) return null
    const totalKeys = report.totalKeys || []
    if (!totalKeys.length) return null
    const t = {}
    totalKeys.forEach((k) => {
      t[k] = rows.reduce((sum, r) => sum + parseFloat(r[k] || 0), 0)
    })
    return t
  })()

  // ── Helpers for which filters to show ──
  const needsDateRange = report?.filters?.includes('startDate')
  const needsZone = report?.filters?.includes('zoneId')
  const needsRoute = report?.filters?.includes('routeId')
  const needsGroupBy = report?.filters?.includes('groupBy')
  const isCustomerStatement = selectedReport === 'customer-statement'

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* ── Left Sidebar ── */}
      <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Report Finder</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">Select a report to generate</p>
        </div>

        <nav className="p-2">
          {REPORT_CATEGORIES.map((cat) => (
            <div key={cat.label} className="mb-3">
              <div className="flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <cat.icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </div>
              {cat.reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelectReport(r.id)}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                    selectedReport === r.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {r.title}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Right Content Area ── */}
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {/* Report Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{report?.title}</h1>
          <p className="text-gray-500 mt-1">{report?.description}</p>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            {/* Customer Search for Customer Statement */}
            {isCustomerStatement && (
              <div className="w-72 relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className="input pl-9 w-full"
                    placeholder="Type to search customers..."
                    value={filters.customerSearch}
                    onChange={(e) => handleFilterChange('customerSearch', e.target.value)}
                  />
                </div>
                {/* Autocomplete dropdown */}
                {filters.customerSearch && filters.customerSearch.length >= 2 && customerResults.length > 0 && !filters.customerId && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
                        onClick={() => {
                          setFilters((prev) => ({
                            ...prev,
                            customerId: c.id,
                            customerSearch: `${c.first_name || ''} ${c.other_names || ''} (${c.account_number || c.id})`,
                          }))
                        }}
                      >
                        <span className="font-medium">{c.first_name} {c.other_names}</span>
                        <span className="text-gray-500 ml-2">{c.account_number || c.id}</span>
                      </button>
                    ))}
                  </div>
                )}
                {filters.customerId && (
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                    onClick={() => setFilters((prev) => ({ ...prev, customerId: '', customerSearch: '' }))}
                  >
                    Clear selection
                  </button>
                )}
              </div>
            )}

            {/* Date Range */}
            {needsDateRange && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="input"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    className="input"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Zone Dropdown */}
            {needsZone && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Zone</label>
                <select
                  className="input w-44"
                  value={filters.zoneId}
                  onChange={(e) => handleFilterChange('zoneId', e.target.value)}
                >
                  <option value="">All Zones</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name || z.zone_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Route Dropdown */}
            {needsRoute && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Route</label>
                <select
                  className="input w-44"
                  value={filters.routeId}
                  onChange={(e) => handleFilterChange('routeId', e.target.value)}
                  disabled={!filters.zoneId}
                >
                  <option value="">All Routes</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || r.route_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Group By */}
            {needsGroupBy && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Group By</label>
                <select
                  className="input w-36"
                  value={filters.groupBy}
                  onChange={(e) => handleFilterChange('groupBy', e.target.value)}
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </div>
            )}

            {/* Generate Button */}
            <div>
              <button
                onClick={handleGenerate}
                disabled={isCustomerStatement && !filters.customerId}
                className="btn btn-primary flex items-center space-x-2"
              >
                <Search className="w-4 h-4" />
                <span>Generate Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-gray-500">Generating report...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-white rounded-lg border border-red-200 p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <p className="text-red-600 font-medium">Failed to generate report</p>
            <p className="text-gray-500 text-sm mt-1">{error?.response?.data?.message || error?.message || 'An error occurred'}</p>
            <button onClick={() => refetch()} className="btn btn-secondary mt-4">
              Retry
            </button>
          </div>
        )}

        {/* Empty State - before generation */}
        {!generated && !isLoading && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Configure your filters and click Generate Report</p>
          </div>
        )}

        {/* Results Table */}
        {generated && !isLoading && !error && (
          <div className="bg-white rounded-lg border border-gray-200">
            {/* Table Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  {rows.length} record{rows.length !== 1 ? 's' : ''} found
                </span>
              </div>
              <button
                onClick={handleExport}
                disabled={!rows.length}
                className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Data Table */}
            {rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-8">#</th>
                      {report?.columns?.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="text-gray-400 text-sm">{i + 1}</td>
                        {report?.columns?.map((col) => (
                          <td key={col.key} className={col.monetary ? 'text-right font-medium' : ''}>
                            {col.monetary
                              ? fmt(row[col.key])
                              : col.percentage
                                ? fmtPct(row[col.key])
                                : col.date
                                  ? fmtDate(row[col.key])
                                  : row[col.key] ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {/* Totals Row */}
                    {totals && (
                      <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                        <td></td>
                        {report?.columns?.map((col) => (
                          <td key={col.key} className={col.monetary ? 'text-right' : ''}>
                            {col.monetary && totals[col.key] != null ? fmt(totals[col.key]) : col.key === report.columns[0]?.key ? 'TOTAL' : ''}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">No data found for the selected filters.</div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default ReportPage
