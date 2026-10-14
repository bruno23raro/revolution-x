import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import { createPrismaClient, withTenantContextOn } from '../lib/prisma';

// Real Prisma path against real PostgreSQL, under the restricted role so RLS
// is actually enforced. No mocks — this proves tenant isolation through the
// Prisma client + withTenantContextOn helper on real queries.
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
const RLS_URL = process.env.TEST_RLS_DATABASE_URL;

let admin: Pool;
let rlsPool: Pool;
let prismaTest: PrismaClient;

beforeAll(async () => {
  if (!ADMIN_URL) throw new Error('TEST_ADMIN_DATABASE_URL must be set in .env.test');
  if (!RLS_URL) throw new Error('TEST_RLS_DATABASE_URL must be set in .env.test');
  admin = new Pool({ connectionString: ADMIN_URL, max: 2 });
  // Caller-owned pool so the test can end it and Jest can exit cleanly.
  // The Prisma client connects as revx_test (restricted, no BYPASSRLS).
  rlsPool = new Pool({ connectionString: RLS_URL, max: 2 });
  prismaTest = createPrismaClient(rlsPool);
  await admin.query('SELECT 1');
  await prismaTest.$connect();
});

afterAll(async () => {
  await prismaTest?.$disconnect();
  await rlsPool?.end();
  await admin?.end();
});

describe('Prisma tenant context (real PostgreSQL, restricted role)', () => {
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    orgA = uuidv4();
    orgB = uuidv4();
    await admin.query(
      `INSERT INTO "Organization" (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [orgA, 'Org A', `pa_${uuidv4().slice(0, 8)}`]
    );
    await admin.query(
      `INSERT INTO "Organization" (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [orgB, 'Org B', `pb_${uuidv4().slice(0, 8)}`]
    );
  });

  afterAll(async () => {
    await admin.query('DELETE FROM "Contact" WHERE "organizationId" IN ($1, $2)', [orgA, orgB]);
    await admin.query('DELETE FROM "Organization" WHERE id IN ($1, $2)', [orgA, orgB]);
  });

  it('finds only the current tenant via the typed Prisma client', async () => {
    const a1 = uuidv4();
    const b1 = uuidv4();
    await admin.query(
      `INSERT INTO "Contact" (id, "organizationId", name, email) VALUES ($1,$2,$3,$4)`,
      [a1, orgA, 'A1', 'pa1@x.test']
    );
    await admin.query(
      `INSERT INTO "Contact" (id, "organizationId", name, email) VALUES ($1,$2,$3,$4)`,
      [b1, orgB, 'B1', 'pb1@x.test']
    );

    const seen = await withTenantContextOn(prismaTest, orgA, async (tx) => {
      return await tx.contact.findMany({ select: { id: true } });
    });

    const ids = seen.map((c) => c.id).sort();
    // Only org A's contact is visible; org B's is filtered out by RLS.
    expect(ids).toEqual([a1]);

    await admin.query('DELETE FROM "Contact" WHERE id IN ($1, $2)', [a1, b1]);
  });

  it('cannot read another tenant row by id through Prisma', async () => {
    const b1 = uuidv4();
    await admin.query(`INSERT INTO "Contact" (id, "organizationId", name) VALUES ($1,$2,$3)`, [
      b1,
      orgB,
      'B2',
    ]);

    const found = await withTenantContextOn(prismaTest, orgA, async (tx) => {
      return await tx.contact.findFirst({ where: { id: b1 }, select: { id: true } });
    });

    expect(found).toBeNull();
    await admin.query('DELETE FROM "Contact" WHERE id = $1', [b1]);
  });

  it('rejects an out-of-tenant write through Prisma', async () => {
    await expect(
      withTenantContextOn(prismaTest, orgA, async (tx) => {
        // WITH CHECK forces "organizationId" to equal the current tenant.
        await tx.contact.create({
          data: {
            id: uuidv4(),
            organizationId: orgB,
            name: 'evil',
          },
        });
      })
    ).rejects.toThrow();
  });
});
