import { Pool } from 'pg'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

async function dropFk() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Drop the foreign key constraint from integrations to auth.users
    try {
      await client.query('ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_user_id_fkey')
      console.log('Dropped integrations_user_id_fkey')
    } catch (e) {
      console.log('Failed to drop FK:', e.message)
    }

    // Also check for other cross-schema FKs
    const fks = await client.query(`
      SELECT
        tc.table_schema,
        tc.table_name,
        tc.constraint_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.constraint_column_usage AS ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND ccu.table_schema = 'auth'
    `)

    for (const fk of fks.rows) {
      try {
        await client.query(`ALTER TABLE "${fk.table_name}" DROP CONSTRAINT "${fk.constraint_name}"`)
        console.log(`Dropped FK ${fk.constraint_name} from ${fk.table_name} to auth.${fk.foreign_table_name}`)
      } catch (e) {
        console.log(`Failed to drop FK ${fk.constraint_name}:`, e.message)
      }
    }

    await client.query('COMMIT')
    console.log('Done dropping cross-schema FKs')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Error:', e.message)
  } finally {
    await pool.end()
  }
}

dropFk()