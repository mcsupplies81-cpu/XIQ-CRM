import { NavLink } from 'react-router-dom';
import { supabase } from '../supabase';

const links = [
  { to: '/contacts', label: 'Contacts' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/import', label: 'Import' },
];

function navClass({ isActive }) {
  return `rounded-lg px-4 py-3 text-sm font-medium ${isActive ? 'bg-white text-[#1a1a2e]' : 'text-white'}`;
}

export default function Sidebar() {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <aside className="fixed bottom-0 left-0 z-10 flex h-16 w-full items-center justify-between bg-[#1a1a2e] px-3 text-white md:sticky md:top-0 md:h-screen md:w-64 md:flex-col md:items-stretch md:p-6">
      <div className="hidden text-2xl font-bold md:block">XIQ</div>
      <nav className="flex flex-1 items-center gap-2 md:mt-8 md:flex-col md:items-stretch">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className={navClass}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-lg border border-white px-3 py-2 text-sm font-medium text-white md:px-4 md:py-3"
      >
        Sign out
      </button>
    </aside>
  );
}
