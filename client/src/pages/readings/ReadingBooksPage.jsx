import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../../api/axios'
import {
  Plus,
  Printer,
  FileText,
  Layers,
  Search,
  Save,
  RefreshCw,
  CheckCircle,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'

const ReadingBooksPage = () => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ routeId: '', periodCode: '' })
  const [selectedBookId, setSelectedBookId] = useState(null)

  const { data: routesData = [] } = useQuery(
    ['routes'],
    async () => {
      const res = await api.get('/routes')
      return res.data.data || []
    }
  )

  const { data: booksData = [], isLoading: booksLoading } = useQuery(
    ['reading-books'],
    async () => {
      const res = await api.get('/reading-books')
      return res.data.data || []
    }
  )

  const {
    data: selectedBookData,
    isLoading: selectedBookLoading,
    refetch: refetchSelectedBook
  } = useQuery(
    ['reading-book', selectedBookId],
    async () => {
      const res = await api.get(`/reading-books/${selectedBookId}`)
      return res.data.data
    },
    {
      enabled: !!selectedBookId,
      refetchOnWindowFocus: false
    }
  )

  const generateMutation = useMutation(
    async (payload) => {
      const res = await api.post('/reading-books/generate', payload)
      return res.data
    },
    {
      onSuccess: () => {
        toast.success('Reading book generated successfully')
        setForm({ routeId: '', periodCode: '' })
        queryClient.invalidateQueries(['reading-books'])
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to generate reading book')
      }
    }
  )

  const closeMutation = useMutation(
    async (id) => {
      const res = await api.put(`/reading-books/${id}/close`)
      return res.data
    },
    {
      onSuccess: () => {
        toast.success('Reading book closed successfully')
        queryClient.invalidateQueries(['reading-books'])
        if (selectedBookId) {
          refetchSelectedBook()
        }
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Unable to close reading book')
      }
    }
  )

  const books = useMemo(() => booksData || [], [booksData])
  const selectedBook = selectedBookData || null

  const handleGenerate = () => {
    if (!form.routeId || !form.periodCode) {
      toast.error('Select a route and period before generating')
      return
    }
    generateMutation.mutate({ routeId: form.routeId, periodCode: form.periodCode })
  }

  const handleOpenBook = (bookId) => {
    setSelectedBookId(bookId)
  }

  const handleCloseBook = () => {
    if (!selectedBookId) return
    closeMutation.mutate(selectedBookId)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reading Books</h1>
          <p className="text-gray-500 mt-1">Generate route-based reading books and review meter reading assignments.</p>
        </div>
        <button
          onClick={() => handlePrint()}
          className="btn btn-secondary inline-flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Print Book
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="card p-6 space-y-4">
          <div className="flex items-center gap-3 text-primary-600">
            <Layers className="w-5 h-5" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Generate New Reading Book</h2>
              <p className="text-sm text-gray-500">Create a delivery book for an entire route and period.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Route</label>
              <select
                className="input w-full"
                value={form.routeId}
                onChange={(e) => setForm((prev) => ({ ...prev, routeId: e.target.value }))}
              >
                <option value="">Select a route</option>
                {routesData.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.route_name || route.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Period</label>
              <input
                type="month"
                className="input w-full"
                value={form.periodCode}
                onChange={(e) => setForm((prev) => ({ ...prev, periodCode: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerate}
              disabled={generateMutation.isLoading}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              {generateMutation.isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Generate Reading Book
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setForm({ routeId: '', periodCode: '' })}
              className="btn btn-secondary"
            >
              Clear
            </button>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900">Last Generated Books</h2>
          <p className="text-sm text-gray-500">Quick summary of recent reading book assignments.</p>

          {booksLoading ? (
            <div className="py-10 text-center text-gray-500">Loading books...</div>
          ) : books.length === 0 ? (
            <div className="py-10 text-center text-gray-500">No reading books generated yet.</div>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Period</th>
                    <th>Status</th>
                    <th>Meters</th>
                    <th>Done</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((book) => (
                    <tr key={book.id} className="hover:bg-gray-50">
                      <td>{book.route_name || book.route_id}</td>
                      <td>{book.period_code}</td>
                      <td>{book.status}</td>
                      <td>{book.meter_count}</td>
                      <td>{book.readings_done || 0}</td>
                      <td>
                        <button
                          onClick={() => handleOpenBook(book.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedBook && (
        <section className="card p-6 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Reading Book Detail</h2>
              <p className="text-sm text-gray-500">Review meter entries and completion status.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-secondary inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                type="button"
                onClick={handleCloseBook}
                disabled={selectedBook.status === 'closed' || closeMutation.isLoading}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Close Book
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Route</p>
              <p className="font-semibold text-gray-900">{selectedBook.route_name || selectedBook.route_id}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Period</p>
              <p className="font-semibold text-gray-900">{selectedBook.period_code}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
              <p className="font-semibold text-gray-900">{selectedBook.status}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Readings</p>
              <p className="font-semibold text-gray-900">{selectedBook.readings_done || 0}/{selectedBook.meter_count || 0}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Meter</th>
                  <th>Customer</th>
                  <th>Previous Reading</th>
                  <th>Current Reading</th>
                  <th>Consumption</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedBook.entries?.map((entry, index) => (
                  <tr key={entry.id || index} className="hover:bg-gray-50">
                    <td>{index + 1}</td>
                    <td>{entry.serial_number || entry.meter_id}</td>
                    <td>{entry.customer_name || entry.account_number || entry.customer_id}</td>
                    <td>{entry.previous_reading != null ? entry.previous_reading : '-'}</td>
                    <td>{entry.current_reading != null ? entry.current_reading : '-'}</td>
                    <td>{entry.consumption != null ? entry.consumption : '-'}</td>
                    <td>{entry.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedBookId && !selectedBook && selectedBookLoading && (
        <div className="card p-6 text-center text-gray-500">Loading book details...</div>
      )}
    </div>
  )
}

export default ReadingBooksPage
