export default async function handler(request, response) {
  if (request.method === 'POST') {
    const { contact_id, type, notes } = request.body || {};

    if (!contact_id || !type) {
      return response.status(400).json({ error: 'contact_id and type are required.' });
    }

    return response.status(201).json({
      activity: {
        contact_id,
        type,
        notes: notes || '',
      },
    });
  }

  if (request.method === 'GET') {
    return response.status(200).json({ activities: [] });
  }

  response.setHeader('Allow', ['GET', 'POST']);
  return response.status(405).json({ error: 'Method not allowed.' });
}
