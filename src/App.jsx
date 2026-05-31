import { useAuth } from '@clerk/clerk-react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import ContactDetail from './components/ContactDetail.jsx'
import ContactList from './components/ContactList.jsx'
import ImportPage from './components/ImportPage.jsx'
import LoginPage from './components/LoginPage.jsx'
import PipelineView from './components/PipelineView.jsx'
import Sidebar from './components/Sidebar.jsx'

function LoadingScreen() {
  return <div className="centered-page">Loading CRM...</div>
}

export default function App() {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()
  const isLoginRoute = location.pathname === '/login'

  if (!isLoaded) {
    return <LoadingScreen />
  }

  if (!isSignedIn) {
    return isLoginRoute ? <LoginPage /> : <Navigate to="/login" replace />
  }

  if (isLoginRoute) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ContactList />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/pipeline" element={<PipelineView />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
