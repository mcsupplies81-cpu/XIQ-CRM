import { useEffect, useMemo, useState } from 'react';

function ContactDetail({ contact, onClose, onContactUpdated }) {
  const [activities, setActivities] = useState([]);
  const [notes, setNotes] = useState(contact?.notes || '');
  const [originalNotes, setOriginalNotes] = useState(contact?.notes || '');
  const [status, setStatus] = useState(contact?.status || '');
  const [assignedTo, setAssignedTo] = useState(contact?.assigned_to || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNotes(contact?.notes || '');
    setOriginalNotes(contact?.notes || '');
    setStatus(contact?.status || '');
    setAssignedTo(contact?.assigned_to || '');
    setError('');
  }, [contact]);

  useEffect(() => {
    if (!contact?.id) {
      setActivities([]);
      return;
    }

    let isMounted = true;

    async function loadActivities() {
      try {
        const response = await fetch(`/api/activities?contact_id=${contact.id}`);

        if (!response.ok) {
          throw new Error('Unable to load activities.');
        }

        const data = await response.json();
        const nextActivities = Array.isArray(data) ? data : data.activities || [];

        if (isMounted) {
          setActivities(nextActivities);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
          setActivities([]);
        }
      }
    }

    loadActivities();

    return () => {
      isMounted = false;
    };
  }, [contact?.id]);

  const lastFiveActivities = useMemo(() => activities.slice(0, 5), [activities]);

  if (!contact) {
    return null;
  }

  async function patchContact(updates) {
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Unable to update contact.');
      }

      const data = await response.json();
      const updatedContact = data.contact || { ...contact, ...updates };
      onContactUpdated?.(updatedContact);
      return updatedContact;
    } catch (updateError) {
      setError(updateError.message);
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(event) {
    const nextStatus = event.target.value;
    setStatus(nextStatus);
    await patchContact({ status: nextStatus });
  }

  async function handleAssignedToChange(event) {
    const nextAssignedTo = event.target.value;
    setAssignedTo(nextAssignedTo);
    await patchContact({ assigned_to: nextAssignedTo });
  }

  async function handleNotesBlur() {
    if (notes === originalNotes) {
      return;
    }

    const updatedContact = await patchContact({ notes });

    if (updatedContact) {
      setOriginalNotes(updatedContact.notes || '');
    }
  }

  const xHandle = contact.x_handle || contact.twitter_handle || '';
  const normalizedXHandle = xHandle.replace(/^@/, '');

  return (
    <aside className="w-full border-t border-gray-200 bg-white p-6 lg:w-[420px] lg:border-l lg:border-t-0">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{contact.name}</h2>
          <p className="mt-1 text-sm text-gray-500">{contact.company || 'No company listed'}</p>
        </div>
        <button className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" onClick={onClose} type="button">
          Close
        </button>
      </div>

      {error ? <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="mb-6 grid grid-cols-3 gap-2">
        <a
          className="rounded-md bg-gray-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-gray-700"
          href={contact.phone ? `tel:${contact.phone}` : undefined}
        >
          Call
        </a>
        <a
          className="rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-500"
          href="https://app.instantly.ai"
          rel="noreferrer"
          target="_blank"
        >
          Email
        </a>
        <a
          className="rounded-md bg-black px-3 py-2 text-center text-sm font-medium text-white hover:bg-gray-800"
          href={normalizedXHandle ? `https://x.com/${normalizedXHandle}` : 'https://x.com'}
          rel="noreferrer"
          target="_blank"
        >
          DM
        </a>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Status</span>
          <select
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isSaving}
            onChange={handleStatusChange}
            value={status}
          >
            <option value="">Select status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Assigned to</span>
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isSaving}
            onChange={handleAssignedToChange}
            value={assignedTo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Notes</span>
          <textarea
            className="mt-1 min-h-32 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isSaving}
            onBlur={handleNotesBlur}
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Activity log</h3>
        <div className="mt-3 space-y-3">
          {lastFiveActivities.length ? (
            lastFiveActivities.map((activity) => (
              <div className="rounded-md border border-gray-200 p-3" key={activity.id || `${activity.type}-${activity.created_at}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">{activity.type}</p>
                  <time className="text-xs text-gray-500">{activity.created_at || activity.date || ''}</time>
                </div>
                {activity.notes ? <p className="mt-1 text-sm text-gray-600">{activity.notes}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No recent activities.</p>
          )}
        </div>
      </div>
    </aside>
  );
}

export default ContactDetail;
