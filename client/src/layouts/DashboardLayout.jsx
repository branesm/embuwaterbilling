import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  LayoutDashboard,
  Users,
  Gauge,
  ClipboardList,
  FileText,
  CreditCard,
  Settings,
  MapPin,
  Tag,
  BarChart3,
  UserCog,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Wrench,
  HardHat,
  Tool,
  Layers,
  Tablet,
  FileSignature,
  MessageSquare,
  AlertTriangle,
  PowerOff,
  Calculator,
  Calendar,
  Activity,
  ClipboardCheck,
  Repeat,
  BookOpen
} from 'lucide-react'

const DashboardLayout = () => {
  const { user, logout, hasRole } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/customers', icon: Users, label: 'Customers' },
    { path: '/contracts', icon: FileSignature, label: 'Contracts' },
    { path: '/contracts/change-tenancy', icon: Repeat, label: 'Change Tenancy' },
    { path: '/meters', icon: Gauge, label: 'Meters' },
    { path: '/meters?tab=inventory', icon: Gauge, label: 'Meter Inventory' },
    { path: '/meters?tab=movements', icon: Repeat, label: 'Meter Movements' },
    { path: '/meters?tab=servicing', icon: Tool, label: 'Meter Servicing' },
    { path: '/meters?tab=types', icon: Layers, label: 'Meter Types' },
    { path: '/meters?tab=master', icon: ClipboardList, label: 'Master Meters' },
    { path: '/readings', icon: ClipboardList, label: 'Readings' },
    { path: '/billing', icon: FileText, label: 'Billing' },
    { path: '/billing/simulation', icon: Calculator, label: 'Bill Simulation' },
    { path: '/payments', icon: CreditCard, label: 'Payments' },
    { path: '/payments/arrangements', icon: Calendar, label: 'Payment Plans' },
    ...(hasRole(['admin', 'manager', 'clerk']) ? [{ path: '/complaints', icon: MessageSquare, label: 'Complaints' }] : []),
    ...(hasRole(['admin', 'manager', 'clerk']) ? [{ path: '/disconnections', icon: PowerOff, label: 'Disconnections' }] : []),
    ...(hasRole(['admin', 'manager', 'clerk']) ? [{ path: '/workorders', icon: Wrench, label: 'Work Orders' }] : []),
    ...(hasRole(['admin', 'manager', 'clerk']) ? [{ path: '/anomalies', icon: Activity, label: 'Anomalies' }] : []),
    ...(hasRole(['admin', 'manager']) ? [{ path: '/reports', icon: BarChart3, label: 'Reports' }] : []),
    ...(hasRole(['admin', 'manager']) ? [{ path: '/reports?report=arrears-aging', icon: AlertTriangle, label: 'Debt Management' }] : []),
    ...(hasRole(['admin', 'manager']) ? [{ path: '/wasreb-reports', icon: AlertTriangle, label: 'WASREB' }] : []),
    ...(hasRole(['admin', 'manager']) ? [{ path: '/audit-logs', icon: ClipboardCheck, label: 'Audit Logs' }] : []),
    ...(hasRole('admin') ? [{ path: '/users', icon: UserCog, label: 'Users' }] : []),
  ]

  const operationsItems = [
    { path: '/reading-books', icon: BookOpen, label: 'Reading Books', highlight: true, badge: 'NEW' },
  ]

  const settingsItems = [
    { path: '/zones', icon: MapPin, label: 'Zones & Routes' },
    { path: '/tariffs', icon: Tag, label: 'Tariffs' },
    { path: '/settings', icon: Settings, label: 'System Settings', highlight: true, badge: 'NEW' },
  ]

  const [operationsOpen, setOperationsOpen] = useState(false)

  const isActive = (path) => {
    const [targetPath, queryString] = path.split('?')
    if (targetPath === '/') return location.pathname === '/'
    if (location.pathname !== targetPath) return false
    if (!queryString) return true
    return location.search.includes(queryString)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">EW</span>
              </div>
              <span className="font-bold text-lg text-gray-800">EWASCO</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive(item.path) 
                      ? 'bg-primary-50 text-primary-700 border-r-4 border-primary-600' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}

            {/* Operations submenu */}
            {hasRole(['admin', 'manager']) && (
              <div className="pt-2">
                <button
                  onClick={() => setOperationsOpen(!operationsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Wrench className="w-5 h-5" />
                    <span className="font-medium">Operations</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${operationsOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {operationsOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    {operationsItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`
                            flex items-center justify-between space-x-3 px-4 py-2 rounded-lg transition-colors text-sm
                            ${isActive(item.path) 
                              ? 'bg-primary-50 text-primary-700' 
                              : item.highlight ? 'text-primary-700 bg-primary-50/80 border border-primary-200 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }
                          `}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <span className="flex items-center space-x-3">
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </span>
                          {item.badge && (
                            <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold text-primary-800">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Settings submenu */}
            <div className="pt-2">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <Settings className="w-5 h-5" />
                  <span className="font-medium">Settings</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {settingsOpen && (
                <div className="ml-4 mt-1 space-y-1">
                  {settingsItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          flex items-center justify-between space-x-3 px-4 py-2 rounded-lg transition-colors text-sm
                          ${isActive(item.path) 
                            ? 'bg-primary-50 text-primary-700' 
                            : item.highlight ? 'text-primary-700 bg-primary-50/80 border border-primary-200 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }
                        `}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <span className="flex items-center space-x-3">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </span>
                        {item.badge && (
                          <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold text-primary-800">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* User info */}
          <div className="border-t p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">{user?.firstName} {user?.lastName}</p>
                <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-white shadow-sm px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <span className="font-bold text-lg text-gray-800">EWASCO</span>
          <div className="w-6" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
