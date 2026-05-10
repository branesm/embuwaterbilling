import { useEffect, useState } from 'react'
import { usePortalAuth } from '@/hooks/usePortalAuth'
import { portalApi } from '@/lib/portalApi'
import { User, MapPin, Phone, Mail, Droplets, Lock, Loader2, CheckCircle } from 'lucide-react'

export default function PortalProfilePage() {
  const { customer } = usePortalAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pinForm, setPinForm] = useState({ current_pin: '', new_pin: '', confirm_pin: '' })
  const [pinLoading, setPinLoading] = useState(false)
  const [pinMessage, setPinMessage] = useState('')
  const [pinError, setPinError] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const res = await portalApi.get('/profile')
      setProfile(res.data.data)
    } catch (error) {
      console.error('Load profile error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinMessage('')
    setPinError('')

    if (pinForm.new_pin.length < 4) {
      setPinError('New PIN must be at least 4 characters')
      return
    }
    if (pinForm.new_pin !== pinForm.confirm_pin) {
      setPinError('New PINs do not match')
      return
    }

    setPinLoading(true)
    try {
      const res = await portalApi.post('/change-pin', {
        current_pin: pinForm.current_pin,
        new_pin: pinForm.new_pin,
      })
      if (res.data.success) {
        setPinMessage('PIN changed successfully')
        setPinForm({ current_pin: '', new_pin: '', confirm_pin: '' })
      }
    } catch (err: any) {
      setPinError(err.response?.data?.message || 'Failed to change PIN')
    } finally {
      setPinLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `KES ${(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
        <p className="text-gray-500">View your account details and manage security</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="text-sm font-medium text-gray-900">{profile?.name || customer?.name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Droplets className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Account Number</p>
                <p className="text-sm font-medium text-gray-900">{profile?.account_no || customer?.account_no}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Phone Number</p>
                <p className="text-sm font-medium text-gray-900">{profile?.telephone || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Email Address</p>
                <p className="text-sm font-medium text-gray-900">{profile?.email || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="text-sm font-medium text-gray-900">
                  {[profile?.address, profile?.town].filter(Boolean).join(', ') || '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Current Balance</p>
                <p className={`text-xl font-bold ${(profile?.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(profile?.balance || 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Account Status</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                  profile?.account_status === 'active'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {profile?.account_status || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Change PIN */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Change PIN</h3>
          </div>

          {pinMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {pinMessage}
            </div>
          )}

          {pinError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {pinError}
            </div>
          )}

          <form onSubmit={handleChangePin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current PIN</label>
              <input
                type="password"
                value={pinForm.current_pin}
                onChange={(e) => setPinForm({ ...pinForm, current_pin: e.target.value })}
                placeholder="Enter current PIN"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New PIN</label>
              <input
                type="password"
                value={pinForm.new_pin}
                onChange={(e) => setPinForm({ ...pinForm, new_pin: e.target.value })}
                placeholder="Min 4 characters"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New PIN</label>
              <input
                type="password"
                value={pinForm.confirm_pin}
                onChange={(e) => setPinForm({ ...pinForm, confirm_pin: e.target.value })}
                placeholder="Re-enter new PIN"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={pinLoading}
              className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {pinLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {pinLoading ? 'Updating...' : 'Change PIN'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
