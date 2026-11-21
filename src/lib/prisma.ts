import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';

// Re-export Prisma namespace for use in other files (JsonValue, TransactionClient, etc.)
export { Prisma };

// Builds a Prisma client over a pg connection. Accepts either a connection
// string (a pool is created internally) or a caller-owned Pool, so tests can
// control the pool's lifecycle and avoid leaked open handles.
export function createPrismaClient(
  source: string | Pool,
  opts: { log?: Prisma.LogLevel[] } = {}
): PrismaClient {
  let pool: Pool;
  if (typeof source === 'string') {
    const url = new URL(source);
    url.searchParams.set('options', '-c search_path=public');
    pool = new Pool({ connectionString: url.toString(), ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
  } else {
    pool = source;
  }
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
  return await withUserContextOn(getPrismaClient(), userId, callback);
}

// Application singleton factory - creates client at runtime with current env
let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    const connectionString = process.env.DATABASE_URL ?? '';
    const url = new URL(connectionString);
    url.searchParams.set('options', '-c search_path=public');
    const pool = new Pool({ connectionString: url.toString(), ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
    const adapter = new PrismaPg(pool);
    prismaInstance = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prismaInstance;
}

// For backwards compatibility
export const prisma = getPrismaClient();

export async function withTenantContext<T>(
  organizationId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return await withTenantContextOn(getPrismaClient(), organizationId, callback);
}

