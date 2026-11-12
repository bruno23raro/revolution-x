#!/usr/bin/env node
/**
 * Gera uma chave JWT segura para DEMO_JWT_SECRET
 * Uso: node scripts/generate-secret.js >> .env.local
 */

const crypto = require('crypto');

// Gerar 32 bytes = 256 bits de entropia
const secret = crypto.randomBytes(32).toString('base64url');

console.log(secret);