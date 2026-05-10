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
import { Gauge, List, Plus, BarChart3, Settings, Search, Eye, X, Wrench, ArrowRightLeft, RefreshCw } from 'lucide-react'

export default function MeterManagementPage() {
  const [activeTab, setActiveTab] = useState('list')
  const queryClient = useQueryClient()

  // Filters & search
  const [listFilters, setListFilters] = useState({ status: '', meter_type_id: '', q: '' })
  const [detailMeter, setDetailMeter] = useState<any>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [detailSubTab, setDetailSubTab] = useState('info')

  // Customer lookup
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)

  // Forms
  const [meterForm, setMeterForm] = useState<any>({
    meter_no: '', meter_type_id: '', meter_location: '', customer_id: '',
    install_date: '', barcode_no: '', digits: 6, max_reading: '',
    condition: 'new', supplier: '', manufacture_date: '', expected_years: '', comments: ''
  })
  const [movementForm, setMovementForm] = useState({ movement_type: '', to_customer_id: '', to_status: '', reference_no: '', comments: '' })
  const [serviceForm, setServiceForm] = useState({ reading: '', service_date: '', meter_status: '', comments: '' })
  const [replacementForm, setReplacementForm] = useState({ new_meter_id: '', old_final_reading: '', new_initial_reading: '', reason: '', replacement_date: '' })

  // Master meters & types
  const [mmForm, setMmForm] = useState<any>({})
  const [showMmForm, setShowMmForm] = useState(false)
  const [editingMm, setEditingMm] = useState<any>(null)
  const [typeForm, setTypeForm] = useState<any>({})
  const [showTypeForm, setShowTypeForm] = useState(false)
  const [editingType, setEditingType] = useState<any>(null)

  // Data queries
  const { data: metersData, refetch: refetchMeters } = useQuery({
    queryKey: ['meters', listFilters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (listFilters.status) params.append('status', listFilters.status)
      if (listFilters.meter_type_id) params.append('meter_type_id', listFilters.meter_type_id)
      if (listFilters.q) params.append('q', listFilters.q)
      params.append('limit', '50')
      const res = await api.get(`/meters?${params}`)
      return res.data
    }
  })

  const { data: stats } = useQuery({
    queryKey: ['meter-stats'],
    queryFn: async () => {
      const res = await api.get('/meters/stats/dashboard')
      return res.data.data
    }
  })

  const { data: meterTypes } = useQuery({
    queryKey: ['meter-types'],
    queryFn: async () => {
      const res = await api.get('/meters/types/all')
      return res.data.data
    }
  })

  const { data: typesCrud, refetch: refetchTypes } = useQuery({
    queryKey: ['meter-types-crud'],
    queryFn: async () => {
      const res = await api.get('/meters/types')
      return res.data.data
    },
    enabled: activeTab === 'types'
  })

  const { data: masterMeters, refetch: refetchMm } = useQuery({
    queryKey: ['master-meters'],
    queryFn: async () => {
      const res = await api.get('/meters/master-meters')
      return res.data.data
    },
    enabled: activeTab === 'master'
  })

  const { data: dmaRegions } = useQuery({
    queryKey: ['dma-regions'],
    queryFn: async () => {
      const res = await api.get('/meters/dma-regions')
      return res.data.data
    }
  })

  const { data: movements, refetch: refetchMovements } = useQuery({
    queryKey: ['meter-movements', detailMeter?.id],
    queryFn: async () => {
      const res = await api.get(`/meters/${detailMeter.id}/movements`)
      return res.data.data
    },
    enabled: !!detailMeter?.id && detailSubTab === 'movements'
  })

  const { data: servicing, refetch: refetchServicing } = useQuery({
    queryKey: ['meter-servicing', detailMeter?.id],
    queryFn: async () => {
      const res = await api.get(`/meters/${detailMeter.id}/servicing`)
      return res.data.data
    },
    enabled: !!detailMeter?.id && detailSubTab === 'servicing'
  })

  const { data: replacements, refetch: refetchReplacements } = useQuery({
    queryKey: ['meter-replacements', detailMeter?.id],
    queryFn: async () => {
      const res = await api.get(`/meters/${detailMeter.id}/replacements`)
      return res.data.data
    },
    enabled: !!detailMeter?.id && detailSubTab === 'replacements'
  })

  // Mutations
  const createMeter = useMutation({
    mutationFn: (data: any) => api.post('/meters', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meters'] })
      queryClient.invalidateQueries({ queryKey: ['meter-stats'] })
      toast({ title: 'Meter registered successfully' })
      setMeterForm({ meter_no: '', meter_type_id: '', meter_location: '', customer_id: '', install_date: '', barcode_no: '', digits: 6, max_reading: '', condition: 'new', supplier: '', manufacture_date: '', expected_years: '', comments: '' })
      setSelectedCustomer(null)
    },
    onError: () => toast({ title: 'Failed to register meter', variant: 'destructive' })
  })

  const updateMeter = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/meters/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meters'] })
      refetchMeters()
      toast({ title: 'Meter updated' })
    }
  })

  const recordMovement = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.post(`/meters/${id}/movement`, data),
    onSuccess: () => {
      refetchMovements()
      queryClient.invalidateQueries({ queryKey: ['meters'] })
      toast({ title: 'Movement recorded' })
      setMovementForm({ movement_type: '', to_customer_id: '', to_status: '', reference_no: '', comments: '' })
    }
  })

  const recordService = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.post(`/meters/${id}/servicing`, data),
    onSuccess: () => {
      refetchServicing()
      queryClient.invalidateQueries({ queryKey: ['meters'] })
      toast({ title: 'Service recorded' })
      setServiceForm({ reading: '', service_date: '', meter_status: '', comments: '' })
    }
  })

  const recordReplacement = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.post(`/meters/${id}/replace`, data),
    onSuccess: () => {
      refetchReplacements()
      queryClient.invalidateQueries({ queryKey: ['meters'] })
      toast({ title: 'Replacement recorded' })
      setReplacementForm({ new_meter_id: '', old_final_reading: '', new_initial_reading: '', reason: '', replacement_date: '' })
    }
  })

  const saveMm = useMutation({
    mutationFn: (data: any) => {
      if (editingMm?.id) return api.put(`/meters/master-meters/${editingMm.id}`, data)
      return api.post('/meters/master-meters', data)
    },
    onSuccess: () => { refetchMm(); setShowMmForm(false); setEditingMm(null); toast({ title: 'Saved' }) }
  })

  const deleteMm = useMutation({
    mutationFn: (id: number) => api.delete(`/meters/master-meters/${id}`),
    onSuccess: () => { refetchMm(); toast({ title: 'Deleted' }) }
  })

  const saveType = useMutation({
    mutationFn: (data: any) => {
      if (editingType?.id) return api.put(`/meters/types/${editingType.id}`, data)
      return api.post('/meters/types', data)
    },
    onSuccess: () => { refetchTypes(); setShowTypeForm(false); setEditingType(null); toast({ title: 'Saved' }) }
  })

  const deleteType = useMutation({
    mutationFn: (id: number) => api.delete(`/meters/types/${id}`),
    onSuccess: () => { refetchTypes(); toast({ title: 'Deleted' }) }
  })

  const searchCustomers = async () => {
    if (!customerSearch.trim()) return
    const res = await api.get(`/customers/search?q=${customerSearch}`)
    setCustomerResults(res.data.data || [])
  }

  const selectCustomer = (customer: any) => {
    setSelectedCustomer(customer)
    setMeterForm({ ...meterForm, customer_id: String(customer.id) })
    setCustomerResults([])
    setCustomerSearch('')
  }

  const openDetail = (meter: any) => {
    setDetailMeter(meter)
    setShowDetail(true)
    setDetailSubTab('info')
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      faulty: 'bg-red-100 text-red-700',
      removed: 'bg-gray-100 text-gray-700',
      in_store: 'bg-blue-100 text-blue-700'
    }
    return <Badge className={map[status] || 'bg-gray-100 text-gray-700'}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Meter Management</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-[500px]">
          <TabsTrigger value="list"><List className="w-4 h-4 mr-1" />List</TabsTrigger>
          <TabsTrigger value="register"><Plus className="w-4 h-4 mr-1" />Register</TabsTrigger>
          <TabsTrigger value="master"><Gauge className="w-4 h-4 mr-1" />Master</TabsTrigger>
          <TabsTrigger value="types"><Settings className="w-4 h-4 mr-1" />Types</TabsTrigger>
          <TabsTrigger value="dashboard"><BarChart3 className="w-4 h-4 mr-1" />Stats</TabsTrigger>
        </TabsList>

        {/* LIST */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg">Meters</CardTitle>
                <div className="flex gap-2">
                  <Input placeholder="Search meter no, barcode, customer..." className="w-64" value={listFilters.q} onChange={e => setListFilters({ ...listFilters, q: e.target.value })} onKeyDown={e => e.key === 'Enter' && refetchMeters()} />
                  <select className="h-9 px-3 rounded-md border border-gray-300 text-sm" value={listFilters.status} onChange={e => setListFilters({ ...listFilters, status: e.target.value })}>
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="faulty">Faulty</option>
                    <option value="removed">Removed</option>
                    <option value="in_store">In Store</option>
                  </select>
                  <select className="h-9 px-3 rounded-md border border-gray-300 text-sm" value={listFilters.meter_type_id} onChange={e => setListFilters({ ...listFilters, meter_type_id: e.target.value })}>
                    <option value="">All Types</option>
                    {meterTypes?.map((t: any) => <option key={t.id} value={t.id}>{t.type_id}</option>)}
                  </select>
                  <Button size="sm" onClick={() => refetchMeters()}>Search</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Meter No</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Reading</th>
                      <th className="px-4 py-2 text-left">Install Date</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metersData?.data?.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-500">No meters found</td></tr>
                    ) : (
                      metersData?.data?.map((m: any) => (
                        <tr key={m.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-sky-600">{m.meter_no}</td>
                          <td className="px-4 py-2">{m.meter_type_name || '-'}</td>
                          <td className="px-4 py-2">{m.account_no ? `${m.account_no} - ${m.customer_name}` : 'Not assigned'}</td>
                          <td className="px-4 py-2">{statusBadge(m.meter_status)}</td>
                          <td className="px-4 py-2">{m.current_reading}</td>
                          <td className="px-4 py-2">{m.install_date ? new Date(m.install_date).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-2">
                            <Button size="sm" variant="outline" onClick={() => openDetail(m)}><Eye className="w-3 h-3 mr-1" />View</Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REGISTER */}
        <TabsContent value="register">
          <Card>
            <CardHeader><CardTitle className="text-lg">Register New Meter</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Assign Customer (Optional)</Label>
                <div className="flex gap-2 mt-1">
                  <Input placeholder="Account no or name..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchCustomers()} />
                  <Button type="button" variant="outline" onClick={searchCustomers}><Search className="w-4 h-4" /></Button>
                </div>
                {customerResults.length > 0 && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    {customerResults.map((c: any) => (
                      <button key={c.id} onClick={() => selectCustomer(c)} className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0 text-sm">
                        <span className="font-medium">{c.account_no}</span> — {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {selectedCustomer && (
                  <div className="mt-2 p-2 bg-sky-50 rounded-lg text-sm flex items-center justify-between">
                    <span>Selected: <strong>{selectedCustomer.account_no}</strong> — {selectedCustomer.name}</span>
                    <button onClick={() => { setSelectedCustomer(null); setMeterForm({ ...meterForm, customer_id: '' }) }}><X className="w-4 h-4 text-gray-500" /></button>
                  </div>
                )}
              </div>

              <form onSubmit={(e) => { e.preventDefault(); createMeter.mutate(meterForm) }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Meter Number *</Label>
                  <Input value={meterForm.meter_no} onChange={e => setMeterForm({ ...meterForm, meter_no: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Meter Type</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={meterForm.meter_type_id} onChange={e => setMeterForm({ ...meterForm, meter_type_id: e.target.value })}>
                    <option value="">Select Type</option>
                    {meterTypes?.map((t: any) => <option key={t.id} value={t.id}>{t.type_id}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={meterForm.meter_location} onChange={e => setMeterForm({ ...meterForm, meter_location: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Barcode</Label>
                  <Input value={meterForm.barcode_no} onChange={e => setMeterForm({ ...meterForm, barcode_no: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Digits</Label>
                  <Input type="number" value={meterForm.digits} onChange={e => setMeterForm({ ...meterForm, digits: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Max Reading</Label>
                  <Input type="number" value={meterForm.max_reading} onChange={e => setMeterForm({ ...meterForm, max_reading: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Install Date</Label>
                  <Input type="date" value={meterForm.install_date} onChange={e => setMeterForm({ ...meterForm, install_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Manufacture Date</Label>
                  <Input type="date" value={meterForm.manufacture_date} onChange={e => setMeterForm({ ...meterForm, manufacture_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Expected Years</Label>
                  <Input type="number" value={meterForm.expected_years} onChange={e => setMeterForm({ ...meterForm, expected_years: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={meterForm.condition} onChange={e => setMeterForm({ ...meterForm, condition: e.target.value })}>
                    <option value="new">New</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Input value={meterForm.supplier} onChange={e => setMeterForm({ ...meterForm, supplier: e.target.value })} />
                </div>
                <div className="md:col-span-3 space-y-2">
                  <Label>Comments</Label>
                  <textarea className="w-full h-20 px-3 py-2 rounded-md border border-gray-300 text-sm" value={meterForm.comments} onChange={e => setMeterForm({ ...meterForm, comments: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <Button type="submit" disabled={createMeter.isPending || !meterForm.meter_no}>
                    {createMeter.isPending ? 'Registering...' : 'Register Meter'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MASTER METERS */}
        <TabsContent value="master" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Master Meters</CardTitle>
                <Button size="sm" onClick={() => { setEditingMm(null); setMmForm({}); setShowMmForm(true) }}>Add Master Meter</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Serial No</th>
                      <th className="px-4 py-2 text-left">Location</th>
                      <th className="px-4 py-2 text-left">Size</th>
                      <th className="px-4 py-2 text-left">Inflow DMA</th>
                      <th className="px-4 py-2 text-left">Outflow DMA</th>
                      <th className="px-4 py-2 text-left">Reading</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterMeters?.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-500">No master meters found</td></tr>
                    ) : (
                      masterMeters?.map((mm: any) => (
                        <tr key={mm.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{mm.serial_no}</td>
                          <td className="px-4 py-2">{mm.location || '-'}</td>
                          <td className="px-4 py-2">{mm.meter_size || '-'}</td>
                          <td className="px-4 py-2">{mm.inflow_dma_name || '-'}</td>
                          <td className="px-4 py-2">{mm.outflow_dma_name || '-'}</td>
                          <td className="px-4 py-2">{mm.current_reading}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => { setEditingMm(mm); setMmForm({ ...mm }); setShowMmForm(true) }}>Edit</Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteMm.mutate(mm.id)}>Delete</Button>
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
        </TabsContent>

        {/* TYPES */}
        <TabsContent value="types" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Meter Types</CardTitle>
                <Button size="sm" onClick={() => { setEditingType(null); setTypeForm({}); setShowTypeForm(true) }}>Add Type</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left">Manufacturer</th>
                      <th className="px-4 py-2 text-left">Model</th>
                      <th className="px-4 py-2 text-left">Size</th>
                      <th className="px-4 py-2 text-left">Digits</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typesCrud?.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-500">No types found</td></tr>
                    ) : (
                      typesCrud?.map((t: any) => (
                        <tr key={t.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{t.type_id}</td>
                          <td className="px-4 py-2">{t.manufacturer || '-'}</td>
                          <td className="px-4 py-2">{t.model || '-'}</td>
                          <td className="px-4 py-2">{t.meter_size || '-'}</td>
                          <td className="px-4 py-2">{t.number_of_digits}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => { setEditingType(t); setTypeForm({ ...t }); setShowTypeForm(true) }}>Edit</Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteType.mutate(t.id)}>Delete</Button>
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
        </TabsContent>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-6 text-center"><div className="text-3xl font-bold">{stats?.total || 0}</div><div className="text-sm text-gray-500">Total Meters</div></CardContent></Card>
            <Card><CardContent className="p-6 text-center"><div className="text-3xl font-bold text-green-600">{stats?.active || 0}</div><div className="text-sm text-gray-500">Active</div></CardContent></Card>
            <Card><CardContent className="p-6 text-center"><div className="text-3xl font-bold text-red-600">{stats?.faulty || 0}</div><div className="text-sm text-gray-500">Faulty</div></CardContent></Card>
            <Card><CardContent className="p-6 text-center"><div className="text-3xl font-bold text-blue-600">{stats?.in_store || 0}</div><div className="text-sm text-gray-500">In Store</div></CardContent></Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-sm">By Status</CardTitle></CardHeader><CardContent>
              {stats?.by_status?.map((s: any) => (
                <div key={s.status} className="flex justify-between py-1 border-b last:border-b-0 text-sm"><span>{s.status}</span><span className="font-bold">{s.count}</span></div>
              ))}
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">By Type</CardTitle></CardHeader><CardContent>
              {stats?.by_type?.map((t: any) => (
                <div key={t.name} className="flex justify-between py-1 border-b last:border-b-0 text-sm"><span>{t.name}</span><span className="font-bold">{t.count}</span></div>
              ))}
            </CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Meter Detail Modal */}
      {showDetail && detailMeter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Meter {detailMeter.meter_no}</h2>
              <button onClick={() => setShowDetail(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div className="flex gap-2 mb-4 border-b">
                <button onClick={() => setDetailSubTab('info')} className={`px-3 py-2 text-sm font-medium ${detailSubTab === 'info' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500'}`}>Info</button>
                <button onClick={() => setDetailSubTab('movements')} className={`px-3 py-2 text-sm font-medium ${detailSubTab === 'movements' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500'}`}><ArrowRightLeft className="w-3 h-3 inline mr-1" />Movements</button>
                <button onClick={() => setDetailSubTab('servicing')} className={`px-3 py-2 text-sm font-medium ${detailSubTab === 'servicing' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500'}`}><Wrench className="w-3 h-3 inline mr-1" />Servicing</button>
                <button onClick={() => setDetailSubTab('replacements')} className={`px-3 py-2 text-sm font-medium ${detailSubTab === 'replacements' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500'}`}><RefreshCw className="w-3 h-3 inline mr-1" />Replacements</button>
              </div>

              {detailSubTab === 'info' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-500">Type:</span> <strong>{detailMeter.meter_type_name || '-'}</strong></div>
                    <div><span className="text-gray-500">Status:</span> {statusBadge(detailMeter.meter_status)}</div>
                    <div><span className="text-gray-500">Customer:</span> <strong>{detailMeter.account_no ? `${detailMeter.account_no} - ${detailMeter.customer_name}` : 'Not assigned'}</strong></div>
                    <div><span className="text-gray-500">Location:</span> <strong>{detailMeter.meter_location || '-'}</strong></div>
                    <div><span className="text-gray-500">Barcode:</span> <strong>{detailMeter.barcode_no || '-'}</strong></div>
                    <div><span className="text-gray-500">Reading:</span> <strong>{detailMeter.current_reading}</strong></div>
                    <div><span className="text-gray-500">Install Date:</span> <strong>{detailMeter.install_date ? new Date(detailMeter.install_date).toLocaleDateString() : '-'}</strong></div>
                    <div><span className="text-gray-500">Condition:</span> <strong>{detailMeter.condition}</strong></div>
                  </div>
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-sm mb-2">Quick Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Card className="p-3"><div className="text-xs font-semibold mb-2">Record Movement</div>
                        <div className="space-y-2">
                          <select className="w-full h-8 px-2 rounded border text-xs" value={movementForm.movement_type} onChange={e => setMovementForm({ ...movementForm, movement_type: e.target.value })}>
                            <option value="">Type</option><option value="installation">Installation</option><option value="removal">Removal</option><option value="transfer">Transfer</option><option value="return_to_store">Return to Store</option>
                          </select>
                          <select className="w-full h-8 px-2 rounded border text-xs" value={movementForm.to_status} onChange={e => setMovementForm({ ...movementForm, to_status: e.target.value })}>
                            <option value="">New Status</option><option value="active">Active</option><option value="in_store">In Store</option><option value="faulty">Faulty</option><option value="removed">Removed</option>
                          </select>
                          <Input className="h-8 text-xs" placeholder="Reference" value={movementForm.reference_no} onChange={e => setMovementForm({ ...movementForm, reference_no: e.target.value })} />
                          <Button size="sm" className="w-full" onClick={() => recordMovement.mutate({ id: detailMeter.id, data: movementForm })} disabled={!movementForm.movement_type}>Record</Button>
                        </div>
                      </Card>
                      <Card className="p-3"><div className="text-xs font-semibold mb-2">Record Service</div>
                        <div className="space-y-2">
                          <Input className="h-8 text-xs" type="number" placeholder="Reading" value={serviceForm.reading} onChange={e => setServiceForm({ ...serviceForm, reading: e.target.value })} />
                          <Input className="h-8 text-xs" type="date" placeholder="Date" value={serviceForm.service_date} onChange={e => setServiceForm({ ...serviceForm, service_date: e.target.value })} />
                          <select className="w-full h-8 px-2 rounded border text-xs" value={serviceForm.meter_status} onChange={e => setServiceForm({ ...serviceForm, meter_status: e.target.value })}>
                            <option value="">New Status</option><option value="active">Active</option><option value="faulty">Faulty</option>
                          </select>
                          <Button size="sm" className="w-full" onClick={() => recordService.mutate({ id: detailMeter.id, data: serviceForm })} disabled={!serviceForm.service_date}>Record</Button>
                        </div>
                      </Card>
                      <Card className="p-3"><div className="text-xs font-semibold mb-2">Replace Meter</div>
                        <div className="space-y-2">
                          <Input className="h-8 text-xs" placeholder="New Meter ID" value={replacementForm.new_meter_id} onChange={e => setReplacementForm({ ...replacementForm, new_meter_id: e.target.value })} />
                          <Input className="h-8 text-xs" type="number" placeholder="Old Final Reading" value={replacementForm.old_final_reading} onChange={e => setReplacementForm({ ...replacementForm, old_final_reading: e.target.value })} />
                          <Input className="h-8 text-xs" type="date" placeholder="Date" value={replacementForm.replacement_date} onChange={e => setReplacementForm({ ...replacementForm, replacement_date: e.target.value })} />
                          <Button size="sm" className="w-full" onClick={() => recordReplacement.mutate({ id: detailMeter.id, data: replacementForm })} disabled={!replacementForm.replacement_date}>Replace</Button>
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              )}

              {detailSubTab === 'movements' && (
                <div className="space-y-2">
                  {movements?.length === 0 ? <div className="text-sm text-gray-500">No movements recorded</div> : movements?.map((m: any) => (
                    <div key={m.id} className="text-sm bg-gray-50 p-2 rounded">
                      <span className="font-medium">{m.movement_type}</span> — {m.from_status || '-'} → {m.to_status || '-'}
                      <div className="text-gray-500 text-xs">From: {m.from_customer_name || '-'} → To: {m.to_customer_name || '-'}</div>
                      <div className="text-gray-400 text-xs">{m.reference_no} | by {m.performed_by_name || '-'} at {new Date(m.movement_date).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}

              {detailSubTab === 'servicing' && (
                <div className="space-y-2">
                  {servicing?.length === 0 ? <div className="text-sm text-gray-500">No service records</div> : servicing?.map((s: any) => (
                    <div key={s.id} className="text-sm bg-gray-50 p-2 rounded">
                      <span className="font-medium">Service on {s.service_date ? new Date(s.service_date).toLocaleDateString() : '-'}</span>
                      <div className="text-gray-500 text-xs">Reading: {s.reading || '-'} | Status: {s.meter_status || '-'} | by {s.serviced_by_name || '-'}</div>
                      {s.comments && <div className="text-gray-600 text-xs mt-1">{s.comments}</div>}
                    </div>
                  ))}
                </div>
              )}

              {detailSubTab === 'replacements' && (
                <div className="space-y-2">
                  {replacements?.length === 0 ? <div className="text-sm text-gray-500">No replacements recorded</div> : replacements?.map((r: any) => (
                    <div key={r.id} className="text-sm bg-gray-50 p-2 rounded">
                      <span className="font-medium">Replaced on {r.replacement_date ? new Date(r.replacement_date).toLocaleDateString() : '-'}</span>
                      <div className="text-gray-500 text-xs">New meter: {r.new_meter_no || '-'} | Old final: {r.old_final_reading} | New initial: {r.new_initial_reading}</div>
                      {r.reason && <div className="text-gray-600 text-xs mt-1">{r.reason}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Master Meter Form Modal */}
      {showMmForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingMm ? 'Edit' : 'New'} Master Meter</h2>
              <button onClick={() => setShowMmForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2"><Label>Serial No</Label><Input value={mmForm.serial_no || ''} onChange={e => setMmForm({ ...mmForm, serial_no: e.target.value })} /></div>
              <div className="space-y-2"><Label>Location</Label><Input value={mmForm.location || ''} onChange={e => setMmForm({ ...mmForm, location: e.target.value })} /></div>
              <div className="space-y-2"><Label>Size</Label><Input value={mmForm.meter_size || ''} onChange={e => setMmForm({ ...mmForm, meter_size: e.target.value })} /></div>
              <div className="space-y-2"><Label>Inflow DMA</Label>
                <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={mmForm.inflow_dma_id || ''} onChange={e => setMmForm({ ...mmForm, inflow_dma_id: e.target.value })}>
                  <option value="">None</option>
                  {dmaRegions?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Outflow DMA</Label>
                <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={mmForm.outflow_dma_id || ''} onChange={e => setMmForm({ ...mmForm, outflow_dma_id: e.target.value })}>
                  <option value="">None</option>
                  {dmaRegions?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveMm.mutate(mmForm)} disabled={saveMm.isPending}>Save</Button>
                <Button variant="outline" onClick={() => setShowMmForm(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Type Form Modal */}
      {showTypeForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingType ? 'Edit' : 'New'} Meter Type</h2>
              <button onClick={() => setShowTypeForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2"><Label>Code *</Label><Input value={typeForm.type_id || ''} onChange={e => setTypeForm({ ...typeForm, type_id: e.target.value })} /></div>
              <div className="space-y-2"><Label>Manufacturer</Label><Input value={typeForm.manufacturer || ''} onChange={e => setTypeForm({ ...typeForm, manufacturer: e.target.value })} /></div>
              <div className="space-y-2"><Label>Model</Label><Input value={typeForm.model || ''} onChange={e => setTypeForm({ ...typeForm, model: e.target.value })} /></div>
              <div className="space-y-2"><Label>Size</Label><Input value={typeForm.meter_size || ''} onChange={e => setTypeForm({ ...typeForm, meter_size: e.target.value })} /></div>
              <div className="space-y-2"><Label>Digits</Label><Input type="number" value={typeForm.number_of_digits || ''} onChange={e => setTypeForm({ ...typeForm, number_of_digits: e.target.value })} /></div>
              <div className="flex gap-2">
                <Button onClick={() => saveType.mutate(typeForm)} disabled={saveType.isPending || !typeForm.type_id}>Save</Button>
                <Button variant="outline" onClick={() => setShowTypeForm(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
