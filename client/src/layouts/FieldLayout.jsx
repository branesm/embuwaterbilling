import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Gauge, ClipboardList, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../pwa/useOnlineStatus'
import { useState, useEffect } from 'react'
import { countItems } from '../pwa/db'

const navItems = [
  { to: '/field', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/field/readings', icon: Gauge, label: 'Readings', end: false },
  { to: '/field/workorders', icon: ClipboardList, label: 'Work Orders', end: false },
  { to: '/field/sync', icon: RefreshCw, label: 'Sync', end: false },
]

export default function FieldLayout() {
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const readings = await countItems('pendingReadings')
        const workOrders = await countItems('pendingWorkOrderUpdates')
        const photos = await countItems('pendingPhotos')
        setPendingCount(readings + workOrders + photos)
      } catch {
        // IndexedDB not available yet (e.g. first load before upgrade)
        setPendingCount(0)
      }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
      >
        <span className="text-lg font-bold text-primary-700">EWASCO Field</span>
        <div className="flex items-center gap-3">
          {/* Sync status badge */}
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
              <RefreshCw className="h-3 w-3" />
              {pendingCount}
            </span>
          )}
          {/* Online/Offline indicator */}
          <span className="inline-flex items-center gap-1 text-sm">
            {isOnline ? (
              <>
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <Wifi className="h-4 w-4 text-green-600" />
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <WifiOff className="h-4 w-4 text-red-500" />
              </>
            )}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-14 pb-16 min-h-screen"
        style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))', paddingBottom: 'max(4rem, calc(4rem + env(safe-area-inset-bottom)))' }}
      >
        <div className="px-4 py-4">
          <Outlet />
        </div>
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-50 flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                isActive
                  ? 'text-primary-600 font-semibold'
                  : 'text-gray-500 hover:text-gray-700'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
