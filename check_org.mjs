import { Pool } from 'pg'
const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })
const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' ORDER BY ordinal_position")
console.log('Organizations columns:', res.rows)
await pool.end()