// Applies the token-table schema + migration 008 policies to the LOCAL test DB.
// Connects as ADMIN role (TEST_ADMIN_DATABASE_URL / postgres, BYPASSRLS).
// Prints NO credentials; only host/port/db identity.
//
// What it does (idempotent, non-destructive):
//   1. Creates "User" table if absent (minimal column set needed for tests).
//   2. Creates "PasswordResetToken" and "EmailVerificationToken" if absent.
//   3. Runs 008_token_rls_harden.sql to install hardened user-scoped RLS policies.
//
// Usage: node scripts/apply-token-rls-setup.mjs

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { readFileSync } = require('node:fs');
const { fileURLToPath } = require('node:url');
const path = require('node:path');

dotenv.config({ path: new URL('../.env.test', import.meta.url) });

const url = process.env.TEST_ADMIN_DATABASE_URL;
if (!url) {
  console.log('NO_ADMIN_URL: TEST_ADMIN_DATABASE_URL is not set in .env.test');
  process.exit(2);
}

try {
  const u = new URL(url);
  console.log('TARGET host=', u.hostname, '| port=', u.port || '5432', '| db=', u.pathname.replace(/^\/$/, ''));
} catch {
  console.log('TARGET: (could not parse TEST_ADMIN_DATABASE_URL as URL)');
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sql8 = readFileSync(path.join(here, '..', 'supabase', 'migrations', '008_token_rls_harden.sql'), 'utf8');

const pool = new Pool({ connectionString: url });

async function run(sql) {
  await pool.query(sql);
}

try {
  // ── 1. Create User table (minimal) ────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id"          UUID         PRIMARY KEY,
      "email"       VARCHAR(255) NOT NULL UNIQUE,
      "name"        VARCHAR(255),
      "password_hash" VARCHAR(255),
      "email_verified" BOOLEAN   NOT NULL DEFAULT false,
      "createdAt"   TIMESTAMP(6) NOT NULL DEFAULT now(),
      "updatedAt"   TIMESTAMP(6) NOT NULL DEFAULT now()
    );
  `);

  // ── 2. Create PasswordResetToken table (minimal) ───────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
      "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId"     UUID         NOT NULL,
      "tokenHash"  VARCHAR(255) NOT NULL UNIQUE,
      "expiresAt"  TIMESTAMPTZ  NOT NULL,
      "usedAt"     TIMESTAMPTZ,
      "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT "PasswordResetToken_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
    );
  `);

  // ── 3. Create EmailVerificationToken table (minimal) ───────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
      "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId"     UUID         NOT NULL,
      "tokenHash"  VARCHAR(255) NOT NULL UNIQUE,
      "expiresAt"  TIMESTAMPTZ  NOT NULL,
      "usedAt"     TIMESTAMPTZ,
      "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT "EmailVerificationToken_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
    );
  `);

  // ── 4. Enable RLS on all three ────────────────────────────────────────────
  await run(`ALTER TABLE "User"               ENABLE ROW LEVEL SECURITY;`);
  await run(`ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;`);
  await run(`ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;`);

  // ── 5. Apply migration 008 policies ───────────────────────────────────────
  await run(sql8);
} catch (e) {
  console.log('APPLY_ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
