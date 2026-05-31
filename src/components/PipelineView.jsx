import { useEffect, useMemo, useState } from 'react'

const STATUSES = ['New', 'Contacted', 'Qualified', 'Won', 'Lost']

function normalizeContact(contact) {
  return {
    ...contact,
    status: contact.status || 'New',
    schools: {
      name: contact.school_name,
      city: contact.city,
      state: contact.state,
    },
  }
}

export default function PipelineView() {
  const [contacts, setContacts] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    fetch('/api/contacts')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load pipeline')
        }
        return response.json()
      })
      .then((data) => {
        if (isMounted) {
          setContacts(data.map(normalizeContact))
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError.message)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const contactsByStatus = useMemo(() => {
    return STATUSES.reduce((groups, status) => {
      groups[status] = contacts.filter((contact) => contact.status === status)
      return groups
    }, {})
  }, [contacts])

  async function updateStatus(id, status) {
    const previousContacts = contacts
    setContacts((current) => current.map((contact) => (contact.id === id ? { ...contact, status } : contact)))
    setError('')

    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error('Unable to update pipeline status')
      }
    } catch (updateError) {
      setContacts(previousContacts)
      setError(updateError.message)
    }
  }

  return (
    <section className="panel">
      <div className="page-header">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h2>Deal stages</h2>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="pipeline-board">
        {STATUSES.map((status) => (
          <div
            className="pipeline-column"
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              updateStatus(event.dataTransfer.getData('contact/id'), status)
            }}
          >
            <h3>{status}</h3>
            {contactsByStatus[status].map((contact) => (
              <article
                className="pipeline-card"
                draggable
                key={contact.id}
                onDragStart={(event) => event.dataTransfer.setData('contact/id', contact.id)}
              >
                <strong>{contact.name}</strong>
                <span>{contact.schools?.name || 'No school'}</span>
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
