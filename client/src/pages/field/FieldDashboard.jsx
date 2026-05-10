import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Gauge, Camera, MapPin, Clock, ArrowRight, AlertCircle } from 'lucide-react'
import { getAllItems, countItems } from '../../pwa/db'
import { cacheFieldData } from '../../pwa/syncManager'
import { useOnlineStatus } from '../../pwa/useOnlineStatus'

function formatRelativeTime(isoString) {
  if (!isoString) return 'Never'
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin} min${diffMin !== 1 ? 's' : ''} ago`
  if (diffHr < 24) return `${diffHr} hr${diffHr !== 1 ? 's' : ''} ago`
  return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`
}

const priorityColors = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
}

const typeBadgeColors = {
  leak: 'bg-blue-100 text-blue-700',
  meter_install: 'bg-green-100 text-green-700',
  meter_replace: 'bg-purple-100 text-purple-700',
  disconnection: 'bg-red-100 text-red-700',
  reconnection: 'bg-yellow-100 text-yellow-700',
  maintenance: 'bg-orange-100 text-orange-700',
  inspection: 'bg-teal-100 text-teal-700',
  default: 'bg-gray-100 text-gray-700',
}

function getTypeBadge(type) {
  const lower = (type || '').toLowerCase()
  for (const [key, cls] of Object.entries(typeBadgeColors)) {
    if (key !== 'default' && lower.includes(key)) return cls
  }
  return typeBadgeColors.default
}

