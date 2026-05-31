import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

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

export default function ContactDetail() {
  const { id } = useParams()
  const [contact, setContact] = useState(null)
  const [activities, setActivities] = useState([])
  const [formState, setFormState] = useState({ status: '', assigned_to: '', notes: '' })
  const [activityState, setActivityState] = useState({ type: 'note', notes: '' })
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isMounted = true

    fetch('/api/contacts')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load contact')
        }
        return response.json()
      })
      .then((data) => {
        const found = data.map(mapContact).find((item) => String(item.id) === String(id))
        if (!found) {
          throw new Error('Contact not found')
        }
        if (isMounted) {
          setContact(found)
          setFormState({
            status: found.status || '',
            assigned_to: found.assigned_to || '',
            notes: found.notes || '',
          })
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError.message)
        }
      })

    fetch(`/api/activities?contact_id=${encodeURIComponent(id)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load activities')
        }
        return response.json()
      })
      .then((data) => {
        if (isMounted) {
          setActivities(data)
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
  }, [id])

  function updateFormField(event) {
    const { name, value } = event.target
    setFormState((current) => ({ ...current, [name]: value }))
  }

  function updateActivityField(event) {
    const { name, value } = event.target
    setActivityState((current) => ({ ...current, [name]: value }))
  }

  async function saveContact(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      })

      if (!response.ok) {
        throw new Error('Unable to update contact')
      }

      const updatedContact = await response.json()
      setContact((current) => ({ ...current, ...updatedContact }))
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function logActivity(event) {
    event.preventDefault()
    setError('')

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: id,
          type: activityState.type,
          notes: activityState.notes,
        }),
      })

      if (!response.ok) {
        throw new Error('Unable to log activity')
      }

      const activity = await response.json()
      setActivities((current) => [activity, ...current].slice(0, 5))
      setActivityState({ type: 'note', notes: '' })
    } catch (activityError) {
      setError(activityError.message)
    }
  }

  if (error && !contact) {
    return <section className="panel error-text">{error}</section>
  }

  if (!contact) {
    return <section className="panel">Loading contact...</section>
  }

  return (
    <section className="panel detail-grid">
      <div>
        <Link to="/">← Back to contacts</Link>
        <div className="page-header compact">
          <div>
            <p className="eyebrow">Contact</p>
            <h2>{contact.name}</h2>
            <p className="muted">
              {contact.role || 'No role'} at {contact.schools?.name || 'No school'}
            </p>
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <form className="stacked-form" onSubmit={saveContact}>
          <label>
            Status
            <input name="status" value={formState.status} onChange={updateFormField} />
          </label>
          <label>
            Assigned to
            <input name="assigned_to" value={formState.assigned_to} onChange={updateFormField} />
          </label>
          <label>
            Notes
            <textarea name="notes" value={formState.notes} onChange={updateFormField} rows="5" />
          </label>
          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save contact'}
          </button>
        </form>
      </div>

      <div>
        <h3>Recent activity</h3>
        <form className="stacked-form" onSubmit={logActivity}>
          <label>
            Type
            <input name="type" value={activityState.type} onChange={updateActivityField} required />
          </label>
          <label>
            Notes
            <textarea name="notes" value={activityState.notes} onChange={updateActivityField} rows="4" required />
          </label>
          <button className="secondary-button" type="submit">
            Log activity
          </button>
        </form>

        <ul className="activity-list">
          {activities.map((activity) => (
            <li key={activity.id}>
              <strong>{activity.type}</strong>
              <p>{activity.notes}</p>
              <span>{activity.created_at ? new Date(activity.created_at).toLocaleString() : ''}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
