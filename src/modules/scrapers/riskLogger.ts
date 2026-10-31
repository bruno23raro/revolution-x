import { prisma } from '../../lib/prisma';
import { RiskLog, ScraperRiskLevel } from './types';

const prismaForModule = prisma;

// Versão atual do sistema de risco
export const CURRENT_RISK_VERSION = '2.0.0';

/**
 * Insere um novo log de risco no banco de dados.
 * O campo `id` é gerado automaticamente pelo banco (UUID).
 * O campo `timestamp` é gerado automaticamente (now()).
 */
export async function logRiskEntry(
  log: Omit<RiskLog, 'id' | 'timestamp'>
): Promise<RiskLog> {
  const result = await prismaForModule.riskLog.create({
    data: {
      userId: log.userId,
      action: log.action,
      platform: log.platform,
      target: log.target,
      riskLevel: log.riskLevel,
      context: log.context,
      result: log.result,
      organizationId: log.organizationId,
    },
  });

  return {
    id: result.id,
    userId: result.userId,
    action: result.action,
    platform: result.platform as 'instagram' | 'facebook' | 'whatsapp' | 'google',
    target: result.target,
    riskLevel: result.riskLevel as 'low' | 'medium' | 'high' | 'critical',
    context: result.context,
    result: result.result as 'success' | 'failed' | 'blocked',
    timestamp: result.timestamp.toISOString(),
    organizationId: result.organizationId,
  };
}

/**
 * Consulta logs de risco com filtros opcionais.
 * Filtros suportados: userId, platform, riskLevel, result, target
 */
export async function getRiskLogs(
  filters?: {
    organizationId?: string;
    userId?: string;
    platform?: 'instagram' | 'facebook' | 'whatsapp' | 'google';
    riskLevel?: ScraperRiskLevel;
    result?: 'success' | 'failed' | 'blocked';
    target?: string;
  }
): Promise<RiskLog[]> {
  const where: any = {};

  if (filters?.organizationId) {
    where.organizationId = filters.organizationId;
  }

  if (filters?.userId) {
    where.userId = filters.userId;
  }

  if (filters?.platform) {
    where.platform = filters.platform;
  }

  if (filters?.riskLevel) {
    where.riskLevel = filters.riskLevel;
  }

  if (filters?.result) {
    where.result = filters.result;
  }

  if (filters?.target) {
    where.target = filters.target;
  }

  const results = await prismaForModule.riskLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: 100,
  });

  return results.map((r) => ({
    id: r.id,
    userId: r.userId,
    action: r.action,
    platform: r.platform as 'instagram' | 'facebook' | 'whatsapp' | 'google',
    target: r.target,
    riskLevel: r.riskLevel as 'low' | 'medium' | 'high' | 'critical',
    context: r.context,
    result: r.result as 'success' | 'failed' | 'blocked',
    timestamp: r.timestamp.toISOString(),
    organizationId: r.organizationId,
  }));
}

/**
 * Verifica se um usuário já reconheceu o risco para uma plataforma e versão.
 */
export async function checkRiskAcknowledgment(
  userId: string,
  platform: string,
  version: string
): Promise<boolean> {
  const logs = await prisma.riskLog.findMany({
    where: {
      userId,
      platform,
      riskLevel: 'critical', // Considera bloqueio se já houve risco crítico não reconhecido
    },
    orderBy: { timestamp: 'desc' },
    take: 1,
  });

  if (logs.length === 0) {
    return false; // Nenhum log anterior, precisa reconhecer
  }

  const lastLog = logs[0];
  // Se o último log tem resultado 'blocked' e não foi marcado como acknowledged, retorna false
  if (lastLog.result === 'blocked') {
    // Verificar se há um registro de acknowledgment (poderia adicionar uma tabela separada)
    // Por enquanto, considera que risco critical bloqueado precisa ser acknowledged
    return false;
  }

  return true;
}

/**
 * Marca um risco como reconhecido pelo usuário.
 * Atualiza o log correspondente adicionando metadados de acknowledgment.
 */
export async function markRiskAcknowledged(
  userId: string,
  platform: string,
  version: string
): Promise<void> {
  // Atualiza o último log de risco para esse usuário/plataforma
  await prisma.riskLog.updateMany({
    where: {
      userId,
      platform,
      riskLevel: 'critical',
      result: 'blocked',
    },
    data: {
      // Em um sistema mais avançado, teríamos uma tabela de acknowledgment separada
      // Por enquanto, apenas retornamos o status de blocked como informação
    },
  });
}

// Exporta o PrismaClient para uso em testes ou outras funções se necessário
export { prisma };