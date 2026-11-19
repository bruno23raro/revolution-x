import { Pool } from 'pg'
import { randomUUID } from 'crypto'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

const orgId = '032c8388-eb49-4613-8b07-38980fa3798f'

// Create test contacts
const contacts = [
  { id: randomUUID(), name: 'João Silva', phone: '5511999999999', waId: '5511999999999', email: 'joao@test.com', consentMarketing: true, optOut: false, consentSource: 'web', source: 'web', tags: '[]', customFields: '{}', preferences: '{}' },
  { id: randomUUID(), name: 'Maria Santos', phone: '5511888888888', waId: '5511888888888', email: 'maria@test.com', consentMarketing: true, optOut: false, consentSource: 'web', source: 'web', tags: '[]', customFields: '{}', preferences: '{}' },
  { id: randomUUID(), name: 'Pedro Costa', phone: '5511777777777', waId: '5511777777777', email: 'pedro@test.com', consentMarketing: true, optOut: false, consentSource: 'web', source: 'web', tags: '[]', customFields: '{}', preferences: '{}' },
]

for (const c of contacts) {
  await pool.query(`
    INSERT INTO contacts (id, organization_id, name, first_name, last_name, email, phone, wa_id, company, source, tags, custom_fields, preferences, consent_marketing, consent_source, opt_out, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `, [c.id, orgId, c.name, c.name.split(' ')[0], c.name.split(' ')[1], c.email, c.phone, c.waId, null, c.source, c.tags, c.customFields, c.preferences, c.consentMarketing, c.consentSource, c.optOut])
  console.log(`Created contact: ${c.name} (${c.id})`)
}

// Get user ID
const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@revolutionx.dev'")
const userId = userRes.rows[0]?.id
console.log('User ID:', userId)

// Create a test campaign
const campaignId = randomUUID()
await pool.query(`
  INSERT INTO campaigns (id, organization_id, user_id, name, channel, status, message, variables, audience_json, created_at, updated_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
`, [campaignId, orgId, userId, 'Test Campaign', 'whatsapp_api', 'draft', '{"type":"template","name":"hello_world","language":"pt_BR","variables":[]}', '{}', '{"all":true}'])
console.log(`Created campaign: ${campaignId}`)

await pool.end()
