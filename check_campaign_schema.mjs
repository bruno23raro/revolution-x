import { Pool } from 'pg'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'campaigns' ORDER BY ordinal_position")
console.log('Campaign columns:', JSON.stringify(res.rows, null, 2))

await pool.end()
