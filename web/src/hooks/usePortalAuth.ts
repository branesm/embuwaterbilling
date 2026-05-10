import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PortalCustomer {
  id: number
  account_no: string
  name: string
  first_name?: string
  last_name?: string
  email?: string
  telephone?: string
  address?: string
  town?: string
  balance: number
  account_status: string
}

interface PortalAuthState {
  customer: PortalCustomer | null
  token: string | null
  isAuthenticated: boolean
  setPortalAuth: (customer: PortalCustomer, token: string) => void
  logout: () => void
}

export const usePortalAuth = create<PortalAuthState>()(
  persist(
    (set) => ({
      customer: null,
      token: null,
      isAuthenticated: false,
      setPortalAuth: (customer, token) => {
        localStorage.setItem('ewasco_portal_token', token)
        set({ customer, token, isAuthenticated: true })
      },
      logout: () => {
        localStorage.removeItem('ewasco_portal_token')
        set({ customer: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'ewasco-portal-auth',
    }
  )
)
