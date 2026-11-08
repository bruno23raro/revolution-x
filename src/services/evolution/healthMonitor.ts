/**
 * Health Monitor Worker — WhatsApp Non-Official (Evolution API)
 *
 * Polling periódico de status das instâncias WhatsApp conectadas via Evolution API.
 * Para cada instância com status CONNECTED/DISCONNECTED/ERROR, grava um AdminAlert
 * no Supabase quando há mudança de estado ou falha de heartbeat.
 *
 * Uso:
 *   npx tsx src/services/evolution/healthMonitor.ts
 * (O script roda em loop com intervalo configurável via ENV INTERVAL_MS, default 60s.)
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { EvolutionService } from './EvolutionService';
import { info, error } from '../../lib/logger';

const INTERVAL_MS = Number(process.env.HEALTH_MONITOR_INTERVAL_MS || 60000);
const ORG_ID = process.env.HEALTH_MONITOR_ORG_ID || '9d7114cd-013e-4e03-b91d-848518bf6514';

// Estado em memória das últimas alterações de status para evitar alertas duplicados
const lastStatus = new Map<string, string>();

function alertOrgId(orgId: string): string {
  return orgId;
}

async function sendAdminAlert(
  supa: ReturnType<typeof createServiceRoleClient>,
  type: string,
  severity: 'warning' | 'critical',
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await supa
      .from('AdminAlert')
      .insert({
        organizationId: alertOrgId(ORG_ID),
        type,
        severity,
        title,
        message,
        metadata: metadata ?? {},
      });
    info('[HealthMonitor] AdminAlert gravado', { type, severity, title });
  } catch (e) {
    error('[HealthMonitor] Falha ao gravar AdminAlert', e, { type });
  }
}

async function runOnce() {
  const supa = createServiceRoleClient();
  const evolution = new EvolutionService();

  // Carregar instâncias da organização diretamente do Supabase (RLS)
  const { data: instances, error: dbError } = await supa
    .from('whatsapp_instances')
    .select('*')
    .eq('organizationId', ORG_ID);

  if (dbError) {
    error('[HealthMonitor] Erro ao carregar instâncias', { error: dbError.message });
    return;
  }

  if (!instances || instances.length === 0) {
    info('[HealthMonitor] Nenhuma instância registrada', { orgId: ORG_ID });
    return;
  }

  for (const inst of instances) {
    const instanceName = inst.instanceName;
    const prevStatus = lastStatus.get(instanceName);

    try {
      const current = await evolution.getInstance(instanceName);
      const newStatus = current.status || 'ERROR';

      if (prevStatus === undefined) {
        // Primeira observação: apenas registra, não alerta
        lastStatus.set(instanceName, newStatus);
        info('[HealthMonitor] status inicial', { instanceName, status: newStatus });
        continue;
      }

      if (newStatus !== prevStatus) {
        // Mudança de status: alerta
        const title = `Instância ${instanceName} mudou de status`;
        const message = `Status mudou de "${prevStatus}" para "${newStatus}"`;
        await sendAdminAlert(
          supa,
          'integration_status',
          newStatus === 'CONNECTED' ? 'warning' : 'critical',
          title,
          message,
          {
            instanceName,
            previousStatus: prevStatus,
            currentStatus: newStatus,
            checkedAt: new Date().toISOString(),
          },
        );
        info('[HealthMonitor] status mudou', { instanceName, prevStatus, newStatus });
        lastStatus.set(instanceName, newStatus);
      } else if (newStatus === 'ERROR') {
        // Instância permanecendo em ERROR: alerta crítico periódico
        await sendAdminAlert(
          supa,
          'integration_status',
          'critical',
          `Instância ${instanceName} com erro persistente`,
          `Instância ${instanceName} permaneceu com status ERROR no heartbeat`,
          {
            instanceName,
            status: newStatus,
            lastHeartbeat: inst.lastHeartbeat,
            checkedAt: new Date().toISOString(),
          },
        );
        info('[HealthMonitor] ERROR persistente', { instanceName });
      } else {
        // Status estável e não-error: apenas heartbeat de saúde
        await evolution.updateHeartbeat(instanceName).catch(() => {
          // Falha de heartbeat não bloqueia o loop
        });
        info('[HealthMonitor] instância estável', { instanceName, status: newStatus });
      }
    } catch (e) {
      // Falha ao consultar Evolution API para esta instância
      const title = `Falha ao consultar instância ${instanceName}`;
      const message = `Não foi possível obter status da instância ${instanceName} via Evolution API`;
      await sendAdminAlert(
        supa,
        'integration_status',
        'critical',
        title,
        message,
        {
          instanceName,
          error: e instanceof Error ? e.message : String(e),
          checkedAt: new Date().toISOString(),
        },
      );
      error('[HealthMonitor] Erro ao consultar instância', e, { instanceName });
      // Mantém o último status conhecido para não gerar alerta falso de mudança
    }
  }
}

async function main() {
  info('[HealthMonitor] Iniciando monitor', { orgId: ORG_ID, intervalMs: INTERVAL_MS });

  // Executa imediatamente uma vez
  await runOnce().catch(e => error('[HealthMonitor] Erro na execução inicial', { error: e }));

  // Loop periódico
  setInterval(() => {
    runOnce().catch(e => error('[HealthMonitor] Erro no ciclo periódico', { error: e }));
  }, INTERVAL_MS);

  info('[HealthMonitor] Loop iniciado', { note: 'Pressione Ctrl+C para parar' });
}

main().catch(e => {
  error('[HealthMonitor] Erro fatal', { error: e });
  process.exit(1);
});