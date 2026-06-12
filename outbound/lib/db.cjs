const { neon } = require('@neondatabase/serverless')

const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_R6Je2tiBWwsL@ep-holy-silence-aqj7t929-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')

module.exports = { sql }
