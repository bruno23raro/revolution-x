import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

const password = 'SenhaForte123!'
const newHash = await bcrypt.hash(password, 12)
console.log('New hash:', newHash)

const dbHash = '$2a$12$jFG21z1pKwCo9VWn2vh19eGJuz6FJprn8Eoz3LGhkXCORndOGLJpa'
const valid = await bcrypt.compare(password, dbHash)
console.log('DB hash valid:', valid)

const valid2 = await bcrypt.compare(password, newHash)
console.log('New hash valid:', valid2)

// Update the password hash in the database
await pool.query("UPDATE public.users SET password_hash = $1 WHERE email = 'admin@revolutionx.dev'", [newHash])
console.log('Updated password hash in database')

await pool.end()