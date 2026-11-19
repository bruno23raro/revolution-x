import { Pool } from 'pg'
const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })
const res = await pool.query("SELECT * FROM auth.users WHERE email = 'admin@revolutionx.dev'")
console.log('User:', res.rows)
await pool.end()