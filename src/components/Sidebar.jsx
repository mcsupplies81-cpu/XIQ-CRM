import { useClerk } from '@clerk/clerk-react'
import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  const { signOut } = useClerk()

  return (
    <aside className="sidebar">
      <div>
        <h1>XIQ CRM</h1>
        <nav className="nav-links">
          <NavLink to="/">Contacts</NavLink>
          <NavLink to="/pipeline">Pipeline</NavLink>
          <NavLink to="/import">Import</NavLink>
        </nav>
      </div>
      <button className="secondary-button" type="button" onClick={() => signOut()}>
        Sign out
      </button>
    </aside>
  )
}
