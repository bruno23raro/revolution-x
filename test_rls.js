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

async function runTests() {
  // ============================================================
  // TESTE 1: Org A não vê dados da Org B (SELECT)
  // ============================================================
  console.log('=== TESTE 1: Isolamento SELECT ===');

  await pool.query("SET app.current_org = '" + orgA + "'");
  const tables = [
    'Contact',
    'meta_integrations',
    'webhook_events',
    'integration_events',
    'crm_contacts',
    'inbound_messages',
    'message_status'
  ];

  for (const table of tables) {
    const r = await pool.query('SELECT * FROM "' + table + '"');
    console.log('  ' + table + ' (Org A): ' + r.rows.length + ' linhas');
  }

  await pool.query("SET app.current_org = '" + orgB + "'");
  for (const table of tables) {
    const r = await pool.query('SELECT * FROM "' + table + '"');
    console.log('  ' + table + ' (Org B): ' + r.rows.length + ' linhas');
  }

  // ============================================================
  // TESTE 2: Insert sem app.current_org -> falha (fail-closed)
  // ============================================================
  console.log('\n=== TESTE 2: Insert sem app.current_org (fail-closed) ===');

  try {
    await pool.query('SET app.current_org = DEFAULT');
    await pool.query('INSERT INTO "Contact" ("id", "organizationId", "name", "email") VALUES (gen_random_uuid(), $1, $2, $3)', [orgA, 'Test Fail', 'fail@test.com']);
    console.log('  Contact: FALHOU - inseriu!');
  } catch(e) {
    console.log('  Contact: SUCESSO - erro: ' + e.message.split('\n')[0]);
  }

  // ============================================================
  // TESTE 3: Insert com app.current_org -> funciona
  // ============================================================
  console.log('\n=== TESTE 3: Insert com app.current_org (deve funcionar) ===');

  await pool.query("SET app.current_org = '" + orgA + "'");
  try {
    await pool.query('INSERT INTO "Contact" ("id", "organizationId", "name", "email") VALUES (gen_random_uuid(), $1, $2, $3)', [orgA, 'Test OK', 'ok@test.com']);
    console.log('  Contact: SUCESSO - inseriu');
  } catch(e) {
    console.log('  Contact: FALHOU - erro: ' + e.message.split('\n')[0]);
  }

  // ============================================================
  // TESTE 4: webhook_events não permite integration_id NULL (fail-closed)
  // ============================================================
  console.log('\n=== TESTE 4: webhook_events integration_id NULL ===');

  await pool.query("SET app.current_org = '" + orgA + "'");
  try {
    await pool.query('INSERT INTO webhook_events (meta_event_id, integration_id, event_type, payload_hash) VALUES ($1, $2, $3, $4)', ['test_null', null, 'test', 'hash']);
    console.log('  webhook_events com NULL: FALHOU - inseriu!');
  } catch(e) {
    console.log('  webhook_events com NULL: SUCESSO - erro: ' + e.message.split('\n')[0]);
  }

  // ============================================================
  // TESTE 5: Cross-org access attempt
  // ============================================================
  console.log('\n=== TESTE 5: Tentativa cross-org (deve retornar 0) ===');

  await pool.query("SET app.current_org = '" + orgA + "'");
  for (const table of tables) {
    try {
      let r;
      if (table === 'meta_integrations' || table === 'webhook_events') {
        r = await pool.query('SELECT * FROM "' + table + '"');
      } else if (table === 'integration_events') {
        r = await pool.query('SELECT * FROM "' + table + '" WHERE workspace_id = $1', [orgB]);
      } else if (table === 'Contact') {
        r = await pool.query('SELECT * FROM "' + table + '" WHERE "organizationId" = $1', [orgB]);
      } else {
        r = await pool.query('SELECT * FROM "' + table + '" WHERE organization_id = $1', [orgB]);
      }
      console.log('  ' + table + ' (Org A tentando ver Org B): ' + r.rows.length + ' linhas');
    } catch(e) {
      console.log('  ' + table + ' (Org A tentando ver Org B): ERRO - ' + e.message.split('\n')[0]);
    }
  }

  // ============================================================
  // TESTE 6: Teste outras tabelas com insert sem app.current_org
  // ============================================================
  console.log('\n=== TESTE 6: Outras tabelas - Insert sem app.current_org ===');

  const testTables = [
    { table: 'meta_integrations', sql: 'INSERT INTO meta_integrations (id, organization_id, provider, encrypted_access_token, status) VALUES (gen_random_uuid(), $1, $2, $3, $4)', params: [orgA, 'whatsapp', 'token', 'PENDING'] },
    { table: 'webhook_events', sql: 'INSERT INTO webhook_events (meta_event_id, integration_id, event_type, payload_hash) VALUES ($1, $2, $3, $4)', params: ['test2', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', 'test', 'hash'] },
    { table: 'integration_events', sql: 'INSERT INTO integration_events (integration_id, workspace_id, event_type) VALUES ($1, $2, $3)', params: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', orgA, 'test'] },
    { table: 'crm_contacts', sql: 'INSERT INTO crm_contacts (phone_number, name, organization_id, external_id) VALUES ($1, $2, $3, $4)', params: ['5511999999998', 'Test', orgA, 'ext_test'] },
    { table: 'inbound_messages', sql: 'INSERT INTO inbound_messages (message_id, from_number, to_number, type, organization_id) VALUES ($1, $2, $3, $4, $5)', params: ['msg_test2', '5511999999998', '5511888880001', 'text', orgA] },
    { table: 'message_status', sql: 'INSERT INTO message_status (message_id, status, organization_id) VALUES ($1, $2, $3)', params: ['msg_test2', 'delivered', orgA] },
  ];

  for (const t of testTables) {
    try {
      await pool.query('SET app.current_org = DEFAULT');
      await pool.query(t.sql, t.params);
      console.log('  ' + t.table + ': FALHOU - inseriu!');
    } catch(e) {
      console.log('  ' + t.table + ': SUCESSO - erro');
    }
  }

  // ============================================================
  // TESTE 7: Teste outras tabelas com insert com app.current_org
  // ============================================================
  console.log('\n=== TESTE 7: Outras tabelas - Insert com app.current_org ===');

  for (const t of testTables) {
    try {
      await pool.query("SET app.current_org = '" + orgA + "'");
      await pool.query(t.sql, t.params);
      console.log('  ' + t.table + ': SUCESSO - inseriu');
    } catch(e) {
      console.log('  ' + t.table + ': FALHOU - erro: ' + e.message.split('\n')[0]);
    }
  }

  await pool.end();
}

runTests().catch(e => {console.error('ERRO GERAL:', e.message); pool.end();});