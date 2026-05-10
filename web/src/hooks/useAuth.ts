import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  username: string
  first_name: string
  other_names?: string
  email?: string
  group_id?: number
  group_name?: string
  permissions?: Record<string, string[]>
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        localStorage.setItem('ewasco_token', token)
        set({ user, token, isAuthenticated: true })
      },
      logout: () => {
        localStorage.removeItem('ewasco_token')
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'ewasco-auth',
    }
  )
)