const FieldDashboard = () => {
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()

  const [assignedCount, setAssignedCount] = useState(0)
  const [readingsToday, setReadingsToday] = useState(0)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [todaysSchedule, setTodaysSchedule] = useState([])
  const [gpsStatus, setGpsStatus] = useState('checking') // 'active' | 'unavailable' | 'checking'
  const [lastSync, setLastSync] = useState(null)

  // Load all dashboard data from IndexedDB
  useEffect(() => {
    async function loadDashboard() {
      try {
        // Summary counts
        const workOrders = await getAllItems('cachedWorkOrders')
        setAssignedCount(workOrders.length)

        const pendingReadings = await countItems('pendingReadings')
        const pendingUpdates = await countItems('pendingWorkOrderUpdates')
        const pendingPhotos = await countItems('pendingPhotos')
        setPendingSyncCount(pendingReadings + pendingUpdates + pendingPhotos)

        // Readings today - count from syncLog entries created today
        const syncLog = await getAllItems('syncLog')
        const today = new Date().toISOString().slice(0, 10)
        const todaySynced = syncLog
          .filter(e => e.timestamp && e.timestamp.slice(0, 10) === today && e.status === 'success')
          .reduce((sum, e) => sum + (e.readings?.synced || 0), 0)
        setReadingsToday(todaySynced)

        // Today's schedule - filter work orders by today's scheduled_date
        const todayStr = new Date().toISOString().slice(0, 10)
        const todayWOs = workOrders
          .filter(wo => {
            const sd = wo.scheduled_date || wo.scheduledDate
            return sd && sd.slice(0, 10) === todayStr
          })
          .sort((a, b) => {
            const tA = a.scheduled_time_from || a.scheduledTimeFrom || ''
            const tB = b.scheduled_time_from || b.scheduledTimeFrom || ''
            return tA.localeCompare(tB)
          })
        setTodaysSchedule(todayWOs)

        // Last sync timestamp
        if (syncLog.length > 0) {
          const sorted = [...syncLog].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          setLastSync(sorted[0].timestamp)
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      }
    }

    loadDashboard()
  }, [])

  // Auto-cache field data when online
  useEffect(() => {
    if (isOnline) {
      cacheFieldData().catch(err => console.error('Auto-cache failed:', err))
    }
  }, [isOnline])

  // GPS check on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable')
      return
    }
    navigator.geolocation.getCurrentPosition(
      () => setGpsStatus('active'),
      () => setGpsStatus('unavailable'),
      { timeout: 10000 }
    )
  }, [])

  const summaryCards = [
    {
      label: 'Assigned Work Orders',
      count: assignedCount,
      icon: ClipboardList,
      borderColor: 'border-l-blue-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
    {
      label: 'Readings Today',
      count: readingsToday,
      icon: Gauge,
      borderColor: 'border-l-green-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-500',
    },
    {
      label: 'Pending Sync',
      count: pendingSyncCount,
      icon: Camera,
      borderColor: 'border-l-amber-500',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-500',
    },
  ]

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Field Dashboard</h1>
        <div className="flex items-center gap-2 text-sm">
          {gpsStatus === 'active' && (
            <span className="flex items-center gap-1 text-green-600">
              <MapPin className="h-4 w-4" /> GPS Active
            </span>
          )}
          {gpsStatus === 'unavailable' && (
            <span className="flex items-center gap-1 text-red-500">
              <MapPin className="h-4 w-4" /> GPS Unavailable
            </span>
          )}
          {gpsStatus === 'checking' && (
            <span className="flex items-center gap-1 text-gray-400">
              <MapPin className="h-4 w-4 animate-pulse" /> Checking GPS...
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {summaryCards.map(card => (
          <div
            key={card.label}
            className={`bg-white rounded-lg shadow-sm border-l-4 ${card.borderColor} p-4 flex items-center gap-3`}
          >
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900">{card.count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/field/readings')}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg p-4 min-h-[64px] text-base font-medium active:bg-blue-700 transition-colors"
        >
          <Gauge className="h-5 w-5" />
          Take Reading
        </button>
        <button
          onClick={() => navigate('/field/workorders')}
          className="flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-lg p-4 min-h-[64px] text-base font-medium active:bg-emerald-700 transition-colors"
        >
          <ClipboardList className="h-5 w-5" />
          View Work Orders
        </button>
      </div>

      {/* Today's Schedule */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Today's Schedule</h2>
          <button
            onClick={() => navigate('/field/workorders')}
            className="text-sm text-blue-600 flex items-center gap-1"
          >
            View All <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {todaysSchedule.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No work orders scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todaysSchedule.map(wo => {
              const priority = (wo.priority || 'normal').toLowerCase()
              const woType = wo.type || wo.work_order_type || ''
              const timeFrom = wo.scheduled_time_from || wo.scheduledTimeFrom || ''
              const timeTo = wo.scheduled_time_to || wo.scheduledTimeTo || ''
              const customerName = wo.customer_name || wo.customerName || 'Unknown Customer'
              const woNumber = wo.work_order_number || wo.workOrderNumber || `WO-${wo.id}`

              return (
                <button
                  key={wo.id}
                  onClick={() => navigate(`/field/workorders/${wo.id}`)}
                  className="w-full bg-white rounded-lg shadow-sm p-3 flex items-start gap-3 text-left active:bg-gray-50 transition-colors min-h-[44px]"
                >
                  {/* Priority indicator */}
                  <div className={`w-1 self-stretch rounded-full ${priority === 'urgent' ? 'bg-red-500' : priority === 'high' ? 'bg-orange-500' : priority === 'low' ? 'bg-gray-300' : 'bg-blue-400'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-900 truncate">{woNumber}</span>
                      {woType && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getTypeBadge(woType)}`}>
                          {woType}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{customerName}</p>
                    {(timeFrom || timeTo) && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeFrom}{timeTo ? ` - ${timeTo}` : ''}
                      </p>
                    )}
                  </div>

                  {priority === 'urgent' && (
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-1" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Last Sync Info */}
      <div className="bg-white rounded-lg shadow-sm p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="h-4 w-4" />
          <span>Last Sync: {formatRelativeTime(lastSync)}</span>
        </div>
        {pendingSyncCount > 0 && (
          <button
            onClick={() => navigate('/field/sync')}
            className="text-sm text-amber-600 font-medium flex items-center gap-1"
          >
            {pendingSyncCount} pending <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}

export default FieldDashboard
