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
  } catch (e) {
    console.error(`[HealthMonitor] Falha ao gravar AdminAlert (${type}):`, e);
  }
}

async function runOnce() {
  const supa = createServiceRoleClient();
  const evolution = new EvolutionService();

  // Carregar instâncias da organização diretamente do Supabase (RLS)
  const { data: instances, error } = await supa
    .from('whatsapp_instances')
    .select('*')
    .eq('organizationId', ORG_ID);

  if (error) {
    console.error(`[HealthMonitor] Erro ao carregar instâncias:`, error);
    return;
  }

  if (!instances || instances.length === 0) {
    console.log(`[HealthMonitor] Nenhuma instância registrada para org ${ORG_ID}`);
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
        console.log(`[HealthMonitor] ${instanceName}: status inicial ${newStatus}`);
        continue;
      }

      if (newStatus !== prevStatus) {
        // Mudança de status: alerta
        const severity = newStatus === 'CONNECTED' ? 'warning' : 'critical';
        const title = `Instância ${instanceName} mudou de status`;
        const message = `Status mudou de "${prevStatus}" para "${newStatus}"`;
        await sendAdminAlert(
          supa,
          'integration_status',
          severity,
          title,
          message,
          {
            instanceName,
            previousStatus: prevStatus,
            currentStatus: newStatus,
            checkedAt: new Date().toISOString(),
          },
        );
        console.log(`[HealthMonitor] ${instanceName}: ${prevStatus} → ${newStatus} (alerta enviado)`);
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
        console.log(`[HealthMonitor] ${instanceName}: ERROR persistente (alerta crítico)`);
      } else {
        // Status estável e não-error: apenas heartbeat de saúde
        await evolution.updateHeartbeat(instanceName).catch(() => {
          // Falha de heartbeat não bloqueia o loop
        });
        console.log(`[HealthMonitor] ${instanceName}: estável (${newStatus})`);
      }
    } catch (e) {
      // Falha ao consultar Evolution API para esta instância
      const severity = 'critical';
      const title = `Falha ao consultar instância ${instanceName}`;
      const message = `Não foi possível obter status da instância ${instanceName} via Evolution API`;
      await sendAdminAlert(
        supa,
        'integration_status',
        severity,
        title,
        message,
        {
          instanceName,
          error: e instanceof Error ? e.message : String(e),
          checkedAt: new Date().toISOString(),
        },
      );
      console.error(`[HealthMonitor] Erro ao consultar ${instanceName}:`, e);
      // Mantém o último status conhecido para não gerar alerta falso de mudança
    }
  }
}

async function main() {
  console.log(`[HealthMonitor] Iniciando monitor de instâncias WhatsApp (org ${ORG_ID})`);
  console.log(`[HealthMonitor] Intervalo: ${INTERVAL_MS}ms`);

  // Executa imediatamente uma vez
  await runOnce().catch(e => console.error('[HealthMonitor] Erro na execução inicial:', e));

  // Loop periódico
  setInterval(() => {
    runOnce().catch(e => console.error('[HealthMonitor] Erro no ciclo periódico:', e));
  }, INTERVAL_MS);

  console.log('[HealthMonitor] Loop iniciado. Pressione Ctrl+C para parar.');
}

main().catch(e => {
  console.error('[HealthMonitor] Erro fatal:', e);
  process.exit(1);
});
