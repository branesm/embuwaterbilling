import { useState, useEffect, useCallback } from 'react'
import { Gauge, ClipboardList, Camera, RefreshCw, CheckCircle, XCircle, Trash2, HardDrive } from 'lucide-react'
import { getAllItems, countItems, clearStore } from '../../pwa/db'
import { syncAll } from '../../pwa/syncManager'
import { useOnlineStatus } from '../../pwa/useOnlineStatus'

const FieldSyncStatus = () => {
  const isOnline = useOnlineStatus()

  const [pendingReadings, setPendingReadings] = useState(0)
  const [pendingUpdates, setPendingUpdates] = useState(0)
  const [pendingPhotos, setPendingPhotos] = useState(0)
  const [syncHistory, setSyncHistory] = useState([])
  const [storageInfo, setStorageInfo] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null) // { type: 'success' | 'error', message: string }
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const refreshCounts = useCallback(async () => {
    try {
      const [r, u, p] = await Promise.all([
        countItems('pendingReadings'),
        countItems('pendingWorkOrderUpdates'),
        countItems('pendingPhotos'),
      ])
      setPendingReadings(r)
      setPendingUpdates(u)
      setPendingPhotos(p)
    } catch (err) {
      console.error('Failed to refresh counts:', err)
    }
  }, [])

  const refreshHistory = useCallback(async () => {
    try {
      const log = await getAllItems('syncLog')
      const sorted = [...log]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20)
      setSyncHistory(sorted)
    } catch (err) {
      console.error('Failed to load sync history:', err)
    }
  }, [])

  const refreshStorage = useCallback(async () => {
    try {
      const stores = ['pendingReadings', 'pendingWorkOrderUpdates', 'pendingPhotos', 'cachedWorkOrders', 'cachedRouteMeters', 'syncLog']
      const info = {}
      await Promise.all(
        stores.map(async store => {
          info[store] = await countItems(store)
        })
      )
      setStorageInfo(info)
    } catch (err) {
      console.error('Failed to load storage info:', err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    refreshCounts()
    refreshHistory()
    refreshStorage()
  }, [refreshCounts, refreshHistory, refreshStorage])

  const handleSync = async () => {
    if (!isOnline || syncing) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const results = await syncAll()
      setSyncResult({
        type: 'success',
        message: `Synced ${results.readings.synced} readings, ${results.workOrders.synced} work order updates, ${results.photos} photos`,
      })
    } catch (err) {
      setSyncResult({
        type: 'error',
        message: err.message || 'Sync failed. Please try again.',
      })
    } finally {
      setSyncing(false)
      refreshCounts()
      refreshHistory()
      refreshStorage()
    }
  }

  const handleClearLog = async () => {
    try {
      await clearStore('syncLog')
      setSyncHistory([])
      setShowClearConfirm(false)
      refreshStorage()
    } catch (err) {
      console.error('Failed to clear sync log:', err)
    }
  }

  const pendingItems = [
    { label: 'Pending Readings', count: pendingReadings, icon: Gauge, color: 'text-green-500' },
    { label: 'Pending Work Order Updates', count: pendingUpdates, icon: ClipboardList, color: 'text-blue-500' },
    { label: 'Pending Photos', count: pendingPhotos, icon: Camera, color: 'text-purple-500' },
  ]

  const storeLabels = {
    pendingReadings: 'Pending Readings',
    pendingWorkOrderUpdates: 'Work Order Updates',
    pendingPhotos: 'Photos',
    cachedWorkOrders: 'Cached Work Orders',
    cachedRouteMeters: 'Cached Route Meters',
    syncLog: 'Sync Log Entries',
  }

  return (
    <div className="space-y-5 pb-4">
      <h1 className="text-xl font-bold text-gray-900">Sync Status</h1>

      {/* Online/Offline Banner */}
      <div className={`rounded-lg p-3 text-sm font-medium ${isOnline ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
        {isOnline ? 'Online - Ready to sync' : 'Offline - Connect to network to sync'}
      </div>

      {/* Pending Items Summary */}
      <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-100">
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Pending Items</h2>
        </div>
        {pendingItems.map(item => (
          <div key={item.label} className="px-4 py-3 flex items-center gap-3">
            <item.icon className={`h-5 w-5 ${item.color}`} />
            <span className="text-sm text-gray-700 flex-1">{item.label}</span>
            {item.count > 0 ? (
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {item.count}
              </span>
            ) : (
              <span className="bg-gray-100 text-gray-400 text-xs font-medium px-2 py-0.5 rounded-full">
                0
              </span>
            )}
          </div>
        ))}
        <div className="px-4 py-3 flex items-center gap-3 bg-gray-50 rounded-b-lg">
          <span className="text-sm font-medium text-gray-600 flex-1">Total Pending</span>
          <span className={`text-sm font-bold ${pendingReadings + pendingUpdates + pendingPhotos > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {pendingReadings + pendingUpdates + pendingPhotos}
          </span>
        </div>
      </div>

      {/* Manual Sync Button */}
      <div className="space-y-2">
        <button
          onClick={handleSync}
          disabled={!isOnline || syncing}
          className={`w-full flex items-center justify-center gap-2 rounded-lg p-4 min-h-[56px] text-base font-medium transition-colors ${
            !isOnline
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : syncing
              ? 'bg-blue-400 text-white cursor-wait'
              : 'bg-blue-600 text-white active:bg-blue-700'
          }`}
        >
          <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>

        {/* Sync Result Toast */}
        {syncResult && (
          <div
            className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
              syncResult.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {syncResult.type === 'success' ? (
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            )}
            <span>{syncResult.message}</span>
          </div>
        )}
      </div>

      {/* Sync History Log */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Sync History</h2>
          {syncHistory.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-red-500 flex items-center gap-1 min-h-[44px]"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {syncHistory.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            No sync history yet
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {syncHistory.map((entry, idx) => (
              <div key={entry.id || idx} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  {entry.status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium text-gray-800">
                    {entry.status === 'success' ? 'Sync Successful' : 'Sync Failed'}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {entry.duration != null ? `${(entry.duration / 1000).toFixed(1)}s` : ''}
                  </span>
                </div>
                <div className="text-xs text-gray-500 ml-6">
                  {entry.timestamp
                    ? new Date(entry.timestamp).toLocaleString()
                    : 'Unknown time'}
                </div>
                {entry.status === 'success' && (
                  <div className="text-xs text-gray-400 ml-6 mt-0.5 flex gap-3 flex-wrap">
                    {entry.readings?.synced > 0 && <span>{entry.readings.synced} readings</span>}
                    {entry.workOrders?.synced > 0 && <span>{entry.workOrders.synced} WO updates</span>}
                    {entry.photos > 0 && <span>{entry.photos} photos</span>}
                    {entry.readings?.failed > 0 && <span className="text-red-400">{entry.readings.failed} readings failed</span>}
                    {entry.workOrders?.failed > 0 && <span className="text-red-400">{entry.workOrders.failed} WO failed</span>}
                  </div>
                )}
                {entry.status === 'error' && entry.error && (
                  <div className="text-xs text-red-400 ml-6 mt-0.5">{entry.error}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Storage Usage */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-4 py-3 flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Storage Usage</h2>
        </div>
        <div className="px-4 pb-3 space-y-2">
          {Object.entries(storageInfo).map(([store, count]) => (
            <div key={store} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{storeLabels[store] || store}</span>
              <span className="text-gray-900 font-medium">{count} items</span>
            </div>
          ))}
          {Object.keys(storageInfo).length === 0 && (
            <p className="text-sm text-gray-400">Loading storage info...</p>
          )}
        </div>
      </div>

      {/* Clear Log Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Clear Sync History?</h3>
            <p className="text-sm text-gray-600">
              This will permanently delete all sync log entries. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 min-h-[44px] text-sm font-medium text-gray-700 bg-gray-100 rounded-lg active:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleClearLog}
                className="flex-1 px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-red-600 rounded-lg active:bg-red-700"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FieldSyncStatus
