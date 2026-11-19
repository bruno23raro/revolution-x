import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

const password = 'SenhaForte123!'
const newHash = await bcrypt.hash(password, 12)
console.log('New hash:', newHash)

// Update the password hash in the database
const res = await pool.query("UPDATE public.users SET password_hash = $1 WHERE email = 'admin@revolutionx.dev' RETURNING id, password_hash", [newHash])
console.log('Updated rows:', res.rowCount)
console.log('Updated user:', res.rows)

await pool.end()