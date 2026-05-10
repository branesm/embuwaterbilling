import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Droplets, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

const LoginPage = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldMode, setFieldMode] = useState(() => localStorage.getItem('ewasco-field-mode') === 'true')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!username || !password) {
      toast.error('Please enter username and password')
      return
    }

    setLoading(true)
    try {
      const userData = await login(username, password)
      toast.success('Login successful!')

      // Determine redirect: field mode toggle or reader/technician role
      const isFieldUser = fieldMode || userData?.role === 'reader' || userData?.role === 'technician'
      if (isFieldUser) {
        localStorage.setItem('ewasco-field-mode', 'true')
      } else {
        localStorage.removeItem('ewasco-field-mode')
      }
      navigate(isFieldUser ? '/field' : '/')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Droplets className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">EWASCO</h1>
          <p className="text-gray-500 mt-1">Water Billing System</p>
        </div>

        {/* Visual indicator for field mode */}
        {fieldMode && <p className="text-center text-sm text-primary-600 font-medium mb-2">Field Technician Mode</p>}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="label">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="Enter your username"
              disabled={loading}
            />
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-10"
                placeholder="Enter your password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Sign In'
            )}
          </button>

          {/* Field Technician Mode Toggle */}
          <div className="flex items-center justify-center mt-4 space-x-2">
            <label className="text-sm text-gray-600">Field Technician Mode</label>
            <button
              type="button"
              onClick={() => setFieldMode(!fieldMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${fieldMode ? 'bg-primary-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${fieldMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </form>

        {/* Demo credentials */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <p className="font-medium mb-2">Demo Credentials:</p>
          <div className="space-y-1">
            <p><span className="font-mono">admin / admin123</span> - Administrator</p>
            <p><span className="font-mono">manager / admin123</span> - Manager</p>
            <p><span className="font-mono">clerk / admin123</span> - Clerk</p>
            <p><span className="font-mono">cashier / admin123</span> - Cashier</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
