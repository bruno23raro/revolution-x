// Rota antiga /hub-integracoes → 308 permanente para a canônica /integracoes (T52).
import { permanentRedirect } from 'next/navigation';

function buildQuery(searchParams: Record<string, string | string[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else if (v !== undefined) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export default async function HubIntegracoesRedirect({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  permanentRedirect(`/integracoes${buildQuery(searchParams ?? {})}`);
}
