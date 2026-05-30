import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';

const statuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed'];
const assignees = ['Email', 'Calls', 'DMs'];
const activityIcons = { call: '☎', email: '✉', dm: '@' };

export default function ContactDetail({ contact, onContactUpdated, onClose }) {
  const [draft, setDraft] = useState(contact);
  const [activities, setActivities] = useState([]);
  const [lastAction, setLastAction] = useState('email');
  const school = draft.schools || {};

  useEffect(() => {
    setDraft(contact);
  }, [contact]);

  useEffect(() => {
    fetchActivities();
  }, [contact.id]);

  const xUrl = useMemo(() => {
    const handle = (draft.x_handle || '').replace(/^@/, '').trim();
    return handle ? `https://x.com/${handle}` : 'https://x.com';
  }, [draft.x_handle]);

  async function fetchActivities() {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setActivities(data || []);
  }

  async function updateContact(values) {
    const optimistic = { ...draft, ...values };
    setDraft(optimistic);
    onContactUpdated(optimistic);

    const { data, error } = await supabase.from('contacts').update(values).eq('id', draft.id).select('*').single();
    if (!error && data) {
      const merged = { ...optimistic, ...data, schools: draft.schools };
      setDraft(merged);
      onContactUpdated(merged);
    }
  }

  async function handleNotesBlur() {
    await updateContact({ notes: draft.notes || '' });
    await supabase.from('activities').insert({
      contact_id: draft.id,
      type: lastAction || 'email',
      notes: draft.notes || '',
    });
    fetchActivities();
  }

  return (
    <aside className="w-full border-t border-gray-200 bg-white p-6 lg:w-[420px] lg:border-l lg:border-t-0">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{draft.name}</h2>
          <p className="text-sm text-gray-600">{school.name || 'No school'}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700">
          Close
        </button>
      </div>

      <div className="space-y-4 text-sm">
        <Field label="Role" value={draft.role || '—'} />
        <Field label="Email" value={draft.email || '—'} />
        <Field label="Phone" value={draft.phone || '—'} />
        <Field label="X handle" value={draft.x_handle || '—'} />
        <Field label="School city" value={[school.city, school.state].filter(Boolean).join(', ') || '—'} />
        <Field label="Created" value={draft.created_at ? new Date(draft.created_at).toLocaleString() : '—'} />
        <Field label="Updated" value={draft.updated_at ? new Date(draft.updated_at).toLocaleString() : '—'} />

        <label className="block">
          <span className="mb-1 block font-medium text-gray-700">Status</span>
          <select
            value={draft.status || 'New'}
            onChange={(event) => updateContact({ status: event.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block font-medium text-gray-700">Assigned to</span>
          <select
            value={draft.assigned_to || ''}
            onChange={(event) => updateContact({ assigned_to: event.target.value || null })}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          >
            <option value="">Unassigned</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-3 gap-2">
          <a
            href={draft.phone ? `tel:${draft.phone}` : undefined}
            onClick={() => setLastAction('call')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-center font-medium text-gray-800"
          >
            Call
          </a>
          <button
            type="button"
            onClick={() => {
              setLastAction('email');
              window.open('https://app.instantly.ai', '_blank', 'noopener,noreferrer');
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 font-medium text-gray-800"
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => {
              setLastAction('dm');
              window.open(xUrl, '_blank', 'noopener,noreferrer');
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 font-medium text-gray-800"
          >
            DM
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block font-medium text-gray-700">Notes</span>
          <textarea
            value={draft.notes || ''}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            onBlur={handleNotesBlur}
            rows={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
      </div>

      <div className="mt-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Activity log</h3>
        <div className="space-y-3">
          {activities.length === 0 ? (
            <p className="text-sm text-gray-500">No activity yet.</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between gap-3 text-gray-700">
                  <span className="font-medium">{activityIcons[activity.type] || '•'} {activity.type}</span>
                  <span>{activity.created_at ? new Date(activity.created_at).toLocaleString() : ''}</span>
                </div>
                <p className="text-gray-600">{activity.notes || 'No notes'}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="font-medium text-gray-700">{label}</div>
      <div className="break-words text-gray-900">{value}</div>
    </div>
  );
}
