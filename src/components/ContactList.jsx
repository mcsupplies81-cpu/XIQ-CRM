import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function mapContact(contact) {
  return {
    ...contact,
    schools: {
      name: contact.school_name,
      city: contact.city,
      state: contact.state,
    },
  }
}

export default function ContactList() {
  const [contacts, setContacts] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    fetch('/api/contacts')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load contacts')
        }
        return response.json()
      })
      .then((data) => {
        if (isMounted) {
          setContacts(data.map(mapContact))
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError.message)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  if (isLoading) {
    return <section className="panel">Loading contacts...</section>
  }

  if (error) {
    return <section className="panel error-text">{error}</section>
  }

  return (
    <section className="panel">
      <div className="page-header">
        <div>
          <p className="eyebrow">Contacts</p>
          <h2>All contacts</h2>
        </div>
        <Link className="primary-button" to="/import">
          Import contacts
        </Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>School</th>
              <th>Role</th>
              <th>Email</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id}>
                <td>
                  <Link to={`/contacts/${contact.id}`}>{contact.name}</Link>
                </td>
                <td>
                  {contact.schools?.name || 'No school'}
                  <span className="muted-block">
                    {[contact.schools?.city, contact.schools?.state].filter(Boolean).join(', ')}
                  </span>
                </td>
                <td>{contact.role || '—'}</td>
                <td>{contact.email || '—'}</td>
                <td>
                  <span className="status-pill">{contact.status || 'New'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
