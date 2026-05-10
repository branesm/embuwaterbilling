import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { ClipboardList, AlertTriangle, BookOpen } from 'lucide-react'

interface MeterReading {
  id: number
  customer_name: string
  account_no: string
  meter_no: string
  reading_date: string
  current_reading: number
  previous_reading: number
  consumption: number
  is_anomaly: boolean
  is_billed: boolean
}

export default function ReadingsPage() {
  const [activeTab, setActiveTab] = useState('capture')
  const queryClient = useQueryClient()

  const { data: readings, isLoading } = useQuery({
    queryKey: ['readings'],
    queryFn: async () => {
      const res = await api.get('/readings?limit=100')
      return res.data.data as MeterReading[]
    }
  })

  const { data: anomalies } = useQuery({
    queryKey: ['readings-anomalies'],
    queryFn: async () => {
      const res = await api.get('/readings/anomalies')
      return res.data.data as MeterReading[]
    }
  })

  const createReading = useMutation({
    mutationFn: (data: any) => api.post('/readings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readings'] })
      toast({ title: 'Reading saved successfully' })
    },
    onError: () => toast({ title: 'Failed to save reading', variant: 'destructive' })
  })

  const [formData, setFormData] = useState({
    customer_id: '',
    meter_id: '',
    current_reading: '',
    previous_reading: '',
    reading_date: new Date().toISOString().split('T')[0],
    comments: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createReading.mutate({
      ...formData,
      customer_id: parseInt(formData.customer_id),
      meter_id: parseInt(formData.meter_id),
      current_reading: parseFloat(formData.current_reading),
      previous_reading: parseFloat(formData.previous_reading),
      billing_period_id: 1
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Meter Readings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="capture">
            <ClipboardList className="w-4 h-4 mr-2" />
            Capture
          </TabsTrigger>
          <TabsTrigger value="anomalies">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Anomalies
          </TabsTrigger>
          <TabsTrigger value="book">
            <BookOpen className="w-4 h-4 mr-2" />
            Reading Book
          </TabsTrigger>
        </TabsList>

        <TabsContent value="capture" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New Reading</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Customer ID</Label>
                  <Input
                    type="number"
                    value={formData.customer_id}
                    onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meter ID</Label>
                  <Input
                    type="number"
                    value={formData.meter_id}
                    onChange={e => setFormData({ ...formData, meter_id: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reading Date</Label>
                  <Input
                    type="date"
                    value={formData.reading_date}
                    onChange={e => setFormData({ ...formData, reading_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Previous Reading</Label>
                  <Input
                    type="number"
                    value={formData.previous_reading}
                    onChange={e => setFormData({ ...formData, previous_reading: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Reading</Label>
                  <Input
                    type="number"
                    value={formData.current_reading}
                    onChange={e => setFormData({ ...formData, current_reading: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Comments</Label>
                  <Input
                    value={formData.comments}
                    onChange={e => setFormData({ ...formData, comments: e.target.value })}
                  />
                </div>
                <div className="md:col-span-3">
                  <Button type="submit" disabled={createReading.isPending}>
                    {createReading.isPending ? 'Saving...' : 'Save Reading'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Readings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Meter</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-right">Previous</th>
                      <th className="px-4 py-2 text-right">Current</th>
                      <th className="px-4 py-2 text-right">Consumption</th>
                      <th className="px-4 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan={7} className="px-4 py-4 text-center">Loading...</td></tr>
                    ) : readings?.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-500">No readings found</td></tr>
                    ) : (
                      readings?.map(r => (
                        <tr key={r.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{r.account_no} - {r.customer_name}</td>
                          <td className="px-4 py-2">{r.meter_no}</td>
                          <td className="px-4 py-2">{new Date(r.reading_date).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-right">{r.previous_reading}</td>
                          <td className="px-4 py-2 text-right">{r.current_reading}</td>
                          <td className="px-4 py-2 text-right font-medium">{r.consumption}</td>
                          <td className="px-4 py-2 text-center">
                            {r.is_anomaly && (
                              <Badge variant="destructive" className="text-xs">Anomaly</Badge>
                            )}
                            {r.is_billed && (
                              <Badge variant="secondary" className="text-xs ml-1">Billed</Badge>
                            )}
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

        <TabsContent value="anomalies">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reading Anomalies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Meter</th>
                      <th className="px-4 py-2 text-right">Consumption</th>
                      <th className="px-4 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalies?.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">No anomalies found</td></tr>
                    ) : (
                      anomalies?.map(r => (
                        <tr key={r.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{r.account_no} - {r.customer_name}</td>
                          <td className="px-4 py-2">{r.meter_no}</td>
                          <td className="px-4 py-2 text-right font-bold text-red-600">{r.consumption}</td>
                          <td className="px-4 py-2">{new Date(r.reading_date).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="book">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reading Book</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Select a route to view the reading book for meter readers.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
