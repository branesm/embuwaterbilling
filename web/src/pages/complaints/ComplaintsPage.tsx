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
import { MessageSquareWarning, List, BarChart3, Settings, Search, Eye, X, CheckCircle, UserCircle } from 'lucide-react'

export default function ComplaintsPage() {
  const [activeTab, setActiveTab] = useState('list')
  const queryClient = useQueryClient()

  // Filters
  const [listFilters, setListFilters] = useState({ status: '', priority: '', category_id: '', customer_id: '' })
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [detailComplaint, setDetailComplaint] = useState<any>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showLookupForm, setShowLookupForm] = useState(false)
  const [lookupTable, setLookupTable] = useState('categories')
  const [editingLookup, setEditingLookup] = useState<any>(null)
  const [lookupForm, setLookupForm] = useState<any>({})
  const [activityNote, setActivityNote] = useState('')
  const [assignForm, setAssignForm] = useState({ assigned_to: '', priority: '' })

  // Data queries
  const { data: complaints, refetch: refetchComplaints } = useQuery({
    queryKey: ['complaints', listFilters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (listFilters.status) params.append('status', listFilters.status)
      if (listFilters.priority) params.append('priority', listFilters.priority)
      if (listFilters.category_id) params.append('category_id', listFilters.category_id)
      if (listFilters.customer_id) params.append('customer_id', listFilters.customer_id)
      const res = await api.get(`/complaints?${params}`)
      return res.data.data
    }
  })

  const { data: stats } = useQuery({
    queryKey: ['complaint-stats'],
    queryFn: async () => {
      const res = await api.get('/complaints/stats/dashboard')
      return res.data.data
    }
  })

  const { data: categories } = useQuery({
    queryKey: ['complaint-categories'],
    queryFn: async () => {
      const res = await api.get('/complaints/categories/all')
      return res.data.data
    }
  })

  const { data: types } = useQuery({
    queryKey: ['complaint-types'],
    queryFn: async () => {
      const res = await api.get('/complaints/types/all')
      return res.data.data
    }
  })

  const { data: sources } = useQuery({
    queryKey: ['complaint-sources'],
    queryFn: async () => {
      const res = await api.get('/complaints/sources/all')
      return res.data.data
    }
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/complaints/departments/all')
      return res.data.data
    }
  })

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get('/complaints/employees/all')
      return res.data.data
    }
  })

  const { data: lookupData, refetch: refetchLookup } = useQuery({
    queryKey: ['lookup', lookupTable],
    queryFn: async () => {
      const res = await api.get(`/complaints/${lookupTable}`)
      return res.data.data
    },
    enabled: activeTab === 'settings'
  })

  const { data: activities, refetch: refetchActivities } = useQuery({
    queryKey: ['complaint-activities', detailComplaint?.id],
    queryFn: async () => {
      const res = await api.get(`/complaints/${detailComplaint.id}/activities`)
      return res.data.data
    },
    enabled: !!detailComplaint?.id
  })

  // Mutations
  const createComplaint = useMutation({
    mutationFn: (data: any) => api.post('/complaints', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      queryClient.invalidateQueries({ queryKey: ['complaint-stats'] })
      toast({ title: 'Complaint registered successfully' })
      setFormData({ customer_id: '', category_id: '', type_id: '', source_id: '', department_id: '', priority: 'medium', description: '', assigned_to: '' })
      setSelectedCustomer(null)
    },
    onError: () => toast({ title: 'Failed to register complaint', variant: 'destructive' })
  })

  const updateComplaint = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/complaints/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      queryClient.invalidateQueries({ queryKey: ['complaint-stats'] })
      refetchActivities()
      toast({ title: 'Complaint updated' })
    }
  })

  const addActivity = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.post(`/complaints/${id}/activities`, data),
    onSuccess: () => {
      setActivityNote('')
      refetchActivities()
      toast({ title: 'Note added' })
    }
  })

  const saveLookup = useMutation({
    mutationFn: (data: any) => {
      if (editingLookup?.id) return api.put(`/complaints/${lookupTable}/${editingLookup.id}`, data)
      return api.post(`/complaints/${lookupTable}`, data)
    },
    onSuccess: () => {
      refetchLookup()
      setShowLookupForm(false)
      setEditingLookup(null)
      toast({ title: 'Saved' })
    }
  })

  const deleteLookup = useMutation({
    mutationFn: (id: number) => api.delete(`/complaints/${lookupTable}/${id}`),
    onSuccess: () => { refetchLookup(); toast({ title: 'Deleted' }) }
  })

  const searchCustomers = async () => {
    if (!customerSearch.trim()) return
    const res = await api.get(`/customers/search?q=${customerSearch}`)
    setCustomerResults(res.data.data || [])
  }

  const selectCustomer = (customer: any) => {
    setSelectedCustomer(customer)
    setFormData({ ...formData, customer_id: String(customer.id) })
    setCustomerResults([])
    setCustomerSearch('')
  }

  const openDetail = (complaint: any) => {
    setDetailComplaint(complaint)
    setShowDetail(true)
    setAssignForm({ assigned_to: String(complaint.assigned_to || ''), priority: complaint.priority })
  }

  const openLookupForm = (item?: any) => {
    if (item) {
      setEditingLookup(item)
      setLookupForm({ ...item })
    } else {
      setEditingLookup(null)
      setLookupForm({})
    }
    setShowLookupForm(true)
  }

  const [formData, setFormData] = useState({
    customer_id: '', category_id: '', type_id: '', source_id: '', department_id: '',
    priority: 'medium', description: '', assigned_to: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createComplaint.mutate({
      customer_id: parseInt(formData.customer_id),
      category_id: parseInt(formData.category_id) || null,
      type_id: parseInt(formData.type_id) || null,
      source_id: parseInt(formData.source_id) || null,
      department_id: parseInt(formData.department_id) || null,
      priority: formData.priority,
      description: formData.description,
      assigned_to: parseInt(formData.assigned_to) || null
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Complaints Management</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
          <TabsTrigger value="list"><List className="w-4 h-4 mr-1" />List</TabsTrigger>
          <TabsTrigger value="register"><MessageSquareWarning className="w-4 h-4 mr-1" />Register</TabsTrigger>
          <TabsTrigger value="dashboard"><BarChart3 className="w-4 h-4 mr-1" />Dashboard</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1" />Setup</TabsTrigger>
        </TabsList>

        {/* LIST */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Complaint List</CardTitle>
                <div className="flex gap-2">
                  <select className="h-9 px-3 rounded-md border border-gray-300 text-sm" value={listFilters.status} onChange={e => setListFilters({ ...listFilters, status: e.target.value })}>
                    <option value="">All Status</option>
                    <option value="open">Open</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <select className="h-9 px-3 rounded-md border border-gray-300 text-sm" value={listFilters.priority} onChange={e => setListFilters({ ...listFilters, priority: e.target.value })}>
                    <option value="">All Priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <Button size="sm" onClick={() => refetchComplaints()}>Filter</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">ID</th>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-left">Priority</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Assigned</th>
                      <th className="px-4 py-2 text-left">Created</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaints?.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-4 text-center text-gray-500">No complaints found</td></tr>
                    ) : (
                      complaints?.map((c: any) => (
                        <tr key={c.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{c.id}</td>
                          <td className="px-4 py-2">{c.account_no} - {c.customer_name}</td>
                          <td className="px-4 py-2">{c.category_name}</td>
                          <td className="px-4 py-2"><Badge variant={c.priority === 'high' ? 'destructive' : c.priority === 'medium' ? 'secondary' : 'default'}>{c.priority}</Badge></td>
                          <td className="px-4 py-2"><Badge variant={c.status === 'open' ? 'default' : 'secondary'}>{c.status}</Badge></td>
                          <td className="px-4 py-2">{c.assigned_to_name || 'Unassigned'}</td>
                          <td className="px-4 py-2">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => openDetail(c)}><Eye className="w-3 h-3 mr-1" />View</Button>
                              {c.status === 'open' && (
                                <Button size="sm" variant="default" onClick={() => updateComplaint.mutate({ id: c.id, data: { status: 'resolved' } })}>
                                  <CheckCircle className="w-3 h-3 mr-1" />Resolve
                                </Button>
                              )}
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

        {/* REGISTER */}
        <TabsContent value="register">
          <Card>
            <CardHeader><CardTitle className="text-lg">Register New Complaint</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Search Customer</Label>
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
                    <button onClick={() => { setSelectedCustomer(null); setFormData({ ...formData, customer_id: '' }) }}><X className="w-4 h-4 text-gray-500" /></button>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="hidden" value={formData.customer_id} />
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })}>
                    <option value="">Select Category</option>
                    {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={formData.type_id} onChange={e => setFormData({ ...formData, type_id: e.target.value })}>
                    <option value="">Select Type</option>
                    {types?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={formData.source_id} onChange={e => setFormData({ ...formData, source_id: e.target.value })}>
                    <option value="">Select Source</option>
                    {sources?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })}>
                    <option value="">Select Department</option>
                    {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Assigned To</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={formData.assigned_to} onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}>
                    <option value="">Select Employee</option>
                    {employees?.map((e: any) => <option key={e.id} value={e.id}>{e.first_name} {e.other_names}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Description</Label>
                  <textarea className="w-full h-24 px-3 py-2 rounded-md border border-gray-300 text-sm" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={createComplaint.isPending || !formData.customer_id}>
                    {createComplaint.isPending ? 'Registering...' : 'Register Complaint'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-6 text-center"><div className="text-3xl font-bold">{stats?.total || 0}</div><div className="text-sm text-gray-500">Total Complaints</div></CardContent></Card>
            <Card><CardContent className="p-6 text-center"><div className="text-3xl font-bold text-green-600">{stats?.resolved || 0}</div><div className="text-sm text-gray-500">Resolved</div></CardContent></Card>
            <Card><CardContent className="p-6 text-center"><div className="text-3xl font-bold text-red-600">{stats?.by_priority?.find((p: any) => p.priority === 'high')?.count || 0}</div><div className="text-sm text-gray-500">High Priority</div></CardContent></Card>
            <Card><CardContent className="p-6 text-center"><div className="text-3xl font-bold text-blue-600">{stats?.total ? Math.round((stats.resolved / stats.total) * 100) : 0}%</div><div className="text-sm text-gray-500">Resolution Rate</div></CardContent></Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader><CardTitle className="text-sm">By Status</CardTitle></CardHeader><CardContent>
              {stats?.by_status?.map((s: any) => (
                <div key={s.status} className="flex justify-between py-1 border-b last:border-b-0 text-sm"><span>{s.status}</span><span className="font-bold">{s.count}</span></div>
              ))}
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">By Priority</CardTitle></CardHeader><CardContent>
              {stats?.by_priority?.map((p: any) => (
                <div key={p.priority} className="flex justify-between py-1 border-b last:border-b-0 text-sm"><span>{p.priority}</span><span className="font-bold">{p.count}</span></div>
              ))}
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">By Category</CardTitle></CardHeader><CardContent>
              {stats?.by_category?.map((c: any) => (
                <div key={c.name} className="flex justify-between py-1 border-b last:border-b-0 text-sm"><span>{c.name}</span><span className="font-bold">{c.count}</span></div>
              ))}
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* SETTINGS / LOOKUP TABLES */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Lookup Tables</CardTitle>
                <div className="flex gap-2">
                  <select className="h-9 px-3 rounded-md border border-gray-300 text-sm" value={lookupTable} onChange={e => setLookupTable(e.target.value)}>
                    <option value="categories">Categories</option>
                    <option value="types">Types</option>
                    <option value="sources">Sources</option>
                    <option value="departments">Departments</option>
                    <option value="employees">Employees</option>
                  </select>
                  <Button size="sm" onClick={() => openLookupForm()}>Add New</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">ID</th>
                      {lookupTable !== 'employees' && <th className="px-4 py-2 text-left">Code</th>}
                      <th className="px-4 py-2 text-left">Name</th>
                      {lookupTable === 'employees' && <th className="px-4 py-2 text-left">Department</th>}
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lookupData?.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500">No items found</td></tr>
                    ) : (
                      lookupData?.map((item: any) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{item.id}</td>
                          {lookupTable !== 'employees' && <td className="px-4 py-2">{item.code}</td>}
                          <td className="px-4 py-2">{item.name || `${item.first_name} ${item.other_names || ''}`}</td>
                          {lookupTable === 'employees' && <td className="px-4 py-2">{item.department_id}</td>}
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => openLookupForm(item)}>Edit</Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteLookup.mutate(item.id)}>Delete</Button>
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
      </Tabs>

      {/* Complaint Detail Modal */}
      {showDetail && detailComplaint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Complaint #{detailComplaint.id}</h2>
              <button onClick={() => setShowDetail(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Customer:</span> <strong>{detailComplaint.account_no} - {detailComplaint.customer_name}</strong></div>
                <div><span className="text-gray-500">Status:</span> <Badge>{detailComplaint.status}</Badge></div>
                <div><span className="text-gray-500">Category:</span> <strong>{detailComplaint.category_name}</strong></div>
                <div><span className="text-gray-500">Priority:</span> <Badge variant={detailComplaint.priority === 'high' ? 'destructive' : 'secondary'}>{detailComplaint.priority}</Badge></div>
                <div><span className="text-gray-500">Assigned:</span> <strong>{detailComplaint.assigned_to_name || 'Unassigned'}</strong></div>
                <div><span className="text-gray-500">Date:</span> <strong>{detailComplaint.created_at ? new Date(detailComplaint.created_at).toLocaleDateString() : '-'}</strong></div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg text-sm"><strong>Description:</strong><br/>{detailComplaint.description}</div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm mb-2">Actions</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Reassign To</Label>
                    <select className="w-full h-9 px-3 rounded-md border border-gray-300 text-sm" value={assignForm.assigned_to} onChange={e => setAssignForm({ ...assignForm, assigned_to: e.target.value })}>
                      <option value="">Unassigned</option>
                      {employees?.map((e: any) => <option key={e.id} value={e.id}>{e.first_name} {e.other_names}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Change Priority</Label>
                    <select className="w-full h-9 px-3 rounded-md border border-gray-300 text-sm" value={assignForm.priority} onChange={e => setAssignForm({ ...assignForm, priority: e.target.value })}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => updateComplaint.mutate({ id: detailComplaint.id, data: { assigned_to: assignForm.assigned_to ? parseInt(assignForm.assigned_to) : null, priority: assignForm.priority } })}>
                    <UserCircle className="w-3 h-3 mr-1" /> Update
                  </Button>
                  {detailComplaint.status === 'open' && (
                    <Button size="sm" variant="default" onClick={() => updateComplaint.mutate({ id: detailComplaint.id, data: { status: 'resolved' } })}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Resolve
                    </Button>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm mb-2">Activity Log</h3>
                <div className="space-y-2 mb-3">
                  {activities?.length === 0 ? (
                    <div className="text-sm text-gray-500">No activity yet</div>
                  ) : (
                    activities?.map((a: any) => (
                      <div key={a.id} className="text-sm bg-gray-50 p-2 rounded">
                        <span className="font-medium">{a.activity_type}</span>
                        {a.old_value && <span className="text-gray-500"> ({a.old_value} → {a.new_value})</span>}
                        {a.notes && <div className="text-gray-600 mt-1">{a.notes}</div>}
                        <div className="text-xs text-gray-400 mt-1">by {a.created_by_name || 'System'} at {new Date(a.created_at).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Add a note..." value={activityNote} onChange={e => setActivityNote(e.target.value)} />
                  <Button size="sm" onClick={() => addActivity.mutate({ id: detailComplaint.id, data: { notes: activityNote } })}>Add Note</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lookup Form Modal */}
      {showLookupForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingLookup ? 'Edit' : 'New'} {lookupTable.slice(0, -1)}</h2>
              <button onClick={() => setShowLookupForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {lookupTable !== 'employees' && (
                <div className="space-y-2"><Label>Code</Label><Input value={lookupForm.code || ''} onChange={e => setLookupForm({ ...lookupForm, code: e.target.value })} /></div>
              )}
              <div className="space-y-2"><Label>Name</Label><Input value={lookupForm.name || ''} onChange={e => setLookupForm({ ...lookupForm, name: e.target.value })} /></div>
              {lookupTable === 'employees' && (
                <>
                  <div className="space-y-2"><Label>First Name</Label><Input value={lookupForm.first_name || ''} onChange={e => setLookupForm({ ...lookupForm, first_name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Other Names</Label><Input value={lookupForm.other_names || ''} onChange={e => setLookupForm({ ...lookupForm, other_names: e.target.value })} /></div>
                </>
              )}
              <div className="flex gap-2">
                <Button onClick={() => saveLookup.mutate(lookupForm)} disabled={saveLookup.isPending}>Save</Button>
                <Button variant="outline" onClick={() => setShowLookupForm(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
