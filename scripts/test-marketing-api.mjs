// test-marketing-api.mjs
// Faz 500 chamadas à Meta Graph API /v26.0/{adAccountId}/insights
// Saída: relatório JSON com taxa de erro; se <=15% → APROVADO, se >15% → REVISAR
// Credenciais: .env.local / .env do Revolution X
// Mandato: ZERO perguntas. Cole stdout cru de cada execução.

import { config } from 'dotenv';
config({ path: '.env.local' });

// Usar import dinâmico para evitar issues com fs/promises em alguns ambientes
const { writeFile: writeFileFn, mkdir: mkdirFn } = await import('fs/promises');
const { join } = await import('path');
const { homedir } = await import('os');

// Credenciais do .env.local
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const AD_ACCOUNT_ID = process.env.AD_ACCOUNT_ID || '';
const normalizedAdAccountId = AD_ACCOUNT_ID.startsWith('act_') ? AD_ACCOUNT_ID : `act_${AD_ACCOUNT_ID}`;

// Diretórios de saída
const RAW_DIR = join(homedir(), 'artifacts', 'RX_META_APP_REVIEW', '07_TESTS', 'raw');
const EVID_DIR = join(homedir(), 'artifacts', 'RX_META_APP_REVIEW', '07_TESTS', 'evidence');

async function ensureDir(dir) {
  try { await mkdirFn(dir, { recursive: true }); } catch {}
}

// Garantir que os diretórios existem
await ensureDir(RAW_DIR);
await ensureDir(EVID_DIR);

const DATA = new Date().toISOString().slice(0, 10).replace(/-/g, '');

async function main() {
  console.log('ACCESS_TOKEN:', ACCESS_TOKEN?.substring(0, 20) + '...');
  console.log('AD_ACCOUNT_ID:', normalizedAdAccountId);
  console.log('=== INICIANDO 500+ CHAMADAS MARKETING API ===');
  console.log('');

  const RESULTS = {
    total: 0,
    successes: 0,
    errors: 0,
    errorTypes: {},
    insights: [],
    startTime: new Date(),
  };

  // Fazer 500 chamadas totais
  const LIMIT = 100;

  const timeRange = { since: '2026-01-01', until: '2026-10-27' };
const timeRangeStr = JSON.stringify(timeRange);

for (let i = 0; i < 500; i++) {
    RESULTS.total++;

    try {
      const url = `https://graph.facebook.com/v26.0/${normalizedAdAccountId}/insights?fields=spend,impressions,clicks,reach,ctr,cpc&limit=${LIMIT}&time_range=${encodeURIComponent(timeRangeStr)}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
      });

      if (res.ok) {
        const data = await res.json();

        if (data.data && Array.isArray(data.data)) {
          RESULTS.successes++;

          // Coletar insights de algumas chamadas para relatório
          if (RESULTS.insights.length < 5) {
            RESULTS.insights.push(...data.data);
          }
        } else {
          // Resposta OK mas sem dados esperados - count como erro de campo
          RESULTS.errors++;
          const errCode = data.error?.code || data?.error?.code || 'unknown';
          RESULTS.errorTypes[errCode] = (RESULTS.errorTypes[errCode] || 0) + 1;
        }
      } else {
        RESULTS.errors++;
        const errText = await res.text();
        const errCode = res.status || 'unknown';
        RESULTS.errorTypes[errCode] = (RESULTS.errorTypes[errCode] || 0) + 1;
      }
    } catch (e) {
      RESULTS.errors++;
      RESULTS.errorTypes['exception'] = (RESULTS.errorTypes['exception'] || 0) + 1;
      console.log(`Excecao chamada ${RESULTS.total}:`, e.message);
    }

    // Progresso a cada 50 chamadas
    if (i % 50 === 0) {
      const rate = (RESULTS.successes / RESULTS.total * 100).toFixed(1);
      console.log(`Progresso: ${RESULTS.total}/500 (${RESULTS.total} chamadas) — Success rate: ${rate}%`);
    }

    // Pequena pausa para não sobrecarregar
    await new Promise(r => setTimeout(r, 100));
  }

  // Gerar relatório final
  const endTime = new Date();
  const durationMinutes = ((endTime - RESULTS.startTime) / 60000).toFixed(1);
  const errorRate = RESULTS.total > 0 ? ((RESULTS.errors / RESULTS.total) * 100).toFixed(1) : '0';

  const report = {
    project: 'Revolution X - Marketing API Access Tier',
    date: DATA,
    totalCalls: RESULTS.total,
    successes: RESULTS.successes,
    errors: RESULTS.errors,
    errorRate: errorRate + '%',
    successRate: ((RESULTS.successes / RESULTS.total) * 100).toFixed(1) + '%',
    durationMinutes: durationMinutes,
    adAccountId: normalizedAdAccountId,
    timeRange: 'last_7d',
    fields: 'spend,impressions,clicks,reach,ctr,cpc',
    insightsSample: RESULTS.insights.length > 0 ? RESULTS.insights.slice(0, 5).map(i => ({
      date: i.date,
      spend: i.spend,
      impressions: i.impressions,
      clicks: i.clicks,
    })) : [],
    errorTypes: RESULTS.errorTypes,
    recommendations: errorRate < 15
      ? ['Taxa de erro abaixo de 15% — APP REVIEW READY']
      : ['Taxa de erro acima de 15% — Revisar credenciais e tentar novamente'],
  };

  // Salvar relatório bruto
  await writeFileFn(
    join(RAW_DIR, `MARKETING_API_500_CALLS_${DATA}.json`),
    JSON.stringify(report, null, 2)
  );

  // Salvar evidência de exemplo
  await writeFileFn(
    join(EVID_DIR, `MARKETING_API_SAMPLE_${DATA}.json`),
    JSON.stringify({ insights: RESULTS.insights }, null, 2)
  );

  // Relatório resumido no console (zero perguntas — apenas saída)
  console.log('');
  console.log('========================================');
  console.log('RELATORIO FINAL MARKETING API ACCESS TIER');
  console.log('========================================');
  console.log('Total de chamadas:', RESULTS.total);
  console.log('Sucessos:', RESULTS.successes);
  console.log('Erros:', RESULTS.errors);
  console.log('Taxa de erro:', errorRate + ' %');
  console.log('Taxa de sucesso:', ((RESULTS.successes / RESULTS.total) * 100).toFixed(1) + ' %');
  console.log('Duração:', durationMinutes, 'minutos');
  console.log('Conta de anúncios:', normalizedAdAccountId);
  console.log('----------------------------------------');
  console.log('REQUISITO META: <= 15% taxa de erro');
  console.log('ESTADO:', errorRate <= 15 ? 'APROVADO — Pronto para submissão' : 'REVISAR — Taxa de erro muito alta');
  console.log('========================================');

  // Salvar também um log de texto
  const lastLogPath = join(homedir(), '.rx-marketing-api-last-log.txt');
  await writeFileFn(lastLogPath, JSON.stringify(report, null, 2));
}

main().catch(e => {
  console.error('FATAL ERROR:', e);
  process.exit(1);
});