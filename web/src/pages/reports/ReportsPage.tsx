import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  BarChart3, Download, Calendar, Users, Droplets, CreditCard, MapPin,
  Activity, FileText, TrendingUp, AlertTriangle, CheckCircle, Gauge,
  ClipboardList, Search, Filter
} from 'lucide-react'

const reportTypes = [
  { id: 'revenue-summary', name: 'Revenue Summary', description: 'Total revenue breakdown', icon: TrendingUp },
  { id: 'aged-analysis', name: 'Aged Analysis', description: 'Debt aging by customer', icon: AlertTriangle },
  { id: 'debtors-list', name: 'Debtors List', description: 'Outstanding balances', icon: Users },
  { id: 'daily-payments', name: 'Daily Payments', description: 'Payments by day', icon: CreditCard },
  { id: 'collection-efficiency', name: 'Collection Efficiency', description: 'Collection rates', icon: CheckCircle },
  { id: 'consumption-summary', name: 'Consumption', description: 'Water consumption summary', icon: Droplets },
  { id: 'customer-summary', name: 'Customer Summary', description: 'Customer statistics', icon: Users },
  { id: 'meter-reading-summary', name: 'Meter Readings', description: 'Reading statistics', icon: Gauge },
  { id: 'payment-reconciliation', name: 'Reconciliation', description: 'Payments vs bills', icon: ClipboardList },
  { id: 'zone-performance', name: 'Zone Performance', description: 'Zone billing & collection', icon: MapPin },
]

