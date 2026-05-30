import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import ContactDetail from './ContactDetail';

const roles = ['HC', 'AD', 'OC'];
const assignees = ['Email', 'Calls', 'DMs'];
const statusClasses = {
  New: 'bg-gray-100 text-gray-700',
  Emailed: 'bg-blue-100 text-blue-700',
  Called: 'bg-amber-100 text-amber-700',
  Responded: 'bg-purple-100 text-purple-700',
  Closed: 'bg-green-100 text-green-700',
};

export default function ContactList() {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    setLoading(true);
    const { data } = await supabase
      .from('contacts')
      .select('*, schools(name, city, state, division, rank, maxpreps_url)')
      .order('created_at', { ascending: false });
    setContacts(data || []);
    setLoading(false);
  }

  function toggleValue(value, selected, setter) {
    setter(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  function handleContactUpdated(updated) {
    setContacts((current) => current.map((contact) => (contact.id === updated.id ? { ...contact, ...updated } : contact)));
    setSelectedContact((current) => (current?.id === updated.id ? { ...current, ...updated } : current));
  }

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const schoolName = contact.schools?.name || '';
      const matchesSearch = !query || contact.name.toLowerCase().includes(query) || schoolName.toLowerCase().includes(query);
      const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(contact.role);
      const matchesAssignee = selectedAssignees.length === 0 || selectedAssignees.includes(contact.assigned_to);
      return matchesSearch && matchesRole && matchesAssignee;
    });
  }, [contacts, search, selectedAssignees, selectedRoles]);

  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      <section className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
          <p className="mt-1 text-sm text-gray-600">Search, filter, and work your XIQ contact list.</p>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by contact or school"
          className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900"
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {roles.map((role) => (
            <FilterPill key={role} active={selectedRoles.includes(role)} onClick={() => toggleValue(role, selectedRoles, setSelectedRoles)}>
              {role}
            </FilterPill>
          ))}
          {assignees.map((assignee) => (
            <FilterPill key={assignee} active={selectedAssignees.includes(assignee)} onClick={() => toggleValue(assignee, selectedAssignees, setSelectedAssignees)}>
              {assignee}
            </FilterPill>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned to</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">Loading contacts...</td></tr>
              ) : filteredContacts.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No contacts found.</td></tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr key={contact.id} onClick={() => setSelectedContact(contact)} className="cursor-pointer">
                    <td className="px-4 py-3 font-medium text-gray-900">{contact.name}</td>
                    <td className="px-4 py-3 text-gray-700">{contact.schools?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{contact.role || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses[contact.status] || statusClasses.New}`}>{contact.status || 'New'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{contact.assigned_to || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedContact && (
        <ContactDetail contact={selectedContact} onContactUpdated={handleContactUpdated} onClose={() => setSelectedContact(null)} />
      )}
    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium ${active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'}`}
    >
      {children}
    </button>
  );
}
