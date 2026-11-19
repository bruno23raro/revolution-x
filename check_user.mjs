import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

const res = await pool.query("SELECT id, email, password_hash, email_verified FROM public.users WHERE email = 'admin@revolutionx.dev'")
console.log('User:', res.rows)

const password = 'SenhaForte123!'
const hash = '$2a$12$XLOkmkF7H5rGcYdZ8Lx9Hu3j2tKJGvK9H5rGcYdZ8Lx9Hu3j2tKJGvK9'
const valid = await bcrypt.compare(password, hash)
console.log('Password valid:', valid)

await pool.end()