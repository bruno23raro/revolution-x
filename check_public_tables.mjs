import { Pool } from 'pg'
const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })
const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
console.log('Public tables:', res.rows.map(r => r.table_name).join(', '))
await pool.end()