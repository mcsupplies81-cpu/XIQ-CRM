import { useAuth } from '@clerk/clerk-react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LoginPage from './components/LoginPage.jsx'
import Sidebar from './components/Sidebar.jsx'
import SchoolsView from './components/SchoolsView.jsx'
import ContactList from './components/ContactList.jsx'
import DealsView from './components/DealsView.jsx'
import PipelineView from './components/PipelineView.jsx'
import ImportPage from './components/ImportPage.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()

  if (!isLoaded) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">Loading XIQ...</div>
  }

  if (!isSignedIn && location.pathname !== '/login') {
    return <Navigate to="/login" replace />
  }

  if (isSignedIn && location.pathname === '/login') {
    return <Navigate to="/dashboard" replace />
  }

  if (!isSignedIn) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50 pb-14 md:pb-0">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/schools" element={<SchoolsView />} />
          <Route path="/contacts" element={<ContactList />} />
          <Route path="/deals" element={<DealsView />} />
          <Route path="/pipeline" element={<PipelineView />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}
