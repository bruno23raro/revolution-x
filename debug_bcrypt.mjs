import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

const password = 'SenhaForte123!'

// Get the hash from database
const res = await pool.query("SELECT password_hash FROM public.users WHERE email = 'admin@revolutionx.dev'")
const dbHash = res.rows[0]?.password_hash
console.log('DB Hash:', dbHash)

// Test compare
const valid = await bcrypt.compare(password, res.rows[0].password_hash)
console.log('Compare result:', valid)

// Generate a new hash and test
const newHash = await bcrypt.hash(password, 12)
console.log('New hash:', newHash)
const valid2 = await bcrypt.compare(password, newHash)
console.log('New hash valid:', valid2)

// Test with different password
const testHash = '$2a$12$jFG21z1pKwCo9VWn2vh19eGJuz6FJprn8Eoz3LGhkXCORndOGLJpa'
console.log('Old hash valid with "SenhaForte123!":', await bcrypt.compare(password, testHash))

// Test with a simple known password
const simpleHash = await bcrypt.hash('test123', 12)
console.log('Simple hash:', simpleHash)
console.log('Simple verify:', await bcrypt.compare('test123', simpleHash))

await pool.end()