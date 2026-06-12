// Migration: add cell_phone + email_status to contacts
const { neon } = require('@neondatabase/serverless')

const sql = neon('postgresql://neondb_owner:npg_R6Je2tiBWwsL@ep-holy-silence-aqj7t929-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')

async function main() {
  console.log('Running migration: add cell_phone + email_status to contacts...\n')

  await sql`
    ALTER TABLE contacts
      ADD COLUMN IF NOT EXISTS cell_phone text,
      ADD COLUMN IF NOT EXISTS email_status text
        CHECK (email_status IN ('valid', 'accept_all', 'invalid', 'unknown'))
  `

  console.log('✓ cell_phone column added')
  console.log('✓ email_status column added')

  // Verify
  const cols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'contacts'
    ORDER BY ordinal_position
  `
  console.log('\nContacts columns:')
  cols.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`))
}

main().catch(e => { console.error(e); process.exit(1) })
