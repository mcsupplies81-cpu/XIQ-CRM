import { useAuth } from '@clerk/clerk-react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LoginPage from './components/LoginPage.jsx'
import Sidebar from './components/Sidebar.jsx'
import ContactList from './components/ContactList.jsx'
import PipelineView from './components/PipelineView.jsx'
import ImportPage from './components/ImportPage.jsx'

export default function App() {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()

  if (!isLoaded) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (!isSignedIn && location.pathname !== '/login') {
    return <Navigate to="/login" replace />
  }

  if (isSignedIn && location.pathname === '/login') {
    return <Navigate to="/contacts" replace />
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
    <div className="flex min-h-screen bg-white pb-16 md:pb-0">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <Routes>
          <Route path="/contacts" element={<ContactList />} />
          <Route path="/pipeline" element={<PipelineView />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="*" element={<Navigate to="/contacts" replace />} />
        </Routes>
      </main>
    </div>
  )
}