function exportToCSV(filename: string, rows: any[], headers: string[], keys: string[]) {
  const csv = [headers.join(','), ...rows.map((r) => keys.map((k) => `"${(r[k] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState('revenue-summary')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [billingGroupId, setBillingGroupId] = useState('')
  const [minBalance, setMinBalance] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: zonesData } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => { const res = await api.get('/parameters/zones'); return res.data },
  })

  const { data: billingGroupsData } = useQuery({
    queryKey: ['billing-groups'],
    queryFn: async () => { const res = await api.get('/parameters/billing-groups'); return res.data },
  })

  const buildQueryString = () => {
    const params = new URLSearchParams()
    if (dateFrom) params.append('from_date', dateFrom)
    if (dateTo) params.append('to_date', dateTo)
    if (zoneId) params.append('zone_id', zoneId)
    if (billingGroupId) params.append('billing_group_id', billingGroupId)
    if (minBalance) params.append('min_balance', minBalance)
    if (statusFilter) params.append('status', statusFilter)
    return params.toString()
  }

  const { data, isLoading } = useQuery({
    queryKey: ['report', selectedReport, dateFrom, dateTo, zoneId, billingGroupId, minBalance, statusFilter],
    queryFn: async () => {
      const qs = buildQueryString()
      const res = await api.get(`/reports/${selectedReport}${qs ? '?' + qs : ''}`)
      return res.data
    },
  })

  const reportData = data?.data || {}
  const currentReport = reportTypes.find((r) => r.id === selectedReport)

  const handleExport = () => {
    let rows: any[] = []
    let headers: string[] = []
    let keys: string[] = []

    if (selectedReport === 'revenue-summary') {
      rows = reportData.byBillingGroup || []
      headers = ['Billing Group', 'Billed', 'Collected']
      keys = ['billing_group', 'billed', 'collected']
    } else if (selectedReport === 'aged-analysis') {
      rows = reportData || []
      headers = ['Account No', 'Name', 'Category', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', 'Over 90', 'Total']
      keys = ['account_no', 'name', 'category', 'current_due', 'days_1_30', 'days_31_60', 'days_61_90', 'over_90', 'balance']
    } else if (selectedReport === 'debtors-list') {
      rows = reportData || []
      headers = ['Account No', 'Name', 'Phone', 'Billing Group', 'Zone', 'Balance', 'Unpaid Bills']
      keys = ['account_no', 'name', 'telephone', 'billing_group', 'zone', 'balance', 'unpaid_bills']
    } else if (selectedReport === 'daily-payments') {
      rows = reportData.summary || []
      headers = ['Payment Mode', 'Count', 'Total']
      keys = ['payment_mode', 'count', 'total']
    } else if (selectedReport === 'collection-efficiency') {
      rows = reportData || []
      headers = ['Billing Group', 'Billed', 'Collected', 'Efficiency %']
      keys = ['billing_group', 'billed_amount', 'collected_amount', 'efficiency']
    } else if (selectedReport === 'consumption-summary') {
      rows = reportData || []
      headers = ['Billing Group', 'Zone', 'Readings', 'Total Consumption', 'Avg', 'Estimated', 'Anomalies']
      keys = ['billing_group', 'zone', 'reading_count', 'total_consumption', 'avg_consumption', 'estimated_count', 'anomaly_count']
    } else if (selectedReport === 'customer-summary') {
      rows = reportData.byBillingGroup || []
      headers = ['Billing Group', 'Count']
      keys = ['billing_group', 'count']
    } else if (selectedReport === 'meter-reading-summary') {
      rows = reportData.byCode || []
      headers = ['Reading Code', 'Code', 'Count']
      keys = ['reading_code', 'code', 'count']
    } else if (selectedReport === 'payment-reconciliation') {
      rows = reportData.daily || []
      headers = ['Date', 'Payments', 'Total', 'Allocated']
      keys = ['date', 'payment_count', 'total_payments', 'total_allocated']
    } else if (selectedReport === 'zone-performance') {
      rows = reportData || []
      headers = ['Zone', 'Customers', 'Billed', 'Collected', 'Collection Rate %', 'Outstanding']
      keys = ['zone', 'customer_count', 'billed', 'collected', 'collection_rate', 'outstanding']
    }

    if (rows.length > 0) exportToCSV(currentReport?.name || 'report', rows, headers, keys)
  }

  const renderSummaryCards = () => {
    if (selectedReport === 'revenue-summary' && reportData.summary) {
      const s = reportData.summary
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <SummaryCard label="Total Billed" value={formatCurrency(s.total_billed)} icon={TrendingUp} color="text-sky-600" />
          <SummaryCard label="Total Collected" value={formatCurrency(s.total_collected)} icon={CheckCircle} color="text-green-600" />
          <SummaryCard label="Outstanding" value={formatCurrency(s.total_outstanding)} icon={AlertTriangle} color="text-red-600" />
          <SummaryCard label="Bill Count" value={s.bill_count || 0} icon={FileText} color="text-gray-600" />
        </div>
      )
    }
    if (selectedReport === 'customer-summary' && reportData.summary) {
      const s = reportData.summary
      return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <SummaryCard label="Total" value={s.total} icon={Users} color="text-gray-600" />
          <SummaryCard label="Active" value={s.active} icon={CheckCircle} color="text-green-600" />
          <SummaryCard label="Inactive" value={s.inactive} icon={AlertTriangle} color="text-amber-600" />
          <SummaryCard label="Terminated" value={s.terminated} icon={XCircleIcon} color="text-red-600" />
          <SummaryCard label="Pending" value={s.pending} icon={ClockIcon} color="text-blue-600" />
        </div>
      )
    }
    if (selectedReport === 'meter-reading-summary' && reportData.summary) {
      const s = reportData.summary
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <SummaryCard label="Total Readings" value={s.total_readings || 0} icon={Gauge} color="text-sky-600" />
          <SummaryCard label="Estimated" value={s.estimated || 0} icon={AlertTriangle} color="text-amber-600" />
          <SummaryCard label="Anomalies" value={s.anomalies || 0} icon={Activity} color="text-red-600" />
          <SummaryCard label="Unbilled" value={s.unbilled || 0} icon={FileText} color="text-gray-600" />
        </div>
      )
    }
    return null
  }

  const renderReport = () => {
    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading report...</div>

    if (selectedReport === 'revenue-summary') {
      return (
        <div className="space-y-4">
          {renderSummaryCards()}
          <h4 className="font-medium text-gray-900">Revenue by Billing Group</h4>
          <DataTable headers={['Billing Group', 'Billed', 'Collected', 'Outstanding']}>
            {(reportData.byBillingGroup || []).map((row: any, i: number) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{row.billing_group || '-'}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(row.billed)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(row.collected)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency((row.billed || 0) - (row.collected || 0))}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      )
    }

    if (selectedReport === 'aged-analysis') {
      return (
        <DataTable headers={['Account No', 'Name', 'Category', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', 'Over 90', 'Total']}>
          {(reportData || []).map((row: any, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 font-medium">{row.account_no}</td>
              <td className="px-4 py-2">{row.name}</td>
              <td className="px-4 py-2">{row.category}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(row.current_due)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(row.days_1_30)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(row.days_31_60)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(row.days_61_90)}</td>
              <td className="px-4 py-2 text-right text-red-600">{formatCurrency(row.over_90)}</td>
              <td className="px-4 py-2 text-right font-medium">{formatCurrency(row.balance)}</td>
            </tr>
          ))}
        </DataTable>
      )
    }

    if (selectedReport === 'debtors-list') {
      return (
        <DataTable headers={['Account No', 'Name', 'Phone', 'Billing Group', 'Zone', 'Balance', 'Unpaid Bills', 'Oldest Due']}>
          {(reportData || []).map((row: any, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 font-medium">{row.account_no}</td>
              <td className="px-4 py-2">{row.name}</td>
              <td className="px-4 py-2">{row.telephone || '-'}</td>
              <td className="px-4 py-2">{row.billing_group || '-'}</td>
              <td className="px-4 py-2">{row.zone || '-'}</td>
              <td className="px-4 py-2 text-right font-medium text-red-600">{formatCurrency(row.balance)}</td>
              <td className="px-4 py-2 text-right">{row.unpaid_bills}</td>
              <td className="px-4 py-2">{formatDate(row.oldest_due_date)}</td>
            </tr>
          ))}
        </DataTable>
      )
    }

    if (selectedReport === 'daily-payments') {
      return (
        <div className="space-y-6">
          <h4 className="font-medium text-gray-900">Payment Summary for {reportData.date}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="text-sm font-medium text-gray-500 mb-2">By Payment Mode</h5>
              <DataTable headers={['Mode', 'Count', 'Total']}>
                {(reportData.summary || []).map((row: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{row.payment_mode || '-'}</td>
                    <td className="px-4 py-2 text-right">{row.count}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
            <div>
              <h5 className="text-sm font-medium text-gray-500 mb-2">By Cashier</h5>
              <DataTable headers={['Cashier', 'Count', 'Total']}>
                {(reportData.byCashier || []).map((row: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{row.cashier || 'Unknown'}</td>
                    <td className="px-4 py-2 text-right">{row.count}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          </div>
        </div>
      )
    }

    if (selectedReport === 'collection-efficiency') {
      return (
        <DataTable headers={['Billing Group', 'Billed Amount', 'Collected', 'Efficiency %']}>
          {(reportData || []).map((row: any, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2">{row.billing_group || 'Unknown'}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(row.billed_amount)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(row.collected_amount)}</td>
              <td className="px-4 py-2 text-right">
                <span className={`font-medium ${row.efficiency >= 90 ? 'text-green-600' : row.efficiency >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                  {row.efficiency}%
                </span>
              </td>
            </tr>
          ))}
        </DataTable>
      )
    }

    if (selectedReport === 'consumption-summary') {
      return (
        <DataTable headers={['Billing Group', 'Zone', 'Readings', 'Total Consumption', 'Avg', 'Estimated', 'Anomalies']}>
          {(reportData || []).map((row: any, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2">{row.billing_group || '-'}</td>
              <td className="px-4 py-2">{row.zone || '-'}</td>
              <td className="px-4 py-2 text-right">{row.reading_count}</td>
              <td className="px-4 py-2 text-right">{row.total_consumption}</td>
              <td className="px-4 py-2 text-right">{Number(row.avg_consumption).toFixed(2)}</td>
              <td className="px-4 py-2 text-right">{row.estimated_count}</td>
              <td className="px-4 py-2 text-right">{row.anomaly_count}</td>
            </tr>
          ))}
        </DataTable>
      )
    }

    if (selectedReport === 'customer-summary') {
      return (
        <div className="space-y-4">
          {renderSummaryCards()}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="text-sm font-medium text-gray-500 mb-2">By Category</h5>
              <DataTable headers={['Category', 'Count']}>
                {(reportData.byCategory || []).map((row: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{row.category || '-'}</td>
                    <td className="px-4 py-2 text-right">{row.count}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
            <div>
              <h5 className="text-sm font-medium text-gray-500 mb-2">By Billing Group</h5>
              <DataTable headers={['Billing Group', 'Count']}>
                {(reportData.byBillingGroup || []).map((row: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{row.billing_group || '-'}</td>
                    <td className="px-4 py-2 text-right">{row.count}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          </div>
        </div>
      )
    }

    if (selectedReport === 'meter-reading-summary') {
      return (
        <div className="space-y-4">
          {renderSummaryCards()}
          <h4 className="font-medium text-gray-900">By Reading Code</h4>
          <DataTable headers={['Reading Code', 'Code', 'Count']}>
            {(reportData.byCode || []).map((row: any, i: number) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{row.reading_code || '-'}</td>
                <td className="px-4 py-2">{row.code || '-'}</td>
                <td className="px-4 py-2 text-right">{row.count}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      )
    }

    if (selectedReport === 'payment-reconciliation') {
      return (
        <div className="space-y-6">
          <h4 className="font-medium text-gray-900">Daily Breakdown</h4>
          <DataTable headers={['Date', 'Payments', 'Total', 'Allocated']}>
            {(reportData.daily || []).map((row: any, i: number) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{formatDate(row.date)}</td>
                <td className="px-4 py-2 text-right">{row.payment_count}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(row.total_payments)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(row.total_allocated)}</td>
              </tr>
            ))}
          </DataTable>
          <h4 className="font-medium text-gray-900">By Payment Mode</h4>
          <DataTable headers={['Mode', 'Count', 'Total']}>
            {(reportData.byMode || []).map((row: any, i: number) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{row.payment_mode || '-'}</td>
                <td className="px-4 py-2 text-right">{row.count}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(row.total)}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      )
    }

    if (selectedReport === 'zone-performance') {
      return (
        <DataTable headers={['Zone', 'Customers', 'Billed', 'Collected', 'Collection Rate %', 'Outstanding']}>
          {(reportData || []).map((row: any, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2">{row.zone || 'Unknown'}</td>
              <td className="px-4 py-2 text-right">{row.customer_count}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(row.billed)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(row.collected)}</td>
              <td className="px-4 py-2 text-right">
                <span className={`font-medium ${row.collection_rate >= 90 ? 'text-green-600' : row.collection_rate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                  {row.collection_rate}%
                </span>
              </td>
              <td className="px-4 py-2 text-right">{formatCurrency(row.outstanding)}</td>
            </tr>
          ))}
        </DataTable>
      )
    }

    return <div className="p-8 text-center text-gray-500">Select a report to generate</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500">Generate and export system reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Report Type Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Report Types</h3>
            <div className="space-y-1">
              {reportTypes.map((rt) => (
                <button
                  key={rt.id}
                  onClick={() => setSelectedReport(rt.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    selectedReport === rt.id ? 'bg-sky-50 text-sky-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <rt.icon className={`w-4 h-4 ${selectedReport === rt.id ? 'text-sky-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="font-medium">{rt.name}</p>
                    <p className="text-xs text-gray-500">{rt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-medium text-gray-900">Filters</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <span className="text-gray-400">-</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              {(selectedReport === 'aged-analysis' || selectedReport === 'debtors-list' || selectedReport === 'consumption-summary' || selectedReport === 'revenue-summary' || selectedReport === 'zone-performance') && (
                <>
                  <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">All Zones</option>
                    {(zonesData?.data || []).map((z: any) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                  <select value={billingGroupId} onChange={(e) => setBillingGroupId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">All Billing Groups</option>
                    {(billingGroupsData?.data || []).map((bg: any) => (
                      <option key={bg.id} value={bg.id}>{bg.name}</option>
                    ))}
                  </select>
                </>
              )}
              {selectedReport === 'debtors-list' && (
                <>
                  <input type="number" placeholder="Min balance" value={minBalance} onChange={(e) => setMinBalance(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-28" />
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </>
              )}
              <button onClick={handleExport} className="ml-auto inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            {renderReport()}
          </div>
        </div>
      </div>
    </div>
  )
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-3 font-medium text-gray-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
