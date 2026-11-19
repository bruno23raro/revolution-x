import { Pool } from 'pg'
import { randomUUID } from 'crypto'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

const orgId = '032c8388-eb49-4613-8b07-38980fa3798f'

// Get user ID
const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@revolutionx.dev'")
const userId = userRes.rows[0]?.id
console.log('User ID:', userId)

// Create a test campaign
const campaignId = randomUUID()
await pool.query(`
  INSERT INTO campaigns (id, organization_id, user_id, title, channel, status, message, variables, audience_json, created_at, updated_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
`, [campaignId, orgId, userId, 'Test Campaign', 'whatsapp_api', 'draft', '{"type":"template","name":"hello_world","language":"pt_BR","variables":[]}', '{}', '{"all":true}'])
console.log(`Created campaign: ${campaignId}`)

await pool.end()
