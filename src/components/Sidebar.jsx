import { useClerk } from '@clerk/clerk-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', indicator: 'bg-rose-400' },
  { to: '/schools', label: 'Schools', indicator: 'bg-emerald-400' },
  { to: '/contacts', label: 'Contacts', indicator: 'bg-blue-400' },
  { to: '/calls', label: 'Call Queue', indicator: 'bg-green-400' },
  { to: '/deals', label: 'Deals', indicator: 'bg-violet-400' },
  { to: '/deals-pipeline', label: 'Deals Board', indicator: 'bg-orange-400' },
  { to: '/pipeline', label: 'Pipeline', indicator: 'bg-amber-400' },
  { to: '/templates', label: 'Templates', indicator: 'bg-teal-400' },
  { to: '/dms', label: 'DM Queue', indicator: 'bg-sky-400' },
  { to: '/import', label: 'Import', indicator: 'bg-gray-400' },
]

const activeClass = 'bg-white/10 text-white font-medium rounded px-3 py-2 text-sm flex items-center gap-2.5 transition-colors'
const inactiveClass = 'text-white/60 hover:text-white hover:bg-white/5 rounded px-3 py-2 text-sm flex items-center gap-2.5 transition-colors'

export default function Sidebar() {
  const { signOut } = useClerk()

  return (
    <aside className="fixed bottom-0 z-10 flex h-14 w-full flex-row items-center justify-between bg-[#1a1a2e] p-2 text-white md:sticky md:top-0 md:h-screen md:w-56 md:flex-col md:items-stretch md:p-4">
      <div className="flex min-w-0 flex-1 items-center gap-1 md:block">
        <div className="mb-6 hidden text-xl font-bold text-white md:block">XIQ</div>
        <nav className="flex min-w-0 flex-1 items-center justify-around gap-1 md:flex-col md:items-stretch md:justify-start md:gap-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
              <span className={`h-2 w-2 rounded-sm ${item.indicator}`} />
              <span className="hidden sm:inline md:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <button
        type="button"
        onClick={() => signOut()}
        className="rounded px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white md:mt-auto"
      >
        Sign out
      </button>
      <div className="mt-2 hidden text-center text-xs text-white/20 md:block">⌘K to search</div>
    </aside>
  )
}
