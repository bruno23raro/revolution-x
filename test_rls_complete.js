const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 15432,
  user: 'revx_test',
  password: 'testpass',
  database: 'revolution_x_rls_test'
});

const orgA = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const orgB = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
const intA = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21';  // integration id for orgA
const intB = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';  // integration id for orgB
const miA = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31';  // meta_integration id for orgA
const miB = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32';  // meta_integration id for orgB

async function runTests() {
  let pass = 0;
  let fail = 0;

  function check(name, condition, details = '') {
    if (condition) {
      console.log('✅ PASS: ' + name + (details ? ' - ' + details : ''));
      pass++;
    } else {
      console.log('❌ FAIL: ' + name + (details ? ' - ' + details : ''));
      fail++;
    }
  }

  // ============================================================
  // TESTE 1: Org A não vê dados da Org B (SELECT)
  // ============================================================
  console.log('\n=== TESTE 1: Isolamento SELECT (Org A vê só Org A, Org B vê só Org B) ===');

  await pool.query("SET app.current_org = '" + orgA + "'");

  let r = await pool.query('SELECT * FROM "Contact"');
  check('Contact Org A vê 4', r.rows.length === 4);

  r = await pool.query('SELECT * FROM "meta_integrations"');
  check('meta_integrations Org A vê 1', r.rows.length === 1);

  r = await pool.query('SELECT * FROM "webhook_events"');
  check('webhook_events Org A vê 2', r.rows.length === 2);

  r = await pool.query('SELECT * FROM "integration_events"');
  check('integration_events Org A vê 3', r.rows.length === 3);

  r = await pool.query('SELECT * FROM "crm_contacts"');
  check('crm_contacts Org A vê 3', r.rows.length === 3);

  r = await pool.query('SELECT * FROM "inbound_messages"');
  check('inbound_messages Org A vê 3', r.rows.length === 3);

  r = await pool.query('SELECT * FROM "message_status"');
  check('message_status Org A vê 3', r.rows.length === 3);

  await pool.query("SET app.current_org = '" + orgB + "'");

  r = await pool.query('SELECT * FROM "Contact"');
  check('Contact Org B vê 1', r.rows.length === 1);

  r = await pool.query('SELECT * FROM "meta_integrations"');
  check('meta_integrations Org B vê 1', r.rows.length === 1);

  r = await pool.query('SELECT * FROM "webhook_events"');
  check('webhook_events Org B vê 1', r.rows.length === 1);

  r = await pool.query('SELECT * FROM "integration_events"');
  check('integration_events Org B vê 1', r.rows.length === 1);

  r = await pool.query('SELECT * FROM "crm_contacts"');
  check('crm_contacts Org B vê 1', r.rows.length === 1);

  r = await pool.query('SELECT * FROM "inbound_messages"');
  check('inbound_messages Org B vê 1', r.rows.length === 1);

  r = await pool.query('SELECT * FROM "message_status"');
  check('message_status Org B vê 1', r.rows.length === 1);

  // ============================================================
  // TESTE 2: Insert sem app.current_org -> falha (fail-closed)
  // ============================================================
  console.log('\n=== TESTE 2: Insert sem app.current_org (fail-closed) ===');

  const tablesToTest = [
    { name: 'Contact', sql: 'INSERT INTO "Contact" ("id", "organizationId", "name", "email") VALUES (gen_random_uuid(), $1, $2, $3)', params: [orgA, 'Test Fail', 'fail@test.com'] },
    { name: 'meta_integrations', sql: 'INSERT INTO meta_integrations (id, organization_id, provider, encrypted_access_token, status) VALUES (gen_random_uuid(), $1, $2, $3, $4)', params: [intA, 'whatsapp', 'token', 'PENDING'] },
    { name: 'webhook_events', sql: 'INSERT INTO webhook_events (meta_event_id, integration_id, event_type, payload_hash) VALUES ($1, $2, $3, $4)', params: ['test_fail', miA, 'test', 'hash'] },
    { name: 'integration_events', sql: 'INSERT INTO integration_events (integration_id, workspace_id, event_type) VALUES ($1, $2, $3)', params: [intA, orgA, 'test'] },
    { name: 'crm_contacts', sql: 'INSERT INTO crm_contacts (phone_number, name, organization_id, external_id) VALUES ($1, $2, $3, $4)', params: ['5511999999997', 'Test', orgA, 'ext_test_fail'] },
    { name: 'inbound_messages', sql: 'INSERT INTO inbound_messages (message_id, from_number, to_number, type, organization_id) VALUES ($1, $2, $3, $4, $5)', params: ['msg_fail', '5511999999997', '5511888880001', 'text', orgA] },
    { name: 'message_status', sql: 'INSERT INTO message_status (message_id, status, organization_id) VALUES ($1, $2, $3)', params: ['msg_fail', 'delivered', orgA] },
  ];

  for (const t of tablesToTest) {
    try {
      await pool.query('SET app.current_org = DEFAULT');
      await pool.query(t.sql, t.params);
      check(t.name + ' falha sem app.current_org', false, 'Inseriu quando deveria falhar');
    } catch(e) {
      check(t.name + ' falha sem app.current_org', true, e.message.split('\n')[0]);
    }
  }

  // ============================================================
  // TESTE 3: Insert com app.current_org -> funciona
  // ============================================================
  console.log('\n=== TESTE 3: Insert com app.current_org (deve funcionar) ===');

  for (const t of tablesToTest) {
    try {
      await pool.query("SET app.current_org = '" + orgA + "'");
      await pool.query(t.sql, t.params);
      check(t.name + ' funciona com app.current_org', true);
    } catch(e) {
      check(t.name + ' funciona com app.current_org', false, e.message.split('\n')[0]);
    }
  }

  // ============================================================
  // TESTE 4: webhook_events não permite integration_id NULL (fail-closed)
  // ============================================================
  console.log('\n=== TESTE 4: webhook_events integration_id NULL (fail-closed) ===');

  await pool.query("SET app.current_org = '" + orgA + "'");
  try {
    await pool.query('INSERT INTO webhook_events (meta_event_id, integration_id, event_type, payload_hash) VALUES ($1, $2, $3, $4)', ['test_null', null, 'test', 'hash']);
    check('webhook_events rejeita integration_id NULL', false, 'Inseriu quando deveria falhar');
  } catch(e) {
    check('webhook_events rejeita integration_id NULL', true, e.message.split('\n')[0]);
  }

  // ============================================================
  // TESTE 5: Cross-org access attempt (com WHERE clause)
  // ============================================================
  console.log('\n=== TESTE 5: Tentativa cross-org explícita (deve retornar 0) ===');

  await pool.query("SET app.current_org = '" + orgA + "'");

  r = await pool.query('SELECT * FROM "Contact" WHERE "organizationId" = $1', [orgB]);
  check('Contact cross-org Org A vê Org B = 0', r.rows.length === 0);

  r = await pool.query('SELECT * FROM "meta_integrations" WHERE organization_id = $1', [intB]);
  check('meta_integrations cross-org Org A vê Org B = 0', r.rows.length === 0);

  r = await pool.query('SELECT * FROM "webhook_events" WHERE integration_id = $1', [miB]);
  check('webhook_events cross-org Org A vê Org B = 0', r.rows.length === 0);

  r = await pool.query('SELECT * FROM "integration_events" WHERE workspace_id = $1', [orgB]);
  check('integration_events cross-org Org A vê Org B = 0', r.rows.length === 0);

  r = await pool.query('SELECT * FROM "crm_contacts" WHERE organization_id = $1', [orgB]);
  check('crm_contacts cross-org Org A vê Org B = 0', r.rows.length === 0);

  r = await pool.query('SELECT * FROM "inbound_messages" WHERE organization_id = $1', [orgB]);
  check('inbound_messages cross-org Org A vê Org B = 0', r.rows.length === 0);

  r = await pool.query('SELECT * FROM "message_status" WHERE organization_id = $1', [orgB]);
  check('message_status cross-org Org A vê Org B = 0', r.rows.length === 0);

  // ============================================================
  // TESTE 6: RLS habilitado em todas as tabelas
  // ============================================================
  console.log('\n=== TESTE 6: RLS habilitado em todas as tabelas ===');

  const adminPool = new Pool({
    host: 'localhost',
    port: 15432,
    user: 'revx',
    password: '64c4c9d6fb25234d4b075b2db2a10087',
    database: 'revolution_x_rls_test'
  });

  const tables = [
    'Contact', 'meta_integrations', 'webhook_events',
    'integration_events', 'crm_contacts',
    'inbound_messages', 'message_status'
  ];

  for (const table of tables) {
    const r = await adminPool.query('SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1', [table]);
    check(table + ' RLS enabled', r.rows[0]?.relrowsecurity === true);
    check(table + ' RLS forced', r.rows[0]?.relforcerowsecurity === true);
  }

  await adminPool.end();

  // ============================================================
  // RESUMO
  // ============================================================
  console.log('\n==========================================');
  console.log('RESUMO: ' + pass + ' PASS, ' + fail + ' FAIL');
  console.log('==========================================');

  if (fail > 0) {
    process.exit(1);
  }

  await pool.end();
}

runTests().catch(e => {console.error('ERRO GERAL:', e.message); pool.end(); process.exit(1);});