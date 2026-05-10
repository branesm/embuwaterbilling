import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { usePortalAuth } from './hooks/usePortalAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CustomerSearchPage from './pages/customers/CustomerSearchPage'
import CustomerDetailPage from './pages/customers/CustomerDetailPage'
import CustomerCreatePage from './pages/customers/CustomerCreatePage'
import CustomerStatementPage from './pages/customers/CustomerStatementPage'
import AccountTransferPage from './pages/customers/AccountTransferPage'
import MeterManagementPage from './pages/meters/MeterManagementPage'
import BillingPage from './pages/billing/BillingPage'
import PaymentsPage from './pages/payments/PaymentsPage'
import ReportsPage from './pages/reports/ReportsPage'
import AdminPage from './pages/admin/AdminPage'
import DebtPage from './pages/debt/DebtPage'
import DisconnectionsPage from './pages/disconnections/DisconnectionsPage'
import ComplaintsPage from './pages/complaints/ComplaintsPage'
import TariffsPage from './pages/tariffs/TariffsPage'
import ParametersPage from './pages/parameters/ParametersPage'
import NrwPage from './pages/nrw/NrwPage'
import ReadingsPage from './pages/readings/ReadingsPage'
import MpesaPage from './pages/mpesa/MpesaPage'
import SmsPage from './pages/sms/SmsPage'
import MainLayout from './components/layout/MainLayout'
import CustomerPortalLayout from './components/layout/CustomerPortalLayout'
import PortalLoginPage from './pages/portal/PortalLoginPage'
import PortalDashboardPage from './pages/portal/PortalDashboardPage'
import PortalBillsPage from './pages/portal/PortalBillsPage'
import PortalPaymentsPage from './pages/portal/PortalPaymentsPage'
import PortalProfilePage from './pages/portal/PortalProfilePage'
import WorkOrdersPage from './pages/workorders/WorkOrdersPage'
import TechniciansPage from './pages/workorders/TechniciansPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function PortalProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = usePortalAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/portal/login" />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomerSearchPage />} />
        <Route path="customers/new" element={<CustomerCreatePage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="customers/:id/statement" element={<CustomerStatementPage />} />
        <Route path="customers/:id/transfer" element={<AccountTransferPage />} />
        <Route path="meters" element={<MeterManagementPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="debt" element={<DebtPage />} />
        <Route path="disconnections" element={<DisconnectionsPage />} />
        <Route path="complaints" element={<ComplaintsPage />} />
        <Route path="tariffs" element={<TariffsPage />} />
        <Route path="parameters" element={<ParametersPage />} />
        <Route path="nrw" element={<NrwPage />} />
        <Route path="readings" element={<ReadingsPage />} />
        <Route path="mpesa" element={<MpesaPage />} />
        <Route path="sms" element={<SmsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="workorders" element={<WorkOrdersPage />} />
        <Route path="technicians" element={<TechniciansPage />} />
      </Route>

      {/* Customer Portal Routes */}
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route
        path="/portal"
        element={
          <PortalProtectedRoute>
            <CustomerPortalLayout />
          </PortalProtectedRoute>
        }
      >
        <Route path="dashboard" element={<PortalDashboardPage />} />
        <Route path="bills" element={<PortalBillsPage />} />
        <Route path="payments" element={<PortalPaymentsPage />} />
        <Route path="profile" element={<PortalProfilePage />} />
      </Route>
    </Routes>
  )
}

export default App
