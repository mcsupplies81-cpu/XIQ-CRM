import { useEffect, useState } from 'react';
import ContactDetail from './ContactDetail';

function ContactList() {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadContacts() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/contacts');

        if (!response.ok) {
          throw new Error('Unable to load contacts.');
        }

        const data = await response.json();
        const nextContacts = Array.isArray(data) ? data : data.contacts || [];

        if (isMounted) {
          setContacts(nextContacts);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadContacts();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleContactUpdated(updatedContact) {
    setContacts((currentContacts) =>
      currentContacts.map((contact) =>
        contact.id === updatedContact.id ? { ...contact, ...updatedContact } : contact,
      ),
    );
    setSelectedContact((currentContact) =>
      currentContact?.id === updatedContact.id ? { ...currentContact, ...updatedContact } : currentContact,
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <section className="min-w-0 flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
          <p className="mt-1 text-sm text-gray-500">Click a row to view and update contact details.</p>
        </div>

        {error ? <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan="4">
                    Loading contacts…
                  </td>
                </tr>
              ) : contacts.length ? (
                contacts.map((contact) => (
                  <tr
                    className={`cursor-pointer hover:bg-gray-50 ${
                      selectedContact?.id === contact.id ? 'bg-blue-50' : ''
                    }`}
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{contact.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.company || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.status || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.assigned_to || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan="4">
                    No contacts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedContact ? (
        <ContactDetail
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onContactUpdated={handleContactUpdated}
        />
      ) : null}
    </div>
  );
}

export default ContactList;
