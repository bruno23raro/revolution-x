require('dotenv').config({path:'.env.local'});
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});

console.log('=== VERIFICAÇÃO SEED DEMO ===');

Promise.all([
  p.query('SELECT count(*) c FROM organization').then(r=>({name:'Organization', count:r.rows[0].c})),
  p.query("SELECT count(*) c FROM contact WHERE name='João Silva'").then(r=>({name:'Contato João', count:r.rows[0].c})),
  p.query('SELECT count(*) c FROM lead').then(r=>({name:'Leads', count:r.rows[0].c})),
  p.query('SELECT count(*) c FROM deal').then(r=>({name:'Deals', count:r.rows[0].c})),
  p.query('SELECT count(*) c FROM campaign').then(r=>({name:'Campaigns', count:r.rows[0].c})),
  p.query('SELECT count(*) c FROM whatsapp_channels').then(r=>({name:'WA Channels', count:r.rows[0].c})),
  p.query('SELECT count(*) c FROM whatsapp_templates').then(r=>({name:'WA Templates', count:r.rows[0].c})),
  p.query("SELECT id, status FROM whatsapp_channels").then(r=>console.log('WA Channel status:', r.rows[0]))
]).then(results => {
  console.log('\n=== TOTALS ===');
  results.slice(0, -1).forEach(r => console.log(`${r.name}: ${r.count}`));
}).catch(e => console.error('Error:', e)).finally(() => p.end());