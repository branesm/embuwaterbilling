import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { Unplug, Plug, History, Settings, BarChart3, CheckSquare, Square, Printer, Eye, X } from 'lucide-react'

export default function DisconnectionsPage() {
  const [activeTab, setActiveTab] = useState('orders')
  const queryClient = useQueryClient()

  // Filters
  const [filters, setFilters] = useState({ billing_group_id: '', min_balance: '', min_months: '', area_code: '' })
  const [reportFilters, setReportFilters] = useState({ date_from: '', date_to: '', billing_group_id: '', area_code: '', status: '', profile_id: '' })
  const [historyFilters, setHistoryFilters] = useState({ customer_id: '', date_from: '', date_to: '' })

  // Selections
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [captureItem, setCaptureItem] = useState<any>(null)
  const [reconnectItem, setReconnectItem] = useState<any>(null)
  const [nonDiscItem, setNonDiscItem] = useState<any>(null)
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [editingProfile, setEditingProfile] = useState<any>(null)

  // Data queries
  const { data: disconnectionList, refetch } = useQuery({
    queryKey: ['disconnection-orders', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.billing_group_id) params.append('billing_group_id', filters.billing_group_id)
      if (filters.min_balance) params.append('min_balance', filters.min_balance)
      if (filters.min_months) params.append('min_months', filters.min_months)
      if (filters.area_code) params.append('area_code', filters.area_code)
      const res = await api.get(`/disconnections/orders/prepare?${params}`)
      return res.data.data
    },
    enabled: false
  })

  const { data: reconnections, refetch: refetchReconnections } = useQuery({
    queryKey: ['reconnections'],
    queryFn: async () => {
      const res = await api.get('/disconnections/reconnections')
      return res.data.data
    }
  })

  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ['disconnection-history', historyFilters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (historyFilters.customer_id) params.append('customer_id', historyFilters.customer_id)
      if (historyFilters.date_from) params.append('date_from', historyFilters.date_from)
      if (historyFilters.date_to) params.append('date_to', historyFilters.date_to)
      const res = await api.get(`/disconnections/history?${params}`)
      return res.data.data
    }
  })

  const { data: profiles } = useQuery({
    queryKey: ['disconnection-profiles'],
    queryFn: async () => {
      const res = await api.get('/disconnections/profiles')
      return res.data.data
    }
  })

  const { data: modes } = useQuery({
    queryKey: ['disconnection-modes'],
    queryFn: async () => {
      const res = await api.get('/disconnections/modes')
      return res.data.data
    }
  })

  const { data: nonDiscCodes } = useQuery({
    queryKey: ['non-disconnection-codes'],
    queryFn: async () => {
      const res = await api.get('/disconnections/non-disconnection-codes')
      return res.data.data
    }
  })

  const { data: report, refetch: refetchReport } = useQuery({
    queryKey: ['disconnection-report', reportFilters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (reportFilters.date_from) params.append('date_from', reportFilters.date_from)
      if (reportFilters.date_to) params.append('date_to', reportFilters.date_to)
      if (reportFilters.billing_group_id) params.append('billing_group_id', reportFilters.billing_group_id)
      if (reportFilters.area_code) params.append('area_code', reportFilters.area_code)
      if (reportFilters.status) params.append('status', reportFilters.status)
      if (reportFilters.profile_id) params.append('profile_id', reportFilters.profile_id)
      const res = await api.get(`/disconnections/report?${params}`)
      return res.data
    },
    enabled: false
  })

  // Mutations
  const createOrder = useMutation({
    mutationFn: (data: any) => api.post('/disconnections/orders', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['disconnection-orders'] }); toast({ title: 'Order created' }) }
  })

  const bulkCreateOrders = useMutation({
    mutationFn: (data: any) => api.post('/disconnections/orders/bulk', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disconnection-orders'] })
      toast({ title: 'Bulk orders created' })
      setSelectedItems([])
    }
  })

  const captureDisc = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.post(`/disconnections/${id}/capture`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disconnection-orders'] })
      setCaptureItem(null)
      toast({ title: 'Disconnection captured' })
    }
  })

  const reconnect = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.post(`/disconnections/${id}/reconnect`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconnections'] })
      setReconnectItem(null)
      toast({ title: 'Reconnection processed' })
    }
  })

  const markNonDisconnect = useMutation({
    mutationFn: (data: any) => api.post('/disconnections/non-disconnect', data),
    onSuccess: () => { setNonDiscItem(null); toast({ title: 'Marked as non-disconnect' }) }
  })

  const saveProfile = useMutation({
    mutationFn: (data: any) => {
      if (editingProfile?.id) return api.put(`/disconnections/profiles/${editingProfile.id}`, data)
      return api.post('/disconnections/profiles', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disconnection-profiles'] })
      setShowProfileForm(false)
      setEditingProfile(null)
      toast({ title: 'Profile saved' })
    }
  })

  const toggleSelect = (id: number) => {
    setSelectedItems((prev: number[]) => prev.includes(id) ? prev.filter((i: number) => i !== id) : [...prev, id])
  }

  const selectAll = () => {
    if (selectedItems.length === disconnectionList?.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(disconnectionList?.map((d: any) => d.customer_id) || [])
    }
  }

  // Forms
  const [captureForm, setCaptureForm] = useState({ disc_by: '', meter_reading: '', comments: '' })
  const [reconnectForm, setReconnectForm] = useState({ reconnected_by: '', reconnection_fee_paid: '', ref_no: '' })
  const [nonDiscForm, setNonDiscForm] = useState({ code_id: '', reason: '', valid_until: '' })
  const [profileForm, setProfileForm] = useState({ code: '', name: '', min_balance: '', min_months_unpaid: '', auto_disconnect: false, description: '' })

  const openProfileForm = (profile?: any) => {
    if (profile) {
      setEditingProfile(profile)
      setProfileForm({
        code: profile.code,
        name: profile.name,
        min_balance: String(profile.min_balance),
        min_months_unpaid: String(profile.min_months_unpaid),
        auto_disconnect: profile.auto_disconnect,
        description: profile.description || ''
      })
    } else {
      setEditingProfile(null)
      setProfileForm({ code: '', name: '', min_balance: '', min_months_unpaid: '', auto_disconnect: false, description: '' })
    }
    setShowProfileForm(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Disconnections & Reconnections</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-[500px]">
          <TabsTrigger value="orders"><Unplug className="w-4 h-4 mr-1" />Orders</TabsTrigger>
          <TabsTrigger value="reconnections"><Plug className="w-4 h-4 mr-1" />Reconnect</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-1" />History</TabsTrigger>
          <TabsTrigger value="profiles"><Settings className="w-4 h-4 mr-1" />Profiles</TabsTrigger>
          <TabsTrigger value="report"><BarChart3 className="w-4 h-4 mr-1" />Report</TabsTrigger>
        </TabsList>

        {/* ORDERS */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Prepare Disconnection List</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div className="space-y-2"><Label>Billing Group</Label><Input value={filters.billing_group_id} onChange={e => setFilters({ ...filters, billing_group_id: e.target.value })} placeholder="ID" /></div>
                <div className="space-y-2"><Label>Min Balance</Label><Input type="number" value={filters.min_balance} onChange={e => setFilters({ ...filters, min_balance: e.target.value })} /></div>
                <div className="space-y-2"><Label>Min Months</Label><Input type="number" value={filters.min_months} onChange={e => setFilters({ ...filters, min_months: e.target.value })} /></div>
                <div className="space-y-2"><Label>Area Code</Label><Input value={filters.area_code} onChange={e => setFilters({ ...filters, area_code: e.target.value })} placeholder="EMB, GKA..." /></div>
                <div className="flex items-end gap-2">
                  <Button onClick={() => refetch()}>Generate List</Button>
                </div>
              </div>

              {selectedItems.length > 0 && (
                <div className="flex gap-2 mb-2">
                  <Button size="sm" variant="destructive" onClick={() => bulkCreateOrders.mutate({ customer_ids: selectedItems, reason: 'Non-payment', ref_no: `BULK-${Date.now()}` })}>
                    Create {selectedItems.length} Orders
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedItems([])}>Clear Selection</Button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2"><button onClick={selectAll}>{selectedItems.length === disconnectionList?.length && disconnectionList?.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}</button></th>
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Walk</th>
                      <th className="px-4 py-2 text-left">Meter</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2 text-center">Bills</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disconnectionList?.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-4 text-center text-gray-500">Generate a list to see results</td></tr>
                    ) : (
                      disconnectionList?.map((item: any) => (
                        <tr key={item.customer_id} className="border-b hover:bg-gray-50">
                          <td className="px-2 py-2"><button onClick={() => toggleSelect(item.customer_id)}>{selectedItems.includes(item.customer_id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}</button></td>
                          <td className="px-4 py-2">{item.account_no}</td>
                          <td className="px-4 py-2">{item.name}</td>
                          <td className="px-4 py-2">{item.walk_no}</td>
                          <td className="px-4 py-2">{item.meter_no}</td>
                          <td className="px-4 py-2 text-right font-bold text-red-600">{item.total_balance?.toLocaleString()}</td>
                          <td className="px-4 py-2 text-center">{item.unpaid_bills}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="destructive" onClick={() => createOrder.mutate({ customer_id: item.customer_id, reason: 'Non-payment' })}>Order</Button>
                              <Button size="sm" variant="outline" onClick={() => setNonDiscItem(item)}>No-Disc</Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pending Orders to Capture */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Orders Pending Capture</CardTitle></CardHeader>
            <CardContent>
              <PendingOrdersList onCapture={setCaptureItem} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* RECONNECTIONS */}
        <TabsContent value="reconnections" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Reconnection List</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2 text-left">Disc Date</th>
                      <th className="px-4 py-2 text-left">Meter</th>
                      <th className="px-4 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconnections?.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-500">No reconnections pending</td></tr>
                    ) : (
                      reconnections?.map((item: any) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{item.account_no}</td>
                          <td className="px-4 py-2">{item.customer_name}</td>
                          <td className="px-4 py-2 text-right">{item.balance?.toLocaleString()}</td>
                          <td className="px-4 py-2">{item.disc_date ? new Date(item.disc_date).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-2">{item.meter_no}</td>
                          <td className="px-4 py-2"><Button size="sm" variant="default" onClick={() => setReconnectItem(item)}>Reconnect</Button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Disconnection History</CardTitle>
                <div className="flex gap-2">
                  <Input className="w-32" placeholder="Customer ID" value={historyFilters.customer_id} onChange={e => setHistoryFilters({ ...historyFilters, customer_id: e.target.value })} />
                  <Input type="date" value={historyFilters.date_from} onChange={e => setHistoryFilters({ ...historyFilters, date_from: e.target.value })} />
                  <Input type="date" value={historyFilters.date_to} onChange={e => setHistoryFilters({ ...historyFilters, date_to: e.target.value })} />
                  <Button size="sm" onClick={() => refetchHistory()}>Filter</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Reason</th>
                      <th className="px-4 py-2 text-left">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history?.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-500">No history found</td></tr>
                    ) : (
                      history?.map((item: any) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{item.account_no}</td>
                          <td className="px-4 py-2">{item.customer_name}</td>
                          <td className="px-4 py-2">{item.disc_date ? new Date(item.disc_date).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-2"><Badge variant={item.status === 'disconnected' ? 'destructive' : item.status === 'reconnected' ? 'default' : 'secondary'}>{item.status}</Badge></td>
                          <td className="px-4 py-2">{item.reason}</td>
                          <td className="px-4 py-2">{item.disc_by || item.reconnected_by || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROFILES */}
        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Disconnection Profiles</CardTitle>
                <Button onClick={() => openProfileForm()}>Add Profile</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-right">Min Balance</th>
                      <th className="px-4 py-2 text-center">Min Months</th>
                      <th className="px-4 py-2 text-center">Auto</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles?.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-500">No profiles found</td></tr>
                    ) : (
                      profiles?.map((p: any) => (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{p.code}</td>
                          <td className="px-4 py-2">{p.name}</td>
                          <td className="px-4 py-2 text-right">{p.min_balance?.toLocaleString()}</td>
                          <td className="px-4 py-2 text-center">{p.min_months_unpaid}</td>
                          <td className="px-4 py-2 text-center">{p.auto_disconnect ? 'Yes' : 'No'}</td>
                          <td className="px-4 py-2"><Button size="sm" variant="outline" onClick={() => openProfileForm(p)}>Edit</Button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Disconnection Modes</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {modes?.map((m: any) => (
                  <div key={m.id} className="p-3 border rounded-lg text-sm"><strong>{m.code}</strong><br/>{m.name}</div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Non-Disconnection Codes</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {nonDiscCodes?.map((c: any) => (
                  <div key={c.id} className="p-3 border rounded-lg text-sm"><strong>{c.code}</strong><br/>{c.name}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORT */}
        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Disconnection Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                <Input type="date" value={reportFilters.date_from} onChange={e => setReportFilters({ ...reportFilters, date_from: e.target.value })} />
                <Input type="date" value={reportFilters.date_to} onChange={e => setReportFilters({ ...reportFilters, date_to: e.target.value })} />
                <Input placeholder="Billing Group ID" value={reportFilters.billing_group_id} onChange={e => setReportFilters({ ...reportFilters, billing_group_id: e.target.value })} />
                <Input placeholder="Area Code" value={reportFilters.area_code} onChange={e => setReportFilters({ ...reportFilters, area_code: e.target.value })} />
                <select className="h-10 px-3 rounded-md border border-gray-300 text-sm" value={reportFilters.status} onChange={e => setReportFilters({ ...reportFilters, status: e.target.value })}>
                  <option value="">All Statuses</option>
                  <option value="ordered">Ordered</option>
                  <option value="disconnected">Disconnected</option>
                  <option value="reconnected">Reconnected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <Button onClick={() => refetchReport()}>Generate Report</Button>
              </div>

              {report?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div className="p-4 bg-gray-50 rounded-lg text-center"><div className="text-2xl font-bold">{report.summary.total}</div><div className="text-xs text-gray-500">Total</div></div>
                  <div className="p-4 bg-yellow-50 rounded-lg text-center"><div className="text-2xl font-bold text-yellow-700">{report.summary.ordered}</div><div className="text-xs text-gray-500">Ordered</div></div>
                  <div className="p-4 bg-red-50 rounded-lg text-center"><div className="text-2xl font-bold text-red-700">{report.summary.disconnected}</div><div className="text-xs text-gray-500">Disconnected</div></div>
                  <div className="p-4 bg-green-50 rounded-lg text-center"><div className="text-2xl font-bold text-green-700">{report.summary.reconnected}</div><div className="text-xs text-gray-500">Reconnected</div></div>
                  <div className="p-4 bg-blue-50 rounded-lg text-center"><div className="text-2xl font-bold text-blue-700">{report.summary.reconnection_fees?.toLocaleString()}</div><div className="text-xs text-gray-500">Fees Collected</div></div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-4 py-2 text-left">Area</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">By</th>
                      <th className="px-4 py-2 text-right">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report?.data?.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-500">No data — generate report</td></tr>
                    ) : (
                      report?.data?.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{item.disc_date ? new Date(item.disc_date).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-2">{item.account_no}</td>
                          <td className="px-4 py-2">{item.customer_name}</td>
                          <td className="px-4 py-2">{item.area_code}</td>
                          <td className="px-4 py-2"><Badge variant={item.status === 'disconnected' ? 'destructive' : item.status === 'reconnected' ? 'default' : 'secondary'}>{item.status}</Badge></td>
                          <td className="px-4 py-2">{item.disc_by || item.reconnected_by || '-'}</td>
                          <td className="px-4 py-2 text-right">{item.reconnection_fee_paid ? parseFloat(item.reconnection_fee_paid).toLocaleString() : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Capture Disconnection Modal */}
      {captureItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Capture Disconnection</h2>
              <button onClick={() => setCaptureItem(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm"><strong>{captureItem.account_no}</strong> — {captureItem.customer_name || captureItem.name}</div>
              <div className="space-y-2"><Label>Disconnected By</Label><Input value={captureForm.disc_by} onChange={e => setCaptureForm({ ...captureForm, disc_by: e.target.value })} /></div>
              <div className="space-y-2"><Label>Meter Reading</Label><Input type="number" value={captureForm.meter_reading} onChange={e => setCaptureForm({ ...captureForm, meter_reading: e.target.value })} /></div>
              <div className="space-y-2"><Label>Comments</Label><Input value={captureForm.comments} onChange={e => setCaptureForm({ ...captureForm, comments: e.target.value })} /></div>
              <div className="flex gap-2">
                <Button onClick={() => captureDisc.mutate({ id: captureItem.id, data: captureForm })} disabled={captureDisc.isPending}>Capture</Button>
                <Button variant="outline" onClick={() => setCaptureItem(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reconnect Modal */}
      {reconnectItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Process Reconnection</h2>
              <button onClick={() => setReconnectItem(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm"><strong>{reconnectItem.account_no}</strong> — {reconnectItem.customer_name}</div>
              <div className="space-y-2"><Label>Reconnected By</Label><Input value={reconnectForm.reconnected_by} onChange={e => setReconnectForm({ ...reconnectForm, reconnected_by: e.target.value })} /></div>
              <div className="space-y-2"><Label>Reconnection Fee Paid</Label><Input type="number" value={reconnectForm.reconnection_fee_paid} onChange={e => setReconnectForm({ ...reconnectForm, reconnection_fee_paid: e.target.value })} /></div>
              <div className="space-y-2"><Label>Reference No</Label><Input value={reconnectForm.ref_no} onChange={e => setReconnectForm({ ...reconnectForm, ref_no: e.target.value })} /></div>
              <div className="flex gap-2">
                <Button onClick={() => reconnect.mutate({ id: reconnectItem.id, data: reconnectForm })} disabled={reconnect.isPending}>Reconnect</Button>
                <Button variant="outline" onClick={() => setReconnectItem(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Non-Disconnection Modal */}
      {nonDiscItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Mark Non-Disconnection</h2>
              <button onClick={() => setNonDiscItem(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm"><strong>{nonDiscItem.account_no}</strong> — {nonDiscItem.name}</div>
              <div className="space-y-2"><Label>Code</Label>
                <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={nonDiscForm.code_id} onChange={e => setNonDiscForm({ ...nonDiscForm, code_id: e.target.value })}>
                  <option value="">Select code...</option>
                  {nonDiscCodes?.map((c: any) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Reason</Label><Input value={nonDiscForm.reason} onChange={e => setNonDiscForm({ ...nonDiscForm, reason: e.target.value })} /></div>
              <div className="space-y-2"><Label>Valid Until</Label><Input type="date" value={nonDiscForm.valid_until} onChange={e => setNonDiscForm({ ...nonDiscForm, valid_until: e.target.value })} /></div>
              <div className="flex gap-2">
                <Button onClick={() => markNonDisconnect.mutate({ customer_id: nonDiscItem.customer_id, ...nonDiscForm })} disabled={markNonDisconnect.isPending}>Save</Button>
                <Button variant="outline" onClick={() => setNonDiscItem(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Form Modal */}
      {showProfileForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingProfile ? 'Edit Profile' : 'New Profile'}</h2>
              <button onClick={() => setShowProfileForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2"><Label>Code</Label><Input value={profileForm.code} onChange={e => setProfileForm({ ...profileForm, code: e.target.value })} /></div>
              <div className="space-y-2"><Label>Name</Label><Input value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Min Balance</Label><Input type="number" value={profileForm.min_balance} onChange={e => setProfileForm({ ...profileForm, min_balance: e.target.value })} /></div>
                <div className="space-y-2"><Label>Min Months</Label><Input type="number" value={profileForm.min_months_unpaid} onChange={e => setProfileForm({ ...profileForm, min_months_unpaid: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="auto" checked={profileForm.auto_disconnect} onChange={e => setProfileForm({ ...profileForm, auto_disconnect: e.target.checked })} />
                <Label htmlFor="auto">Auto Disconnect</Label>
              </div>
              <div className="space-y-2"><Label>Description</Label><Input value={profileForm.description} onChange={e => setProfileForm({ ...profileForm, description: e.target.value })} /></div>
              <div className="flex gap-2">
                <Button onClick={() => saveProfile.mutate(profileForm)} disabled={saveProfile.isPending}>Save</Button>
                <Button variant="outline" onClick={() => setShowProfileForm(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Sub-component for pending orders
function PendingOrdersList({ onCapture }: { onCapture: (item: any) => void }) {
  const { data: orders } = useQuery({
    queryKey: ['pending-orders'],
    queryFn: async () => {
      const res = await api.get('/disconnections/history?limit=100')
      return res.data.data?.filter((o: any) => o.status === 'ordered') || []
    }
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">Account</th>
            <th className="px-4 py-2 text-left">Customer</th>
            <th className="px-4 py-2 text-left">Ordered</th>
            <th className="px-4 py-2 text-left">Reason</th>
            <th className="px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders?.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500">No pending orders</td></tr>
          ) : (
            orders?.map((item: any) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{item.account_no}</td>
                <td className="px-4 py-2">{item.customer_name}</td>
                <td className="px-4 py-2">{item.disc_date ? new Date(item.disc_date).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-2">{item.reason}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <Button size="sm" variant="destructive" onClick={() => onCapture(item)}>Capture</Button>
                    <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-3 h-3" /></Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
