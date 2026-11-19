import { Pool } from 'pg'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

const orgId = '032c8388-eb49-4613-8b07-38980fa3798f'

// Update channel to CONNECTED with test phone number
await pool.query(`
  UPDATE whatsapp_channels 
  SET status = 'CONNECTED',
      phone_number_id = '5511999999999',
      phone_number = '+5511999999999',
      verified_name = 'Test Business',
      waba_id = 'test_waba_id',
      access_token_enc = '',
      updated_at = NOW()
  WHERE organization_id = $1
`, [orgId])

console.log('Channel updated to CONNECTED')

const res = await pool.query("SELECT * FROM whatsapp_channels WHERE organization_id = $1", [orgId])
console.log('Channel:', JSON.stringify(res.rows, null, 2))

await pool.end()
