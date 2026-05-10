import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard,
  Users,
  Gauge,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Droplets,
  ChevronRight,
  AlertTriangle,
  Unplug,
  MessageSquareWarning,
  Receipt,
  MapPin,
  ClipboardList,
  Activity,
  Smartphone,
  MessageSquare,
  Wrench,
  HardHat,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/customers', icon: Users, label: 'Customers' },
  { path: '/meters', icon: Gauge, label: 'Meters' },
  { path: '/readings', icon: ClipboardList, label: 'Readings' },
  { path: '/billing', icon: FileText, label: 'Billing' },
  { path: '/payments', icon: CreditCard, label: 'Payments' },
  { path: '/mpesa', icon: Smartphone, label: 'M-Pesa' },
  { path: '/sms', icon: MessageSquare, label: 'SMS' },
  { path: '/debt', icon: Receipt, label: 'Debt' },
  { path: '/disconnections', icon: Unplug, label: 'Disconnections' },
  { path: '/complaints', icon: MessageSquareWarning, label: 'Complaints' },
  { path: '/workorders', icon: Wrench, label: 'Work Orders' },
  { path: '/technicians', icon: HardHat, label: 'Technicians' },
  { path: '/tariffs', icon: Activity, label: 'Tariffs' },
  { path: '/nrw', icon: MapPin, label: 'NRW' },
  { path: '/reports', icon: BarChart3, label: 'Reports' },
  { path: '/parameters', icon: Settings, label: 'Parameters' },
  { path: '/admin', icon: AlertTriangle, label: 'Administration' },
]

export default function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Droplets className="w-8 h-8 text-sky-400" />
            <div>
              <h1 className="font-bold text-lg leading-tight">EWASCO</h1>
              <p className="text-xs text-slate-400">Water Billing System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center text-sm font-bold">
              {user?.first_name?.[0]}{user?.other_names?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.first_name} {user?.other_names}</p>
              <p className="text-xs text-slate-400 truncate">{user?.group_name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
