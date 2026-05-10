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
import { Receipt, BarChart3, Users, Download, Eye, Search, X, Printer } from 'lucide-react'

interface PaymentArrangement {
  id: number
  customer_name: string
  account_no: string
  total_debt: number
  first_installment: number
  num_installments: number
  engagement_date: string
  status: string
  installments?: any[]
}

export default function DebtPage() {
  const [activeTab, setActiveTab] = useState('arrangements')
  const [agedSubTab, setAgedSubTab] = useState('zone')
  const [agedView, setAgedView] = useState('summary')
  const [agedMonths, setAgedMonths] = useState('6')
  const [selectedArrangement, setSelectedArrangement] = useState<PaymentArrangement | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const queryClient = useQueryClient()

  const { data: arrangements } = useQuery({
    queryKey: ['arrangements'],
    queryFn: async () => {
      const res = await api.get('/debt/arrangements')
      return res.data.data as PaymentArrangement[]
    }
  })

  const { data: agedZone } = useQuery({
    queryKey: ['aged-analysis-zone', agedView, agedMonths],
    queryFn: async () => {
      const res = await api.get(`/debt/aged-analysis/zone?view=${agedView}&months=${agedMonths}`)
      return res.data.data
    },
    enabled: agedSubTab === 'zone'
  })

  const { data: agedArea } = useQuery({
    queryKey: ['aged-analysis-area', agedView, agedMonths],
    queryFn: async () => {
      const res = await api.get(`/debt/aged-analysis/area?view=${agedView}&months=${agedMonths}`)
      return res.data.data
    },
    enabled: agedSubTab === 'area'
  })

  const { data: agedCategory } = useQuery({
    queryKey: ['aged-analysis-category'],
    queryFn: async () => {
      const res = await api.get('/debt/aged-analysis/category')
      return res.data.data
    },
    enabled: agedSubTab === 'category'
  })

  const { data: debtors } = useQuery({
    queryKey: ['debtors'],
    queryFn: async () => {
      const res = await api.get('/debt/debtors?min_balance=1&limit=100')
      return res.data.data
    }
  })

  const createArrangement = useMutation({
    mutationFn: (data: any) => api.post('/debt/arrangements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arrangements'] })
      toast({ title: 'Arrangement created successfully' })
      setFormData({ customer_id: '', total_debt: '', first_installment: '', num_installments: '', engagement_date: new Date().toISOString().split('T')[0] })
      setSelectedCustomer(null)
    },
    onError: () => toast({ title: 'Failed to create arrangement', variant: 'destructive' })
  })

  const cancelArrangement = useMutation({
    mutationFn: (id: number) => api.post(`/debt/arrangements/${id}/cancel`, { reason: 'Cancelled by user' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arrangements'] })
      toast({ title: 'Arrangement cancelled' })
    }
  })

  const searchCustomers = async () => {
    if (!customerSearch.trim()) return
    const res = await api.get(`/customers/search?q=${customerSearch}`)
    setCustomerResults(res.data.data || [])
  }

  const viewArrangementDetail = async (arr: PaymentArrangement) => {
    const res = await api.get(`/debt/arrangements/${arr.id}`)
    setSelectedArrangement(res.data.data)
    setShowDetailModal(true)
  }

  const exportAgedAnalysis = () => {
    window.open(`/api/debt/aged-analysis/export?type=${agedSubTab}&view=${agedView}`, '_blank')
  }

  const exportDebtors = () => {
    window.open('/api/debt/debtors/export', '_blank')
  }

  const [formData, setFormData] = useState({
    customer_id: '',
    total_debt: '',
    first_installment: '',
    num_installments: '',
    engagement_date: new Date().toISOString().split('T')[0]
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createArrangement.mutate({
      customer_id: parseInt(formData.customer_id),
      total_debt: parseFloat(formData.total_debt),
      first_installment: parseFloat(formData.first_installment),
      num_installments: parseInt(formData.num_installments),
      engagement_date: formData.engagement_date
    })
  }

  const selectCustomer = (customer: any) => {
    setSelectedCustomer(customer)
    setFormData({ ...formData, customer_id: String(customer.id), total_debt: String(customer.balance || 0) })
    setCustomerResults([])
    setCustomerSearch('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Debt Management</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="arrangements">
            <Receipt className="w-4 h-4 mr-2" />
            Arrangements
          </TabsTrigger>
          <TabsTrigger value="aged">
            <BarChart3 className="w-4 h-4 mr-2" />
            Aged Analysis
          </TabsTrigger>
          <TabsTrigger value="debtors">
            <Users className="w-4 h-4 mr-2" />
            Debtors
          </TabsTrigger>
        </TabsList>

        {/* PAYMENT ARRANGEMENTS */}
        <TabsContent value="arrangements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New Payment Arrangement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Search Customer</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Account no or name..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchCustomers()}
                  />
                  <Button type="button" variant="outline" onClick={searchCustomers}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                {customerResults.length > 0 && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    {customerResults.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0 text-sm"
                      >
                        <span className="font-medium">{c.account_no}</span> — {c.name} (Balance: {c.balance?.toLocaleString()})
                      </button>
                    ))}
                  </div>
                )}
                {selectedCustomer && (
                  <div className="mt-2 p-2 bg-sky-50 rounded-lg text-sm flex items-center justify-between">
                    <span>Selected: <strong>{selectedCustomer.account_no}</strong> — {selectedCustomer.name} (Balance: {selectedCustomer.balance?.toLocaleString()})</span>
                    <button onClick={() => { setSelectedCustomer(null); setFormData({ ...formData, customer_id: '', total_debt: '' }) }}>
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input type="hidden" value={formData.customer_id} />
                <div className="space-y-2">
                  <Label>Total Debt</Label>
                  <Input type="number" step="0.01" value={formData.total_debt} onChange={e => setFormData({ ...formData, total_debt: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>First Installment</Label>
                  <Input type="number" step="0.01" value={formData.first_installment} onChange={e => setFormData({ ...formData, first_installment: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>No. of Installments</Label>
                  <Input type="number" value={formData.num_installments} onChange={e => setFormData({ ...formData, num_installments: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Engagement Date</Label>
                  <Input type="date" value={formData.engagement_date} onChange={e => setFormData({ ...formData, engagement_date: e.target.value })} required />
                </div>
                <div className="md:col-span-4">
                  <Button type="submit" disabled={createArrangement.isPending || !formData.customer_id}>
                    {createArrangement.isPending ? 'Creating...' : 'Create Arrangement'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Arrangements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-right">Total Debt</th>
                      <th className="px-4 py-2 text-right">First</th>
                      <th className="px-4 py-2 text-center">#</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arrangements?.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-500">No arrangements found</td></tr>
                    ) : (
                      arrangements?.map((a: any) => (
                        <tr key={a.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{a.account_no} - {a.customer_name}</td>
                          <td className="px-4 py-2 text-right">{a.total_debt?.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right">{a.first_installment?.toLocaleString()}</td>
                          <td className="px-4 py-2 text-center">{a.num_installments}</td>
                          <td className="px-4 py-2">{new Date(a.engagement_date).toLocaleDateString()}</td>
                          <td className="px-4 py-2">
                            <Badge variant={a.status === 'active' ? 'default' : 'secondary'}>{a.status}</Badge>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => viewArrangementDetail(a)}>
                                <Eye className="w-3 h-3 mr-1" /> View
                              </Button>
                              {a.status === 'active' && (
                                <Button size="sm" variant="destructive" onClick={() => cancelArrangement.mutate(a.id)}>
                                  <X className="w-3 h-3 mr-1" /> Cancel
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

        {/* AGED ANALYSIS */}
        <TabsContent value="aged" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Aged Analysis</CardTitle>
                <div className="flex gap-2">
                  <select className="h-9 px-3 rounded-md border border-gray-300 text-sm" value={agedView} onChange={e => setAgedView(e.target.value)}>
                    <option value="summary">Summary</option>
                    <option value="detailed">Detailed</option>
                  </select>
                  <select className="h-9 px-3 rounded-md border border-gray-300 text-sm" value={agedMonths} onChange={e => setAgedMonths(e.target.value)}>
                    <option value="6">6 Months</option>
                    <option value="12">1 Year</option>
                    <option value="84">7 Years</option>
                  </select>
                  <Button variant="outline" size="sm" onClick={exportAgedAnalysis}>
                    <Download className="w-4 h-4 mr-1" /> Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button size="sm" variant={agedSubTab === 'zone' ? 'default' : 'outline'} onClick={() => setAgedSubTab('zone')}>By Zone</Button>
                <Button size="sm" variant={agedSubTab === 'area' ? 'default' : 'outline'} onClick={() => setAgedSubTab('area')}>By Area</Button>
                <Button size="sm" variant={agedSubTab === 'category' ? 'default' : 'outline'} onClick={() => setAgedSubTab('category')}>By Category</Button>
              </div>

              {agedSubTab === 'zone' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Zone</th>
                        <th className="px-4 py-2 text-center">Cust</th>
                        <th className="px-4 py-2 text-right">Current</th>
                        <th className="px-4 py-2 text-right">1M</th>
                        <th className="px-4 py-2 text-right">2M</th>
                        <th className="px-4 py-2 text-right">3M</th>
                        <th className="px-4 py-2 text-right">4M</th>
                        <th className="px-4 py-2 text-right">5M</th>
                        <th className="px-4 py-2 text-right">6M+</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agedZone?.length === 0 ? (
                        <tr><td colSpan={10} className="px-4 py-4 text-center text-gray-500">No data</td></tr>
                      ) : (
                        agedZone?.map((row: any, idx: number) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{row.billing_group_name || row.customer_name || row.account_no}</td>
                            <td className="px-4 py-2 text-center">{row.customer_count || '-'}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.current_amount || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.month_1 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.month_2 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.month_3 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.month_4 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.month_5 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-red-600">{parseFloat(row.over_6_months || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right font-bold">{parseFloat(row.total_balance || row.balance || 0).toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {agedSubTab === 'area' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Area</th>
                        <th className="px-4 py-2 text-center">Cust</th>
                        <th className="px-4 py-2 text-right">Current</th>
                        <th className="px-4 py-2 text-right">1M</th>
                        <th className="px-4 py-2 text-right">2M</th>
                        <th className="px-4 py-2 text-right">3M</th>
                        <th className="px-4 py-2 text-right">4M</th>
                        <th className="px-4 py-2 text-right">5M</th>
                        <th className="px-4 py-2 text-right">6M+</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agedArea?.length === 0 ? (
                        <tr><td colSpan={10} className="px-4 py-4 text-center text-gray-500">No data</td></tr>
                      ) : (
                        agedArea?.map((row: any, idx: number) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{row.area_code || row.customer_name || row.account_no}</td>
                            <td className="px-4 py-2 text-center">{row.customer_count || '-'}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.current_amount || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.month_1 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.month_2 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.month_3 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.month_4 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.month_5 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-red-600">{parseFloat(row.over_6_months || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right font-bold">{parseFloat(row.total_balance || row.balance || 0).toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {agedSubTab === 'category' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Category</th>
                        <th className="px-4 py-2 text-center">Cust</th>
                        <th className="px-4 py-2 text-right">Current</th>
                        <th className="px-4 py-2 text-right">1M</th>
                        <th className="px-4 py-2 text-right">2M</th>
                        <th className="px-4 py-2 text-right">3-6M</th>
                        <th className="px-4 py-2 text-right">6M+</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agedCategory?.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-4 text-center text-gray-500">No data</td></tr>
                      ) : (
                        agedCategory?.map((row: any, idx: number) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{row.category_name}</td>
                            <td className="px-4 py-2 text-center">{row.customer_count}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.current_amount || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.month_1 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.month_2 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{parseFloat(row.months_3_6 || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-red-600">{parseFloat(row.over_6_months || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right font-bold">{parseFloat(row.total_balance || 0).toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEBTORS */}
        <TabsContent value="debtors" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Debtors Report</CardTitle>
                <Button variant="outline" size="sm" onClick={exportDebtors}>
                  <Download className="w-4 h-4 mr-1" /> Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-left">Area</th>
                      <th className="px-4 py-2 text-left">Telephone</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2 text-center">Bills</th>
                      <th className="px-4 py-2 text-left">Oldest Bill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtors?.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-4 text-center text-gray-500">No debtors found</td></tr>
                    ) : (
                      debtors?.map((d: any) => (
                        <tr key={d.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{d.account_no}</td>
                          <td className="px-4 py-2">{d.name}</td>
                          <td className="px-4 py-2">{d.category_name}</td>
                          <td className="px-4 py-2">{d.area_code}</td>
                          <td className="px-4 py-2">{d.telephone}</td>
                          <td className="px-4 py-2 text-right font-bold text-red-600">{parseFloat(d.total_balance || 0).toLocaleString()}</td>
                          <td className="px-4 py-2 text-center">{d.unpaid_bills}</td>
                          <td className="px-4 py-2">{d.oldest_bill_date ? new Date(d.oldest_bill_date).toLocaleDateString() : '-'}</td>
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

      {/* Arrangement Detail Modal */}
      {showDetailModal && selectedArrangement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Arrangement Detail</h2>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Customer:</span> <strong>{selectedArrangement.account_no} - {selectedArrangement.customer_name}</strong></div>
                <div><span className="text-gray-500">Status:</span> <Badge variant={selectedArrangement.status === 'active' ? 'default' : 'secondary'}>{selectedArrangement.status}</Badge></div>
                <div><span className="text-gray-500">Total Debt:</span> <strong>{selectedArrangement.total_debt?.toLocaleString()}</strong></div>
                <div><span className="text-gray-500">First Installment:</span> <strong>{selectedArrangement.first_installment?.toLocaleString()}</strong></div>
                <div><span className="text-gray-500">Installments:</span> <strong>{selectedArrangement.num_installments}</strong></div>
                <div><span className="text-gray-500">Engagement Date:</span> <strong>{new Date(selectedArrangement.engagement_date).toLocaleDateString()}</strong></div>
              </div>

              <h3 className="font-semibold text-sm mt-4">Installment Schedule</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">Due Date</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Paid Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedArrangement.installments?.map((inst: any, idx: number) => (
                      <tr key={inst.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{idx + 1}</td>
                        <td className="px-4 py-2">{new Date(inst.due_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2 text-right">{parseFloat(inst.amount).toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <Badge variant={inst.status === 'paid' ? 'default' : inst.status === 'overdue' ? 'destructive' : 'secondary'}>
                            {inst.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">{inst.paid_date ? new Date(inst.paid_date).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-1" /> Print
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
