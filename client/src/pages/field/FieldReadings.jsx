import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CheckCircle, Circle, Gauge, MapPin } from 'lucide-react'
import { getAllItems, putItem } from '../../pwa/db'
import { useOnlineStatus } from '../../pwa/useOnlineStatus'
import api from '../../api/axios'

export default function FieldReadings() {
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  const [meters, setMeters] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [readToday, setReadToday] = useState(new Set())

  // Load today's read meter IDs from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('ewasco_read_today')
      if (stored) {
        setReadToday(new Set(JSON.parse(stored)))
      }
    } catch {
      // ignore
    }
  }, [])

  // Persist readToday to sessionStorage
  const markReadToday = (meterId) => {
    setReadToday(prev => {
      const next = new Set(prev)
      next.add(meterId)
      sessionStorage.setItem('ewasco_read_today', JSON.stringify([...next]))
      return next
    })
  }

  // Expose markReadToday on window so FieldReadingForm can call it
  useEffect(() => {
    window.__ewasco_markReadToday = markReadToday
    return () => { delete window.__ewasco_markReadToday }
  }, [])

  // Load meters from IndexedDB, fallback to API
  useEffect(() => {
    let cancelled = false
    const loadMeters = async () => {
      setLoading(true)
      try {
        const cached = await getAllItems('cachedRouteMeters')
        if (cached && cached.length > 0) {
          if (!cancelled) setMeters(cached)
        } else if (isOnline) {
          try {
            const res = await api.get('/meters?limit=500')
            const data = res.data?.data || []
            if (!cancelled) {
              setMeters(data)
              // Cache each meter for offline
              for (const m of data) {
                await putItem('cachedRouteMeters', m).catch(() => {})
              }
            }
          } catch {
            // API unavailable, keep empty list
          }
        }
      } catch {
        // IndexedDB not ready
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadMeters()
    return () => { cancelled = true }
  }, [isOnline])

  // Client-side search filter
  const filteredMeters = useMemo(() => {
    if (!search.trim()) return meters
    const q = search.toLowerCase().trim()
    return meters.filter(m => {
      const serial = (m.meter_no || m.serial_number || '').toLowerCase()
      const name = (m.customer_name || `${m.first_name || ''} ${m.last_name || ''}`).toLowerCase()
      return serial.includes(q) || name.includes(q)
    })
  }, [meters, search])

  const readCount = useMemo(() => {
    return filteredMeters.filter(m => readToday.has(m.id)).length
  }, [filteredMeters, readToday])

  const getCustomerName = (m) => {
    if (m.customer_name) return m.customer_name
    return `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Unknown'
  }

  const getSerial = (m) => m.meter_no || m.serial_number || '—'
  const getAddress = (m) => m.meter_location || m.address || ''
  const getLastReading = (m) => m.current_reading ?? m.previous_reading ?? '—'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col -mx-4 -mt-4">
      {/* Summary header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">Meter Readings</h1>
          <span className="text-sm text-gray-500">
            {readCount} of {filteredMeters.length} read today
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div
            className="bg-green-500 rounded-full h-2 transition-all duration-300"
            style={{ width: filteredMeters.length ? `${(readCount / filteredMeters.length) * 100}%` : '0%' }}
          />
        </div>

        {/* Search bar - sticky */}
        <div className="sticky top-14 z-40 -mx-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by serial or customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Meter list */}
      <div className="px-4 pb-4 space-y-2">
        {filteredMeters.length === 0 ? (
          <div className="text-center py-12">
            <Gauge className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {meters.length === 0 ? 'No meters loaded. Sync when online.' : 'No meters match your search.'}
            </p>
          </div>
        ) : (
          filteredMeters.map((meter) => {
            const isRead = readToday.has(meter.id)
            return (
              <button
                key={meter.id}
                type="button"
                onClick={() => navigate(`/field/readings/new/${meter.id}`)}
                className="w-full text-left bg-white rounded-lg shadow-sm p-4 mb-2 flex items-start gap-3 active:bg-gray-50 transition-colors border border-gray-100"
              >
                {/* Status indicator */}
                <div className="flex-shrink-0 mt-0.5">
                  {isRead ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300" />
                  )}
                </div>

                {/* Meter info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 text-sm">{getSerial(meter)}</span>
                    {isRead && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Read
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 truncate mt-0.5">{getCustomerName(meter)}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {getAddress(meter) && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {getAddress(meter)}
                      </span>
                    )}
                    <span className="flex-shrink-0">
                      Last: {getLastReading(meter)}
                    </span>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
