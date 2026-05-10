import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import LoginPage from './pages/auth/LoginPage'
import DashboardLayout from './layouts/DashboardLayout'
import DashboardPage from './pages/dashboard/DashboardPage'
import CustomerListPage from './pages/customers/CustomerListPage'
import CustomerDetailPage from './pages/customers/CustomerDetailPage'
import CustomerFormPage from './pages/customers/CustomerFormPage'
import MeterListPage from './pages/meters/MeterListPage'
import ReadingEntryPage from './pages/readings/ReadingEntryPage'
import BillingPage from './pages/billing/BillingPage'
import PaymentPage from './pages/payments/PaymentPage'
import UserManagementPage from './pages/users/UserManagementPage'
import ZoneRoutePage from './pages/settings/ZoneRoutePage'
import TariffPage from './pages/settings/TariffPage'
import SettingsPage from './pages/settings/SettingsPage'
import ReadingBooksPage from './pages/readings/ReadingBooksPage'
import ReportPage from './pages/reports/ReportPage'
import WorkOrdersPage from './pages/workorders/WorkOrdersPage'
import ContractsPage from './pages/contracts/ContractsPage'
import ComplaintsPage from './pages/complaints/ComplaintsPage'
import WasrebReportsPage from './pages/reports/WasrebReportsPage'
import DisconnectionsPage from './pages/disconnections/DisconnectionsPage'
import BillSimulationPage from './pages/billing/BillSimulationPage'
import PaymentArrangementsPage from './pages/payments/PaymentArrangementsPage'
import AnomaliesPage from './pages/anomalies/AnomaliesPage'
import ChangeTenancyPage from './pages/contracts/ChangeTenancyPage'
import AuditLogsPage from './pages/audit/AuditLogsPage'
import FieldLayout from './layouts/FieldLayout'
import FieldDashboard from './pages/field/FieldDashboard'
import FieldReadings from './pages/field/FieldReadings'
import FieldReadingForm from './pages/field/FieldReadingForm'
import FieldWorkOrders from './pages/field/FieldWorkOrders'
import FieldWorkOrderDetail from './pages/field/FieldWorkOrderDetail'
import FieldSyncStatus from './pages/field/FieldSyncStatus'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={localStorage.getItem('ewasco-field-mode') ? '/field' : '/'} />} />
      <Route path="/" element={user ? <DashboardLayout /> : <Navigate to="/login" />}>
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomerListPage />} />
        <Route path="customers/new" element={<CustomerFormPage />} />
        <Route path="customers/:id/edit" element={<CustomerFormPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="meters" element={<MeterListPage />} />
        <Route path="readings" element={<ReadingEntryPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="payments" element={<PaymentPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="zones" element={<ZoneRoutePage />} />
        <Route path="tariffs" element={<TariffPage />} />
        <Route path="reading-books" element={<ReadingBooksPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="reports" element={<ReportPage />} />
        <Route path="wasreb-reports" element={<WasrebReportsPage />} />
        <Route path="workorders" element={<WorkOrdersPage />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="complaints" element={<ComplaintsPage />} />
        <Route path="disconnections" element={<DisconnectionsPage />} />
        <Route path="billing/simulation" element={<BillSimulationPage />} />
        <Route path="payments/arrangements" element={<PaymentArrangementsPage />} />
        <Route path="anomalies" element={<AnomaliesPage />} />
        <Route path="contracts/change-tenancy" element={<ChangeTenancyPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
      </Route>
      <Route path="/field" element={user ? <FieldLayout /> : <Navigate to="/login" />}>
        <Route index element={<FieldDashboard />} />
        <Route path="readings" element={<FieldReadings />} />
        <Route path="readings/new/:meterId" element={<FieldReadingForm />} />
        <Route path="workorders" element={<FieldWorkOrders />} />
        <Route path="workorders/:id" element={<FieldWorkOrderDetail />} />
        <Route path="sync" element={<FieldSyncStatus />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
