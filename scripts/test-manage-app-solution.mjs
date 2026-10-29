// test-manage-app-solution.mjs
// Testa endpoints do app para gate "manage_app_solution"
// App token funciona para: app info, permissions, subscriptions, roles
// Credenciais: .env.local do Revolution X
// Mandato: ZERO perguntas. Cole stdout cru.

import { config } from 'dotenv';
config({ path: '.env.local' });
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const META_APP_ID = process.env.META_APP_ID || '1112157761403064';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const ACCESS_TOKEN = `${META_APP_ID}|${META_APP_SECRET}`;

const RAW = path.join(os.homedir(), 'artifacts', 'RX_META_APP_REVIEW', '07_TESTS', 'raw');
try { await fs.mkdir(RAW, { recursive: true }); } catch {}
const DATA = new Date().toISOString().slice(0, 10).replace(/-/g, '');

async function callApi(endpoint, label) {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `https://graph.facebook.com/v26.0/${endpoint}${separator}access_token=${ACCESS_TOKEN}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
      return { label, ok: true, status: res.status, data: data };
    } else {
      return { label, ok: false, error: data.error?.message || 'Unknown', status: res.status };
    }
  } catch (e) {
    return { label, ok: false, error: e.message, status: 0 };
  }
}

async function main() {
  console.log('=== TESTES API - MANAGE APP SOLUTION ===');
  console.log('APP_ID:', APP_ID);
  console.log('');

  const RESULTS = {
    total: 0,
    successes: 0,
    errors: 0,
    results: [],
    startTime: new Date(),
  };

  // Endpoints que funcionam com app token
  const ENDPOINTS = [
    { endpoint: `${APP_ID}?fields=id,name,supports_implicit_sdk_logging`, label: 'app_info' },
    { endpoint: `${APP_ID}/permissions`, label: 'app_permissions' },
    { endpoint: `${APP_ID}/subscriptions`, label: 'app_subscriptions' },
    { endpoint: `${APP_ID}/roles`, label: 'app_roles' },
  ];

  for (const ep of ENDPOINTS) {
    RESULTS.total++;
    console.log(`[${RESULTS.total}/${ENDPOINTS.length}] ${ep.label}`);

    const result = await callApi(ep.endpoint, ep.label);
    RESULTS.results.push(result);

    if (result.ok) {
      RESULTS.successes++;
      console.log(`  OK (${result.status})`);
    } else {
      RESULTS.errors++;
      console.log(`  ERRO: ${result.error}`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  // Relatório final
  const endTime = new Date();
  const durationMs = ((endTime - RESULTS.startTime) / 1000).toFixed(1);
  const errorRate = RESULTS.total > 0 ? ((RESULTS.errors / RESULTS.total) * 100).toFixed(1) : '0';

  const report = {
    project: 'Revolution X - Manage App Solution',
    date: DATA,
    totalCalls: RESULTS.total,
    successes: RESULTS.successes,
    errors: RESULTS.errors,
    errorRate: errorRate + '%',
    durationSeconds: durationMs,
    results: RESULTS.results,
  };

  try {
    await fs.writeFile(path.join(RAW, `MANAGE_APP_SOLUTION_${DATA}.json`), JSON.stringify(report, null, 2));
  } catch {}

  console.log('');
  console.log('========================================');
  console.log('TOTAL:', RESULTS.total);
  console.log('OK:', RESULTS.successes);
  console.log('ERROS:', RESULTS.errors);
  console.log('TAXA ERRO:', errorRate + '%');
  console.log('ESTADO:', errorRate <= 15 ? 'APROVADO' : 'REVISAR');
  console.log('========================================');
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});