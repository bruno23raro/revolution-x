import { Pool } from 'pg'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

const res = await pool.query("SELECT * FROM organizations_addresses WHERE service = 'whatsapp' AND status = 'connected' ORDER BY created_at DESC LIMIT 10")
console.log('Connected addresses:', JSON.stringify(res.rows, null, 2))

await pool.end()
