// FASE 17 — Importação em massa de contatos (CSV) — repositório.
//
// Tudo tenant-scoped via withTenantContext (GUC app.current_org + RLS
// FORCED). A org é SEMPRE server-derived; nenhum campo do importador
// muda campos protegidos (role, org, plan): só os campos mapeáveis do
// CSV (allow-list) são persistidos.

import { withTenantContext } from '@/lib/prisma';
import type { MappedRecord } from '@/services/csvImport';

const CHUNK = 500;

/**
 * Identificadores existentes da org (para detecção de duplicados).
 * E-mails em minúscula; telefones no formato E.164 normalizado que a
 * importação produz — ambos já normalizados à entrada.
 */
export async function listIdentifiers(
  orgId: string,
): Promise<{ emails: Set<string>; phones: Set<string> }> {
  return await withTenantContext(orgId, async (tx) => {
    const rows = await tx.contact.findMany({
      where: { organizationId: orgId },
      select: { email: true, phone: true },
    });
    const emails = new Set<string>();
    const phones = new Set<string>();
    for (const r of rows) {
      if (r.email) emails.add(r.email.toLowerCase().trim());
      if (r.phone) phones.add(r.phone.trim());
    }
    return { emails, phones };
  });
}

/**
 * Contatos da org com os campos de elegibilidade (consentimento) —
 * usado pelo planejador de campanhas (§11). Nenhum campo protegido.
 */
export async function listMarketingContacts(
  orgId: string,
): Promise<
  Array<{
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    source: string | null;
    tags: unknown;
    customFields: unknown;
    consentMarketing: boolean;
    consentSource: string | null;
    optOut: boolean;
  }>
> {
  return await withTenantContext(orgId, async (tx) => {
    return tx.contact.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        source: true,
        tags: true,
        customFields: true,
        consentMarketing: true,
        consentSource: true,
        optOut: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  });
}

/**
 * Insere os registros válidos em lotes transacionais seguros. NENHUMA
 * mensagem de efeito colateral é disparada durante a importação (§8).
 * Retorna a contagem efetivamente inserida.
 */
export async function bulkCreateContacts(
  orgId: string,
  records: MappedRecord[],
): Promise<{ inserted: number }> {
  let inserted = 0;
  await withTenantContext(orgId, async (tx) => {
    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK).map((r) => ({
        organizationId: orgId,
        name: r.name ?? 'Sem nome',
        firstName: r.firstName ?? null,
        lastName: r.lastName ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        company: r.company ?? null,
        source: r.source ?? null,
        tags: JSON.stringify(r.tags ?? []),
        customFields: JSON.stringify(r.customFields ?? {}),
        preferences: JSON.stringify(r.preferences ?? {}),
        consentMarketing: r.consentMarketing ?? false,
        consentSource: r.consentSource ?? null,
        optOut: r.optOut ?? false,
      }));
      const res = await tx.contact.createMany({ data: chunk as never });
      inserted += res.count;
    }
  });
  return { inserted };
}
