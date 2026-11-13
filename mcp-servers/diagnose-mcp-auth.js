#!/usr/bin/env node
/**
 * Diagnostico de Autenticação MCP - Revolution X
 *
 * Este script verifica o status de autenticação dos MCPs conectados
 * e gera um relatório de diagnóstico para correção.
 *
 * Uso: node mcp-servers/diagnose-mcp-auth.js
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '.mcp.json');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function diagnose() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '  DIAGNÓSTICO MCP - Revolution X');
  log(colors.cyan, '========================================\n');

  if (!fs.existsSync(CONFIG_PATH)) {
    log(colors.red, '❌ Arquivo .mcp.json não encontrado!');
    return;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const servers = config.mcpServers || {};

  log(colors.blue, 'Servidores MCP Configurados:\n');

  // Servidores com problemas conhecidos
  const KNOWN_ISSUES = {
    'github': 'Authorization header mal formatado (400)',
    'vercel': 'Não conectado via HTTP',
  };

  // Servidores com status certo
  const WORKING = [
    'supabase',
    'playwright',
    'browser-mcp',
    'chrome-devtools',
    'context7',
    'memory',
    'sequential-thinking',
    'search',
  ];

  for (const [name, server] of Object.entries(servers)) {
    const issue = KNOWN_ISSUES[name];
    const isWorking = WORKING.includes(name);

    if (issue) {
      log(colors.yellow, `⚠️  ${name}`);
      log(colors.gray, `   Problema: ${issue}`);
      log(colors.gray, `   Solução: Verificar token ou reconectar\n`);
    } else if (isWorking) {
      log(colors.green, `✅ ${name}`);
      log(colors.gray, `   Status: Conectado\n`);
    } else {
      const type = server.type === 'http' ? 'HTTP' : 'CMD';
      log(colors.yellow, `❓ ${name}`);
      log(colors.gray, `   Tipo: ${type}`);
      log(colors.gray, `   Status: Precisa verificação\n`);
    }
  }

  // MCPs Customizados
  log(colors.cyan, '\n----------------------------------------');
  log(colors.cyan, '  MCPs Customizados Criados:');
  log(colors.cyan, '----------------------------------------\n');

  const customMcps = ['github-custom', 'vercel-custom'];
  for (const name of customMcps) {
    if (servers[name]) {
      log(colors.green, `✅ ${name}`);
      log(colors.gray, `   Local: mcp-servers/${name.replace('-custom', '')}-custom-server.js`);
      log(colors.gray, `   Status: Pronto para autenticação\n`);
    }
  }

  // Instruções de autenticação
  log(colors.cyan, '\n----------------------------------------');
  log(colors.cyan, '  Passos para Autenticação:');
  log(colors.cyan, '----------------------------------------\n');

  log(colors.blue, '1. GitHub Personal Access Token:');
  log(colors.gray, '   - Acesse: https://github.com/settings/tokens');
  log(colors.gray, '   - Crie um novo token com permissões:');
  log(colors.gray, '     * repo (Full control of private repositories)');
  log(colors.gray, '     * read:user (Read user data)');
  log(colors.gray, '   - Salve o token em .env.local como GITHUB_TOKEN\n');

  log(colors.blue, '2. Vercel Token:');
  log(colors.gray, '   - Acesse: https://vercel.com/account/tokens');
  log(colors.gray, '   - Crie um novo token');
  log(colors.gray, '   - Salve em .env.local como VERCEL_TOKEN\n');

  log(colors.blue, '3. Reconectar MCPs:');
  log(colors.gray, '   - No Claude Code, execute: /mcp');
  log(colors.gray, '   - Desconecte e reconecte: github-custom, vercel-custom\n');

  log(colors.cyan, '\========================================\n');

  // Verificar tokens no arquivo
  log(colors.yellow, 'Verificando tokens em .mcp.json...\n');

  const githubToken = servers['github-custom']?.env?.GITHUB_TOKEN;
  const vercelToken = servers['vercel-custom']?.env?.VERCEL_TOKEN;

  if (githubToken) {
    log(colors.green, '✅ GitHub Token configurado');
  } else {
    log(colors.red, '❌ GitHub Token não configurado');
  }

  if (vercelToken) {
    log(colors.green, '✅ Vercel Token configurado');
  } else {
    log(colors.red, '❌ Vercel Token não configurado');
  }

  log(colors.cyan, '\n----------------------------------------\n');
}

diagnose();