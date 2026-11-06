// FASE 1 — Database Adapter — Factory

import { PrismaDatabaseAdapter } from './prisma-adapter';
import type { DatabaseAdapter, TenantContext } from './types';
import { createPrismaClient } from '../lib/prisma';

/**
 * 创建 DatabaseAdapter 实例。
 *
 * @param source - 数据库连接字符串或 pg.Pool，测试时可注入自定义 pool
 * @param defaultTenant - 默认租户上下文，用于无需显式传入 tenant 的方法
 * @returns DatabaseAdapter 实现
 */
export function createDatabaseAdapter(
  source: string | Pool = process.env.DATABASE_URL ?? '',
  defaultTenant?: TenantContext,
): DatabaseAdapter {
  const client = createPrismaClient(source);
  return new PrismaDatabaseAdapter(client, defaultTenant ?? { type: 'org', id: '' });
}

// Export Pool type for convenience
export type Pool = import('pg').Pool;
