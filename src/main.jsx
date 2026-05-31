import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', fontFamily: 'monospace', color: '#b91c1c', background: '#fff' }}>
          <h2 style={{ marginBottom: '12px' }}>App crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{String(this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

if (!key) {
  const root = document.getElementById('root')
  root.innerHTML = '<div style="padding:40px;font-family:monospace;color:#b91c1c">' +
    '<h2>Missing VITE_CLERK_PUBLISHABLE_KEY</h2>' +
    '<p style="margin-top:12px;font-size:13px">Set this environment variable in Vercel → Project Settings → Environment Variables, then redeploy.</p>' +
    '</div>'
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ClerkProvider publishableKey={key}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ClerkProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  )
}
