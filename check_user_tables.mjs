import { Pool } from 'pg'
const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })
const res = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%user%' ORDER BY table_schema, table_name")
console.log(res.rows)
await pool.end()