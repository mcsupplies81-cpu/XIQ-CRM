// Run once: creates outbound tables in Neon
const { sql } = require('../lib/db.cjs')

async function main() {
  console.log('Creating outbound tables...')

  await sql`
    CREATE TABLE IF NOT EXISTS outbound_sequences (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id    uuid REFERENCES contacts(id) ON DELETE CASCADE,
      campaign      text NOT NULL,
      step          int DEFAULT 0,
      status        text DEFAULT 'queued'
                    CHECK (status IN ('queued','active','replied','unsubscribed','bounced','completed','paused')),
      next_send_at  timestamptz,
      gmail_thread_id text,
      from_email    text,
      research      jsonb,
      created_at    timestamptz DEFAULT now(),
      updated_at    timestamptz DEFAULT now()
    )
  `
  console.log('  outbound_sequences created')

  await sql`
    CREATE TABLE IF NOT EXISTS outbound_emails (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sequence_id     uuid REFERENCES outbound_sequences(id) ON DELETE CASCADE,
      contact_id      uuid REFERENCES contacts(id) ON DELETE CASCADE,
      step            int NOT NULL,
      subject         text NOT NULL,
      body            text NOT NULL,
      from_email      text NOT NULL,
      gmail_message_id text,
      gmail_thread_id text,
      sent_at         timestamptz,
      bounced_at      timestamptz,
      bounce_reason   text,
      created_at      timestamptz DEFAULT now()
    )
  `
  console.log('  outbound_emails created')

  await sql`
    CREATE TABLE IF NOT EXISTS unsubscribes (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email           text UNIQUE NOT NULL,
      unsubscribed_at timestamptz DEFAULT now()
    )
  `
  console.log('  unsubscribes created')

  await sql`
    CREATE INDEX IF NOT EXISTS idx_outbound_sequences_contact_id ON outbound_sequences(contact_id)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_outbound_sequences_status ON outbound_sequences(status)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_outbound_sequences_next_send ON outbound_sequences(next_send_at) WHERE status = 'active'
  `

  console.log('\nDone. Outbound tables ready.')
}

main().catch(e => { console.error(e); process.exit(1) })
