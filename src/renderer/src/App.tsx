import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './state/auth'
import Login from './pages/Login'
import ConnectWorkspace from './pages/ConnectWorkspace'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Email from './pages/Email'
import Contacts from './pages/Contacts'
import ContactDetail from './pages/ContactDetail'
import FormLeads from './pages/FormLeads'
import NewInvoice from './pages/NewInvoice'
import Invoices from './pages/Invoices'
import InvoiceDetail from './pages/InvoiceDetail'
import NewEstimate from './pages/NewEstimate'
import EstimateDetail from './pages/EstimateDetail'
import Estimates from './pages/Estimates'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import Catalog from './pages/Catalog'
import Finances from './pages/Finances'
import ReviewRequests from './pages/ReviewRequests'
import Settings from './pages/Settings'

function AuthedApp(): React.JSX.Element {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-neutral-500">Loading…</div>
  }

  if (!user) {
    return <Login />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/email" element={<Email />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/form-leads" element={<FormLeads />} />
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route path="/contacts/:id/invoices/new" element={<NewInvoice />} />
        <Route path="/invoices/new" element={<NewInvoice />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/contacts/:id/estimates/new" element={<NewEstimate />} />
        <Route path="/estimates/new" element={<NewEstimate />} />
        <Route path="/estimates/:id" element={<EstimateDetail />} />
        <Route path="/estimates" element={<Estimates />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/finances" element={<Finances />} />
        <Route path="/review-requests" element={<ReviewRequests />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App(): React.JSX.Element {
  const [hasWorkspace, setHasWorkspace] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.workspace.hasConfig().then(setHasWorkspace)
  }, [])

  if (hasWorkspace === null) {
    return <div className="flex h-screen items-center justify-center text-neutral-500">Loading…</div>
  }

  if (!hasWorkspace) {
    return <ConnectWorkspace onConnected={() => setHasWorkspace(true)} />
  }

  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  )
}
