import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

const email = 'admin@revolutionx.dev'
const password = 'SenhaForte123!'
const hash = await bcrypt.hash(password, 12)

const userId = '0220ce4b-4a3f-476d-b97b-8eff05f01e7b'
const orgId = '42111a01-834a-41a2-8181-f4cddc36d1f2'

try {
  // Create admin in auth.users
  const authUser = await pool.query(`
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud)
    VALUES ($1, $2, $3, NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET encrypted_password = $3
    RETURNING id
  `, [userId, email, hash])
  console.log('Auth user:', authUser.rows[0]?.id || 'updated')

  // Create organization
  const org = await pool.query(`
    INSERT INTO public.organizations (id, name, slug, active, owner_id, org_id, created_at, updated_at)
    VALUES ($1, 'Revolution X', 'revolutionx', true, $2, $3, NOW(), NOW())
    ON CONFLICT (slug) DO UPDATE SET name = 'Revolution X'
    RETURNING id
  `, [orgId, userId, orgId])
  console.log('Organization:', org.rows[0]?.id || 'updated')

  // Create user in public.users
  const user = await pool.query(`
    INSERT INTO public.users (id, email, name, password_hash, email_verified, created_at, updated_at)
    VALUES ($1, $2, 'Admin', $3, true, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET password_hash = $3, name = 'Admin', email_verified = true
    RETURNING id
  `, [userId, email, hash])
  console.log('Public user:', user.rows[0]?.id || 'updated')

  // Create organization member
  const member = await pool.query(`
    INSERT INTO public.organization_members (id, organization_id, user_id, role, joined_at)
    VALUES (gen_random_uuid(), $1, $2, 'owner', NOW())
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner'
    RETURNING id
  `, [orgId, userId])
  console.log('Member:', member.rows[0]?.id || 'updated')

  console.log('✅ Admin criado com sucesso!')
} catch (e) {
  console.error('❌ Erro:', e.message)
} finally {
  await pool.end()
}