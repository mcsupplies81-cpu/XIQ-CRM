import { useClerk } from '@clerk/clerk-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/contacts', label: 'Contacts' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/import', label: 'Import' },
]

const activeClass = 'bg-white text-[#1a1a2e] rounded-lg px-4 py-3 text-sm font-medium'
const inactiveClass = 'text-white rounded-lg px-4 py-3 text-sm font-medium'

export default function Sidebar() {
  const { signOut } = useClerk()

  return (
    <aside className="fixed bottom-0 z-10 flex h-16 w-full flex-row items-center justify-between bg-[#1a1a2e] px-3 text-white md:sticky md:top-0 md:h-screen md:w-64 md:flex-col md:items-stretch md:p-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-col md:items-stretch md:gap-8">
        <div className="hidden text-3xl font-bold tracking-tight md:block">XIQ</div>
        <nav className="flex min-w-0 flex-1 items-center justify-around gap-1 md:flex-col md:items-stretch md:justify-start md:gap-2">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <button
        type="button"
        onClick={() => signOut()}
        className="rounded-lg px-4 py-3 text-sm font-medium text-white md:mt-auto"
      >
        Sign out
      </button>
    </aside>
  )
}
