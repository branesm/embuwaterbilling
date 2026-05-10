import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { MapPin, Gauge, BarChart3 } from 'lucide-react'

export default function NrwPage() {
  const [activeTab, setActiveTab] = useState('regions')
  const [editingRegion, setEditingRegion] = useState<any>(null)
  const [editingMeter, setEditingMeter] = useState<any>(null)
  const [regionForm, setRegionForm] = useState({ code: '', name: '', parent_id: '', region_type: 'dma' })
  const [meterForm, setMeterForm] = useState({
    serial_no: '', location: '', meter_size: '', meter_status: 'active',
    install_date: '', northings: '', eastings: '', inflow_dma_id: '', outflow_dma_id: ''
  })
  const [linkForm, setLinkForm] = useState({ dma_id: '', search: '' })
  const [readingFilter, setReadingFilter] = useState({ billing_period_id: '', dma_id: '' })
  const [readingForm, setReadingForm] = useState({
    master_meter_id: '', billing_period_id: '', reading_date: new Date().toISOString().slice(0, 10),
    current_reading: '', previous_reading: '', reader_id: '', comments: ''
  })
  const [reportBillingPeriodId, setReportBillingPeriodId] = useState('')

  const queryClient = useQueryClient()

  const { data: regions = [] } = useQuery({
    queryKey: ['nrw-regions'],
    queryFn: async () => {
      const res = await api.get('/nrw/regions')
      return res.data.data || []
    }
  })

  const { data: billingPeriods = [] } = useQuery({
    queryKey: ['financial-periods'],
    queryFn: async () => {
      const res = await api.get('/parameters/financial-periods')
      return res.data.data || []
    }
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/admin/users')
      return res.data.data || []
    }
  })

  const { data: masterMeters = [] } = useQuery({
    queryKey: ['nrw-master-meters'],
    queryFn: async () => {
      const res = await api.get('/nrw/master-meters')
      return res.data.data || []
    }
  })

  const { data: nrwSummary = [] } = useQuery({
    queryKey: ['nrw-summary', reportBillingPeriodId],
    queryFn: async () => {
      const query = reportBillingPeriodId ? `?billing_period_id=${reportBillingPeriodId}` : ''
      const res = await api.get(`/nrw/report/summary${query}`)
      return res.data.data || []
    }
  })

  const { data: dmaCustomers = [] } = useQuery({
    queryKey: ['nrw-dma-customers', linkForm.dma_id],
    enabled: !!linkForm.dma_id,
    queryFn: async () => {
      const res = await api.get(`/nrw/customers/${linkForm.dma_id}`)
      return res.data.data || []
    }
  })

  const { data: customerSearch = [] } = useQuery({
    queryKey: ['customer-search', linkForm.search],
    enabled: linkForm.search.length > 1,
    queryFn: async () => {
      const res = await api.get(`/customers/search?q=${encodeURIComponent(linkForm.search)}&limit=20`)
      return res.data.data || []
    }
  })

  const { data: nrwReadings = [] } = useQuery({
    queryKey: ['nrw-readings', readingFilter],
    enabled: activeTab === 'readings',
    queryFn: async () => {
      const params = new URLSearchParams()
      if (readingFilter.billing_period_id) params.append('billing_period_id', readingFilter.billing_period_id)
      if (readingFilter.dma_id) params.append('dma_id', readingFilter.dma_id)
      const res = await api.get(`/nrw/readings?${params.toString()}`)
      return res.data.data || []
    }
  })

  const createRegion = useMutation({
    mutationFn: (data: any) => api.post('/nrw/regions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nrw-regions'] })
      toast({ title: 'Region created' })
      setRegionForm({ code: '', name: '', parent_id: '', region_type: 'dma' })
    }
  })

  const updateRegion = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/nrw/regions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nrw-regions'] })
      toast({ title: 'Region updated' })
      setEditingRegion(null)
      setRegionForm({ code: '', name: '', parent_id: '', region_type: 'dma' })
    }
  })

  const deleteRegion = useMutation({
    mutationFn: (id: number) => api.delete(`/nrw/regions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nrw-regions'] })
      toast({ title: 'Region deleted' })
    }
  })

  const createMasterMeter = useMutation({
    mutationFn: (data: any) => api.post('/nrw/master-meters', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nrw-master-meters'] })
      toast({ title: 'Master meter created' })
      setMeterForm({ serial_no: '', location: '', meter_size: '', meter_status: 'active', install_date: '', northings: '', eastings: '', inflow_dma_id: '', outflow_dma_id: '' })
    }
  })

  const updateMasterMeter = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/nrw/master-meters/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nrw-master-meters'] })
      toast({ title: 'Master meter updated' })
      setEditingMeter(null)
      setMeterForm({ serial_no: '', location: '', meter_size: '', meter_status: 'active', install_date: '', northings: '', eastings: '', inflow_dma_id: '', outflow_dma_id: '' })
    }
  })

  const deleteMasterMeter = useMutation({
    mutationFn: (id: number) => api.delete(`/nrw/master-meters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nrw-master-meters'] })
      toast({ title: 'Master meter deleted' })
    }
  })

  const assignCustomer = useMutation({
    mutationFn: (data: any) => api.post('/nrw/assign-customer', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nrw-dma-customers', linkForm.dma_id] })
      toast({ title: 'Customer assigned to DMA' })
    }
  })

  const createReading = useMutation({
    mutationFn: (data: any) => api.post('/nrw/readings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nrw-readings', readingFilter] })
      toast({ title: 'NRW reading saved' })
      setReadingForm({ master_meter_id: '', billing_period_id: '', reading_date: new Date().toISOString().slice(0, 10), current_reading: '', previous_reading: '', reader_id: '', comments: '' })
    }
  })

  const dmaOptions = useMemo(
    () => regions.filter((r: any) => r.region_type === 'dma'),
    [regions]
  )

  const regionTree = useMemo(() => {
    const map = new Map<number, any>()
    regions.forEach((node: any) => map.set(node.id, { ...node, children: [] }))
    const roots: any[] = []
    regions.forEach((node: any) => {
      if (node.parent_id) {
        const parent = map.get(node.parent_id)
        if (parent) parent.children.push(map.get(node.id))
      } else {
        roots.push(map.get(node.id))
      }
    })
    return roots
  }, [regions])

  const handleRegionEdit = (region: any) => {
    setEditingRegion(region)
    setRegionForm({
      code: region.code,
      name: region.name,
      parent_id: region.parent_id ? String(region.parent_id) : '',
      region_type: region.region_type || 'dma'
    })
  }

  const handleMeterEdit = (meter: any) => {
    setEditingMeter(meter)
    setMeterForm({
      serial_no: meter.serial_no,
      location: meter.location || '',
      meter_size: meter.meter_size || '',
      meter_status: meter.meter_status || 'active',
      install_date: meter.install_date || '',
      northings: meter.northings ? String(meter.northings) : '',
      eastings: meter.eastings ? String(meter.eastings) : '',
      inflow_dma_id: meter.inflow_dma_id ? String(meter.inflow_dma_id) : '',
      outflow_dma_id: meter.outflow_dma_id ? String(meter.outflow_dma_id) : ''
    })
  }

  const handleCancelRegion = () => {
    setEditingRegion(null)
    setRegionForm({ code: '', name: '', parent_id: '', region_type: 'dma' })
  }

  const handleCancelMeter = () => {
    setEditingMeter(null)
    setMeterForm({ serial_no: '', location: '', meter_size: '', meter_status: 'active', install_date: '', northings: '', eastings: '', inflow_dma_id: '', outflow_dma_id: '' })
  }

  const handlePrint = (label: string) => {
    toast({ title: `Printing ${label}` })
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NRW Management</h1>
          <p className="text-sm text-gray-500">Regions, DMAs, master meters, customer mapping, readings and reports.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 gap-2">
          <TabsTrigger value="regions">
            <MapPin className="w-4 h-4 mr-2" /> Regions/DMAs
          </TabsTrigger>
          <TabsTrigger value="meters">
            <Gauge className="w-4 h-4 mr-2" /> Master Meters
          </TabsTrigger>
          <TabsTrigger value="customers">
            <MapPin className="w-4 h-4 mr-2" /> Link Customers
          </TabsTrigger>
          <TabsTrigger value="readings">
            <BarChart3 className="w-4 h-4 mr-2" /> Capture Readings
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="w-4 h-4 mr-2" /> Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{editingRegion ? 'Edit Region / DMA' : 'New Region / DMA'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const payload = {
                    code: regionForm.code,
                    name: regionForm.name,
                    parent_id: regionForm.parent_id ? parseInt(regionForm.parent_id) : null,
                    region_type: regionForm.region_type
                  }
                  if (editingRegion) {
                    updateRegion.mutate({ id: editingRegion.id, data: payload })
                  } else {
                    createRegion.mutate(payload)
                  }
                }}
                className="grid grid-cols-1 md:grid-cols-4 gap-4"
              >
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={regionForm.code} onChange={e => setRegionForm({ ...regionForm, code: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={regionForm.name} onChange={e => setRegionForm({ ...regionForm, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Parent Region</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                    aria-label="Parent Region"
                    value={regionForm.parent_id}
                    onChange={e => setRegionForm({ ...regionForm, parent_id: e.target.value })}
                  >
                    <option value="">None (Top Level)</option>
                    {regions.filter((r: any) => r.region_type === 'region').map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                    aria-label="Region Type"
                    value={regionForm.region_type}
                    onChange={e => setRegionForm({ ...regionForm, region_type: e.target.value })}
                  >
                    <option value="region">Region</option>
                    <option value="dma">DMA</option>
                  </select>
                </div>
                <div className="md:col-span-4 flex gap-2">
                  <Button type="submit" disabled={createRegion.isPending || updateRegion.isPending}>
                    {editingRegion ? 'Update Region' : 'Create Region'}
                  </Button>
                  {editingRegion && (
                    <Button variant="secondary" type="button" onClick={handleCancelRegion}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Region / DMA List</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Parent</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-right">Connections</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regions.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-500">No regions found</td></tr>
                    ) : (
                      regions.map((region: any) => (
                        <tr key={region.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{region.code}</td>
                          <td className="px-4 py-2">{region.name}</td>
                          <td className="px-4 py-2">{region.parent_name || '-'}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${region.region_type === 'region' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                              {region.region_type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">{region.connection_count}</td>
                          <td className="px-4 py-2 text-right space-x-2">
                            <Button variant="secondary" size="sm" type="button" onClick={() => handleRegionEdit(region)}>
                              Edit
                            </Button>
                            <Button variant="destructive" size="sm" type="button" onClick={() => deleteRegion.mutate(region.id)}>
                              Delete
                            </Button>
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

        <TabsContent value="meters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{editingMeter ? 'Edit Master Meter' : 'New Master Meter'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const payload = {
                    serial_no: meterForm.serial_no,
                    location: meterForm.location,
                    meter_size: meterForm.meter_size,
                    meter_status: meterForm.meter_status,
                    install_date: meterForm.install_date || null,
                    northings: meterForm.northings ? parseFloat(meterForm.northings) : null,
                    eastings: meterForm.eastings ? parseFloat(meterForm.eastings) : null,
                    inflow_dma_id: meterForm.inflow_dma_id ? parseInt(meterForm.inflow_dma_id) : null,
                    outflow_dma_id: meterForm.outflow_dma_id ? parseInt(meterForm.outflow_dma_id) : null
                  }
                  if (editingMeter) {
                    updateMasterMeter.mutate({ id: editingMeter.id, data: payload })
                  } else {
                    createMasterMeter.mutate(payload)
                  }
                }}
                className="grid grid-cols-1 md:grid-cols-4 gap-4"
              >
                <div className="space-y-2">
                  <Label>Serial No</Label>
                  <Input value={meterForm.serial_no} onChange={e => setMeterForm({ ...meterForm, serial_no: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={meterForm.location} onChange={e => setMeterForm({ ...meterForm, location: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Input value={meterForm.meter_size} onChange={e => setMeterForm({ ...meterForm, meter_size: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Install Date</Label>
                  <Input type="date" value={meterForm.install_date} onChange={e => setMeterForm({ ...meterForm, install_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Inflow DMA</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                    aria-label="Inflow DMA"
                    value={meterForm.inflow_dma_id}
                    onChange={e => setMeterForm({ ...meterForm, inflow_dma_id: e.target.value })}
                  >
                    <option value="">Select DMA</option>
                    {dmaOptions.map((dma: any) => (
                      <option key={dma.id} value={dma.id}>{dma.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Outflow DMA</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                    aria-label="Outflow DMA"
                    value={meterForm.outflow_dma_id}
                    onChange={e => setMeterForm({ ...meterForm, outflow_dma_id: e.target.value })}
                  >
                    <option value="">Select DMA</option>
                    {dmaOptions.map((dma: any) => (
                      <option key={dma.id} value={dma.id}>{dma.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Northings</Label>
                  <Input value={meterForm.northings} onChange={e => setMeterForm({ ...meterForm, northings: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Eastings</Label>
                  <Input value={meterForm.eastings} onChange={e => setMeterForm({ ...meterForm, eastings: e.target.value })} />
                </div>
                <div className="md:col-span-4 flex gap-2">
                  <Button type="submit" disabled={createMasterMeter.isPending || updateMasterMeter.isPending}>
                    {editingMeter ? 'Update Meter' : 'Create Meter'}
                  </Button>
                  {editingMeter && (
                    <Button variant="secondary" type="button" onClick={handleCancelMeter}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Master Meters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Serial No</th>
                      <th className="px-4 py-2 text-left">Location</th>
                      <th className="px-4 py-2 text-left">Size</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Inflow DMA</th>
                      <th className="px-4 py-2 text-left">Outflow DMA</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterMeters.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-500">No master meters found</td></tr>
                    ) : (
                      masterMeters.map((meter: any) => (
                        <tr key={meter.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{meter.serial_no}</td>
                          <td className="px-4 py-2">{meter.location}</td>
                          <td className="px-4 py-2">{meter.meter_size}</td>
                          <td className="px-4 py-2">{meter.meter_status}</td>
                          <td className="px-4 py-2">{meter.inflow_dma_name || '-'}</td>
                          <td className="px-4 py-2">{meter.outflow_dma_name || '-'}</td>
                          <td className="px-4 py-2 text-right space-x-2">
                            <Button variant="secondary" size="sm" type="button" onClick={() => handleMeterEdit(meter)}>
                              Edit
                            </Button>
                            <Button variant="destructive" size="sm" type="button" onClick={() => deleteMasterMeter.mutate(meter.id)}>
                              Delete
                            </Button>
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

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Link Customers to DMA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>DMA</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                    aria-label="DMA selection"
                    value={linkForm.dma_id}
                    onChange={e => setLinkForm({ ...linkForm, dma_id: e.target.value })}
                  >
                    <option value="">Select DMA</option>
                    {dmaOptions.map((dma: any) => (
                      <option key={dma.id} value={dma.id}>{dma.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Search Customer</Label>
                  <Input
                    placeholder="Type name, account number or phone"
                    value={linkForm.search}
                    onChange={e => setLinkForm({ ...linkForm, search: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Search Results</h3>
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Account No</th>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">Phone</th>
                          <th className="px-4 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerSearch.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">Type at least 2 characters to search</td></tr>
                        ) : (
                          customerSearch.map((customer: any) => (
                            <tr key={customer.id} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-2">{customer.account_no}</td>
                              <td className="px-4 py-2">{customer.name}</td>
                              <td className="px-4 py-2">{customer.telephone}</td>
                              <td className="px-4 py-2 text-right">
                                <Button
                                  size="sm"
                                  onClick={() => assignCustomer.mutate({ customer_id: customer.id, dma_id: parseInt(linkForm.dma_id) })}
                                  disabled={!linkForm.dma_id}
                                >
                                  Assign
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Current DMA Customers</h3>
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Account No</th>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">Balance</th>
                          <th className="px-4 py-2 text-left">Meter No</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!linkForm.dma_id || dmaCustomers.length === 0) ? (
                          <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">Select a DMA to view linked customers</td></tr>
                        ) : (
                          dmaCustomers.map((customer: any) => (
                            <tr key={customer.id} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-2">{customer.account_no}</td>
                              <td className="px-4 py-2">{customer.name}</td>
                              <td className="px-4 py-2">{customer.balance}</td>
                              <td className="px-4 py-2">{customer.meter_no || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="readings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reading Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Billing Period</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                    aria-label="Billing period filter"
                    value={readingFilter.billing_period_id}
                    onChange={e => setReadingFilter({ ...readingFilter, billing_period_id: e.target.value })}
                  >
                    <option value="">All periods</option>
                    {billingPeriods.map((period: any) => (
                      <option key={period.id} value={period.id}>{period.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>DMA</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                    aria-label="Reading DMA filter"
                    value={readingFilter.dma_id}
                    onChange={e => setReadingFilter({ ...readingFilter, dma_id: e.target.value })}
                  >
                    <option value="">All DMAs</option>
                    {dmaOptions.map((dma: any) => (
                      <option key={dma.id} value={dma.id}>{dma.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Refresh</Label>
                  <Button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['nrw-readings', readingFilter] })}>
                    Reload Readings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">NRW Readings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Meter No</th>
                      <th className="px-4 py-2 text-left">Reading Date</th>
                      <th className="px-4 py-2 text-right">Reading</th>
                      <th className="px-4 py-2 text-left">Meter Reader</th>
                      <th className="px-4 py-2 text-right">Supply m3</th>
                      <th className="px-4 py-2 text-right">Prev Reading</th>
                      <th className="px-4 py-2 text-left">Prev Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nrwReadings.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-500">No readings available</td></tr>
                    ) : (
                      nrwReadings.map((row: any) => (
                        <tr key={row.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{row.serial_no}</td>
                          <td className="px-4 py-2">{row.reading_date}</td>
                          <td className="px-4 py-2 text-right">{row.current_reading}</td>
                          <td className="px-4 py-2">{row.reader_name || row.reader_id || '-'}</td>
                          <td className="px-4 py-2 text-right">{row.consumption}</td>
                          <td className="px-4 py-2 text-right">{row.previous_reading}</td>
                          <td className="px-4 py-2">{row.prev_reading_date || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add NRW Reading</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  createReading.mutate({
                    master_meter_id: parseInt(readingForm.master_meter_id),
                    billing_period_id: parseInt(readingForm.billing_period_id),
                    reading_date: readingForm.reading_date,
                    current_reading: parseFloat(readingForm.current_reading),
                    previous_reading: parseFloat(readingForm.previous_reading),
                    reader_id: parseInt(readingForm.reader_id),
                    comments: readingForm.comments
                  })
                }}
                className="grid grid-cols-1 lg:grid-cols-4 gap-4"
              >
                <div className="space-y-2">
                  <Label>Master Meter</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                    aria-label="Master meter"
                    value={readingForm.master_meter_id}
                    onChange={e => setReadingForm({ ...readingForm, master_meter_id: e.target.value })}
                    required
                  >
                    <option value="">Select Meter</option>
                    {masterMeters.map((meter: any) => (
                      <option key={meter.id} value={meter.id}>{meter.serial_no}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Billing Period</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                    aria-label="Reading billing period"
                    value={readingForm.billing_period_id}
                    onChange={e => setReadingForm({ ...readingForm, billing_period_id: e.target.value })}
                    required
                  >
                    <option value="">Select period</option>
                    {billingPeriods.map((period: any) => (
                      <option key={period.id} value={period.id}>{period.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Reading Date</Label>
                  <Input type="date" value={readingForm.reading_date} onChange={e => setReadingForm({ ...readingForm, reading_date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Reader</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                    aria-label="Meter reader"
                    value={readingForm.reader_id}
                    onChange={e => setReadingForm({ ...readingForm, reader_id: e.target.value })}
                    required
                  >
                    <option value="">Select reader</option>
                    {users.map((user: any) => (
                      <option key={user.id} value={user.id}>{user.first_name} {user.other_names}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Current Reading</Label>
                  <Input value={readingForm.current_reading} onChange={e => setReadingForm({ ...readingForm, current_reading: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Previous Reading</Label>
                  <Input value={readingForm.previous_reading} onChange={e => setReadingForm({ ...readingForm, previous_reading: e.target.value })} required />
                </div>
                <div className="lg:col-span-4 space-y-2">
                  <Label>Comments</Label>
                  <textarea
                    className="w-full min-h-[100px] px-3 py-2 rounded-md border border-gray-300 text-sm"
                    aria-label="Comments"
                    value={readingForm.comments}
                    onChange={e => setReadingForm({ ...readingForm, comments: e.target.value })}
                  />
                </div>
                <div className="md:col-span-4">
                  <Button type="submit" disabled={createReading.isPending}>Save Reading</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Regions / DMA Tree</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {regionTree.map((region: any) => (
                    <div key={region.id} className="border rounded-lg p-3">
                      <div className="font-semibold text-gray-800">{region.name} ({region.code})</div>
                      {region.children.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-gray-700">
                          {region.children.map((dma: any) => (
                            <li key={dma.id} className="flex justify-between gap-2">
                              <span>{dma.name}</span>
                              <span className="text-gray-500">{dma.connection_count} conn</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-gray-500">No DMAs under this region.</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Report Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Billing Period</Label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                      aria-label="Report billing period"
                      value={reportBillingPeriodId}
                      onChange={e => setReportBillingPeriodId(e.target.value)}
                    >
                      <option value="">All periods</option>
                      {billingPeriods.map((period: any) => (
                        <option key={period.id} value={period.id}>{period.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Button type="button" onClick={() => handlePrint('NRW Report ALL')}>Print NRW Report ALL</Button>
                    <Button type="button" onClick={() => handlePrint('NRW Report Selection')}>Print NRW Report Selection</Button>
                    <Button type="button" onClick={() => handlePrint('NRW Global Summary Report')}>Print NRW Global Summary</Button>
                    <Button type="button" onClick={() => handlePrint('NRW Monthly Report')}>Print NRW Monthly Report</Button>
                    <Button type="button" onClick={() => handlePrint('Reading Dates Report')}>Print Reading Dates Report</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Summary Table</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">DMA</th>
                          <th className="px-4 py-2 text-right">Connections</th>
                          <th className="px-4 py-2 text-right">DMA Input</th>
                          <th className="px-4 py-2 text-right">Billed</th>
                          <th className="px-4 py-2 text-right">NRW Volume</th>
                          <th className="px-4 py-2 text-right">NRW %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nrwSummary.length === 0 ? (
                          <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-500">No data found</td></tr>
                        ) : (
                          nrwSummary.map((row: any) => (
                            <tr key={row.id} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-2">{row.name}</td>
                              <td className="px-4 py-2 text-right">{row.total_connections}</td>
                              <td className="px-4 py-2 text-right">{parseFloat(row.dma_input).toLocaleString()}</td>
                              <td className="px-4 py-2 text-right">{parseFloat(row.billed_consumption).toLocaleString()}</td>
                              <td className="px-4 py-2 text-right font-bold text-red-600">{parseFloat(row.nrw_volume).toLocaleString()}</td>
                              <td className="px-4 py-2 text-right font-bold">{row.nrw_percentage}%</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
