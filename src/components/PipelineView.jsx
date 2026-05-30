import { useEffect, useMemo, useState } from 'react';
import { DndContext, closestCorners, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../supabase';

const statuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed'];
const statusClasses = {
  New: 'bg-gray-100 text-gray-700',
  Emailed: 'bg-blue-100 text-blue-700',
  Called: 'bg-amber-100 text-amber-700',
  Responded: 'bg-purple-100 text-purple-700',
  Closed: 'bg-green-100 text-green-700',
};

export default function PipelineView() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    setLoading(true);
    const { data } = await supabase
      .from('contacts')
      .select('*, schools(name)')
      .order('created_at', { ascending: false });
    setContacts(data || []);
    setLoading(false);
  }

  const grouped = useMemo(() => {
    return statuses.reduce((columns, status) => {
      columns[status] = contacts.filter((contact) => (contact.status || 'New') === status);
      return columns;
    }, {});
  }, [contacts]);

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;

    const contactId = active.id;
    const activeContact = contacts.find((contact) => contact.id === contactId);
    const targetStatus = statuses.includes(over.id)
      ? over.id
      : contacts.find((contact) => contact.id === over.id)?.status;

    if (!activeContact || !targetStatus || activeContact.status === targetStatus) return;

    setContacts((current) => current.map((contact) => (contact.id === contactId ? { ...contact, status: targetStatus } : contact)));
    const { error } = await supabase.from('contacts').update({ status: targetStatus }).eq('id', contactId);
    if (error) {
      setContacts((current) => current.map((contact) => (contact.id === contactId ? activeContact : contact)));
    }
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Pipeline</h1>
        <p className="mt-1 text-sm text-gray-600">Drag contacts between statuses to keep the sales board current.</p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 p-8 text-center text-gray-500">Loading pipeline...</div>
      ) : (
        <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="grid gap-4 lg:grid-cols-5">
            {statuses.map((status) => (
              <PipelineColumn key={status} status={status} contacts={grouped[status] || []} />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}

function PipelineColumn({ status, contacts }) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <section ref={setNodeRef} className="min-h-64 rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClasses[status]}`}>{status}</h2>
        <span className="text-sm text-gray-500">{contacts.length}</span>
      </div>
      <SortableContext items={contacts.map((contact) => contact.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {contacts.map((contact) => (
            <PipelineCard key={contact.id} contact={contact} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function PipelineCard({ contact }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: contact.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article ref={setNodeRef} style={style} {...attributes} {...listeners} className="rounded-lg border border-gray-200 bg-white p-3">
      <h3 className="font-medium text-gray-900">{contact.name}</h3>
      <p className="mt-1 text-sm text-gray-600">{contact.schools?.name || 'No school'}</p>
    </article>
  );
}
