import { useClerk } from '@clerk/clerk-react'
import { NavLink } from 'react-router-dom'

const navSections = [
  {
    label: null,
    items: [
      { to: '/dashboard', label: 'Dashboard', indicator: 'bg-rose-400' },
      { to: '/schools', label: 'Schools', indicator: 'bg-emerald-400' },
      { to: '/contacts', label: 'Contacts', indicator: 'bg-blue-400' },
    ],
  },
  {
    label: 'Outreach',
    items: [
      { to: '/calls', label: 'Call Queue', indicator: 'bg-green-400' },
      { to: '/dms', label: 'DM Queue', indicator: 'bg-sky-400' },
      { to: '/playbook', label: 'Playbook', indicator: 'bg-lime-400' },
    ],
  },
  {
    label: 'Deals',
    items: [
      { to: '/deals', label: 'Deals', indicator: 'bg-violet-400' },
      { to: '/deals-pipeline', label: 'Deals Board', indicator: 'bg-orange-400' },
      { to: '/pipeline', label: 'Contact Board', indicator: 'bg-amber-400' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/templates', label: 'Templates', indicator: 'bg-teal-400' },
      { to: '/import', label: 'Import', indicator: 'bg-gray-400' },
    ],
  },
]

const mobileNavItems = navSections.slice(0, 2).flatMap((section) => section.items)

const activeClass =
  'bg-gray-100 text-gray-900 font-medium rounded px-3 py-2 text-sm flex items-center gap-2.5 transition-colors border-l-2 border-gray-900'
const inactiveClass =
  'text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded px-3 py-2 text-sm flex items-center gap-2.5 transition-colors border-l-2 border-transparent'

export default function Sidebar() {
  const { signOut } = useClerk()

  return (
    <aside className="fixed bottom-0 z-10 flex h-14 w-full flex-row items-center justify-between border-t border-gray-200 bg-white p-2 md:sticky md:top-0 md:h-screen md:w-48 md:flex-col md:items-stretch md:border-r md:border-t-0 md:p-4">
      <div className="flex min-w-0 flex-1 items-center gap-1 md:block">
        <div className="mb-6 hidden text-xl font-bold tracking-tight text-gray-900 md:block">XIQ</div>
        <nav className="flex min-w-0 flex-1 items-center justify-around gap-1 md:hidden">
          {mobileNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
              <span className={`h-2 w-2 rounded-sm ${item.indicator}`} />
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <nav className="hidden md:flex md:flex-col md:items-stretch md:justify-start md:gap-0.5">
          {navSections.map((section) => (
            <div key={section.label ?? 'main'}>
              {section.label !== null && (
                <>
                  <div className="my-2 border-t border-gray-100" />
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    {section.label}
                  </div>
                </>
              )}
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
                  <span className={`h-2 w-2 rounded-sm ${item.indicator}`} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </div>
      <div className="md:mt-auto md:border-t md:border-gray-100 md:pt-3">
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full rounded px-3 py-2 text-left text-sm text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
