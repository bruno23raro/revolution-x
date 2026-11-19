import { Pool } from 'pg'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

const res = await pool.query("SELECT * FROM contacts WHERE organization_id = '032c8388-eb49-4613-8b07-38980fa3798f'")
console.log('Contacts:', JSON.stringify(res.rows, null, 2))

await pool.end()
