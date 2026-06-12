import { sql } from './_db.js'

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export default async function handler(req, res) {
  const id = req.query?.id
  if (id) {
    try {
      await sql`
        UPDATE outbound_emails
        SET opened_at = COALESCE(opened_at, now()),
            open_count = open_count + 1
        WHERE id = ${id}
      `
    } catch {}
  }

  res.setHeader('Content-Type', 'image/gif')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.setHeader('Pragma', 'no-cache')
  res.status(200).end(PIXEL)
}
