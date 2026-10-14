import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';

// Builds a Prisma client over a pg connection. Accepts either a connection
// string (a pool is created internally) or a caller-owned Pool, so tests can
// control the pool's lifecycle and avoid leaked open handles.
export function createPrismaClient(
  source: string | Pool,
  opts: { log?: Prisma.LogLevel[] } = {}
): PrismaClient {
  const pool = typeof source === 'string' ? new Pool({ connectionString: source }) : source;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: opts.log });
}

// Runs a callback inside a tenant context on the given client.
// The interactive transaction pins one connection, so the transaction-local
// set_config is visible to every subsequent query in the callback.
export async function withTenantContextOn<T>(
  client: PrismaClient,
  organizationId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return await client.$transaction(async (tx) => {
    // Define o contexto local à transação
    await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
    return await callback(tx);
  });
}

// Runs a callback inside a user-scoped context on the given client.
// Used for tables that belong to an individual user (PasswordResetToken,
// EmailVerificationToken). RLS policy requires app.current_user_id to be
// set before any query against these tables.
export async function withUserContextOn<T>(
  client: PrismaClient,
  userId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return await client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    return await callback(tx);
  });
}

// Convenience wrapper around withUserContextOn using the application singleton.
export async function withUserContext<T>(
  userId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return await withUserContextOn(prisma, userId, callback);
}

// Application singleton, bound to the production database.
const connectionString = process.env.DATABASE_URL ?? '';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export async function withTenantContext<T>(
  organizationId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return await withTenantContextOn(prisma, organizationId, callback);
}
