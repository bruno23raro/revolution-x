import('dotenv').then(d => d.config({ path: '.env.local' }))
import('pg').then(pg => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  console.log('=== VERIFICAÇÃO SEED DEMO ===')
  return Promise.all([
    pool.query('SELECT count(*) c FROM organization'),
    pool.query("SELECT count(*) c FROM contact WHERE name='João Silva'"),
    pool.query('SELECT count(*) c FROM lead'),
    pool.query('SELECT count(*) c FROM deal'),
    pool.query('SELECT count(*) c FROM campaign'),
    pool.query('SELECT count(*) c FROM whatsapp_channels')
  ]).then(([o, j, l, d, c, ch]) => {
    console.log('Organization:', o.rows[0].c)
    console.log('Contato João:', j.rows[0].c)
    console.log('Leads:', l.rows[0].c)
    console.log('Deals:', d.rows[0].c)
    console.log('Campaigns:', c.rows[0].c)
    console.log('WA Channels:', ch.rows[0].c)
  }).finally(() => pool.end())
}).catch(e => console.error('Error:', e))