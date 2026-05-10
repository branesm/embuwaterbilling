import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, RefreshCw, MapPin, Phone, Clock, ChevronRight } from 'lucide-react'
import { getAllItems, putItem } from '../../pwa/db'
import { useOnlineStatus } from '../../pwa/useOnlineStatus'
import api from '../../api/axios'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'active', label: 'Active', statuses: ['in_progress'] },
  { key: 'pending', label: 'Pending', statuses: ['assigned', 'pending'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] },
]

const TYPE_BADGES = {
  new_connection: { label: 'New Connection', color: 'bg-blue-100 text-blue-800' },
  disconnection: { label: 'Disconnection', color: 'bg-red-100 text-red-800' },
  reconnection: { label: 'Reconnection', color: 'bg-green-100 text-green-800' },
  meter_replacement: { label: 'Meter Replace', color: 'bg-orange-100 text-orange-800' },
  meter_repair: { label: 'Meter Repair', color: 'bg-orange-100 text-orange-800' },
  leak_repair: { label: 'Leak Repair', color: 'bg-purple-100 text-purple-800' },
  pipe_repair: { label: 'Pipe Repair', color: 'bg-purple-100 text-purple-800' },
  valve_repair: { label: 'Valve Repair', color: 'bg-purple-100 text-purple-800' },
  complaint: { label: 'Complaint', color: 'bg-yellow-100 text-yellow-800' },
  inspection: { label: 'Inspection', color: 'bg-cyan-100 text-cyan-800' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-800' },
}

const PRIORITY_BADGES = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800' },
}

export default function FieldWorkOrders() {
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  const [activeTab, setActiveTab] = useState('active')
  const [workOrders, setWorkOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const tabRef = useRef(null)

  const fetchFromAPI = useCallback(async () => {
    const res = await api.get('/workorders/my-assignments', { params: { limit: 100 } })
    const orders = res.data?.data || []
    // Cache each work order in IndexedDB
    for (const wo of orders) {
      await putItem('cachedWorkOrders', wo)
    }
    return orders
  }, [])

  const loadWorkOrders = useCallback(async (forceRefresh = false) => {
    try {
      let orders = []
      if (!forceRefresh) {
        // Try IndexedDB first
        orders = await getAllItems('cachedWorkOrders')
      }

      if (orders.length === 0 && isOnline) {
        orders = await fetchFromAPI()
      } else if (forceRefresh && isOnline) {
        orders = await fetchFromAPI()
      }

      setWorkOrders(orders)
    } catch (err) {
      console.error('Failed to load work orders:', err)
      // Fall back to cached data
      try {
        const cached = await getAllItems('cachedWorkOrders')
        setWorkOrders(cached)
      } catch {
        setWorkOrders([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isOnline, fetchFromAPI])

  useEffect(() => {
    loadWorkOrders()
  }, [loadWorkOrders])

  const handleRefresh = () => {
    if (!isOnline) {
      toast.error('You are offline. Cannot refresh.')
      return
    }
    setRefreshing(true)
    loadWorkOrders(true)
  }

  // Pull-to-refresh touch handlers
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    // Only trigger if at top of scroll and pulled down enough
    if (deltaY > 80 && window.scrollY === 0) {
      handleRefresh()
    }
  }

  // Filter work orders by tab
  const filteredOrders = workOrders.filter((wo) => {
    const tab = TABS.find((t) => t.key === activeTab)
    if (!tab) return false

    if (activeTab === 'completed') {
      // Today only for completed
      const today = new Date().toISOString().slice(0, 10)
      return tab.statuses.includes(wo.status) && wo.completed_at?.slice(0, 10) === today
    }
    return tab.statuses.includes(wo.status)
  })

  // Sort: urgent first, then by scheduled_date
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
    const pA = priorityOrder[a.priority] ?? 4
    const pB = priorityOrder[b.priority] ?? 4
    if (pA !== pB) return pA - pB
    return (a.scheduled_date || '').localeCompare(b.scheduled_date || '')
  })

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-900">Work Orders</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1 text-sm text-primary-600 font-medium disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      {/* Tabs */}
      <div
        ref={tabRef}
        className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide -mx-4 px-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {TABS.map((tab) => {
          const count = workOrders.filter((wo) => {
            if (tab.key === 'completed') {
              const today = new Date().toISOString().slice(0, 10)
              return tab.statuses.includes(wo.status) && wo.completed_at?.slice(0, 10) === today
            }
            return tab.statuses.includes(wo.status)
          }).length

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Offline indicator */}
      {!isOnline && (
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
          Offline — showing cached work orders
        </div>
      )}

      {/* Work Order List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <RefreshCw className="h-8 w-8 animate-spin mb-2" />
          <p className="text-sm">Loading work orders...</p>
        </div>
      ) : sortedOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <ClipboardList className="h-12 w-12 mb-3" />
          <p className="text-base font-medium text-gray-500">No work orders</p>
          <p className="text-sm mt-1">
            {activeTab === 'active'
              ? 'No active work orders assigned to you'
              : activeTab === 'pending'
              ? 'No pending work orders'
              : 'No completed work orders today'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedOrders.map((wo) => (
            <WorkOrderCard
              key={wo.id}
              workOrder={wo}
              onTap={() => navigate(`/field/workorders/${wo.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function WorkOrderCard({ workOrder: wo, onTap }) {
  const typeBadge = TYPE_BADGES[wo.work_order_type] || TYPE_BADGES.other
  const priorityBadge = PRIORITY_BADGES[wo.priority] || PRIORITY_BADGES.medium

  return (
    <button
      onClick={onTap}
      className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
    >
      {/* Top row: WO number + type badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-base font-bold text-gray-900">{wo.work_order_number}</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${typeBadge.color}`}>
          {typeBadge.label}
        </span>
      </div>

      {/* Customer name + phone */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-gray-800 truncate">{wo.customer_name || 'Unknown Customer'}</span>
        {wo.customer_phone && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
            <Phone className="h-3 w-3" />
            {wo.customer_phone}
          </span>
        )}
      </div>

      {/* Address */}
      {wo.customer_address && (
        <p className="text-xs text-gray-500 truncate mb-2">{wo.customer_address}</p>
      )}

      {/* Bottom row: priority + scheduled time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${priorityBadge.color}`}>
            {priorityBadge.label}
          </span>
          {wo.location_lat && wo.location_lng && (
            <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
              <MapPin className="h-3 w-3" />
              GPS
            </span>
          )}
        </div>
        {wo.scheduled_date && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            {formatSchedule(wo.scheduled_date, wo.scheduled_time_from)}
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </div>
    </button>
  )
}

function formatSchedule(date, timeFrom) {
  if (!date) return ''
  const d = new Date(date)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()

  const dateStr = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  if (timeFrom) {
    return `${dateStr} ${timeFrom.slice(0, 5)}`
  }
  return dateStr
}
