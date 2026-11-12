#!/usr/bin/env node
/**
 * Auditoria RLS via HTTP API do Supabase
 * Projeto: ardpabjoepzhkpmkgwgu (Revolution X)
 */

const http = require('http');
const https = require('https');
const url = require('url');

const SUPABASE_URL = 'https://ardpabjoepzhkpmkgwgu.supabase.co';
// REQUERIDO: SUPABASE_SERVICE_ROLE_KEY no .env.local
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Função para fazer query SQL via REST
async function executeSQL(sql) {
    return new Promise((resolve, reject) => {
        const ParsedUrl = url.parse(SUPABASE_URL);
        const options = {
            hostname: ParsedUrl.hostname,
            port: 443,
            path: '/rest/v1/',
            method: 'POST',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'params=single-transaction'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        req.write(JSON.stringify({ sql }));
        req.end();
    });
}

// Queries
const queries = {
    tables: `SELECT
        t.tablename,
        t.rowsecurity as rls_enabled,
        COUNT(p.polname) as policy_count
    FROM pg_tables t
    LEFT JOIN pg_policies p ON t.tablename = p.tablename
    WHERE t.schemaname = 'public'
    GROUP BY t.tablename, t.rowsecurity
    ORDER BY t.tablename`,

    orgs: `SELECT COUNT(*) as count FROM organizations`,

    members: `SELECT COUNT(*) as count FROM organization_members`,

    subscriptions: `SELECT COUNT(*) as count FROM subscriptions`,

    billing: `SELECT COUNT(*) as count FROM billing_events`,

    products: `SELECT COUNT(*) as count FROM products`,

    ie: `SELECT COUNT(*) as count FROM integration_events`,

    mi: `SELECT COUNT(*) as count FROM meta_integrations`,

    migrations: `SELECT version, name FROM supabase_migrations.schema_migrations
                 WHERE version IN ('025','026','027','028','029') ORDER BY version`
};

async function main() {
    console.log('=== Auditoria RLS - Revolution X ===\n');
    console.log('Nota: Este script requer SERVICE_ROLE_KEY válido.\n');

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        console.log('Configure SUPABASE_SERVICE_ROLE_KEY');
        return;
    }

    // Verificar se conseguimos listar tabelas
    try {
        console.log('Tentando conectar via HTTP...');
        const result = await executeSQL('SELECT 1 as test');
        console.log('Resultado:', JSON.stringify(result).substring(0, 200));
    } catch (e) {
        console.log('Erro de conexão:', e.message);
    }
}

main();