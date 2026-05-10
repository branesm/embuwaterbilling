import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { usePortalAuth } from '@/hooks/usePortalAuth'
import { Droplets, LayoutDashboard, Receipt, CreditCard, User, LogOut } from 'lucide-react'

export default function CustomerPortalLayout() {
  const { customer, logout } = usePortalAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/portal/login')
  }

  const navItems = [
    { path: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/portal/bills', label: 'Bills', icon: Receipt },
    { path: '/portal/payments', label: 'Payments', icon: CreditCard },
    { path: '/portal/profile', label: 'Profile', icon: User },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <Droplets className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">EWASCO Portal</h1>
                <p className="text-xs text-gray-500">{customer?.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.path
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-white text-primary-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden md:inline">{item.label}</span>
                    </Link>
                  )
                })}
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden border-t border-gray-100">
          <div className="flex justify-around py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium ${
                    isActive ? 'text-primary-600' : 'text-gray-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
