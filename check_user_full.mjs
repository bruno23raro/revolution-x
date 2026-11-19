import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

const password = 'SenhaForte123!'

const res = await pool.query("SELECT id, email, password_hash, email_verified FROM public.users WHERE email = 'admin@revolutionx.dev'")
console.log('User:', JSON.stringify(res.rows[0], null, 2))

if (res.rows[0]) {
  const dbHash = res.rows[0].password_hash
  console.log('DB Hash:', dbHash)

  const valid = await bcrypt.compare(password, res.rows[0].password_hash)
  console.log('Compare result:', valid)

  // Test with a known hash
  const knownHash = '$2a$12$jFG21z1pKwCo9VWn2vh19eGJuz6FJprn8Eoz3LGhkXCORndOGLJpa'
  console.log('Old hash valid:', await bcrypt.compare(password, knownHash))

  // Generate new hash and test
  const newHash = await bcrypt.hash(password, 12)
  console.log('New hash:', newHash)
  console.log('New hash valid:', await bcrypt.compare(password, newHash))
}

await pool.end()