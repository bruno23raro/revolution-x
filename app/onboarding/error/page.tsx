'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ErrorDetail() {
  const params = useSearchParams();
  const reason = params.get('reason') ?? 'unknown';
  const detail = params.get('detail');
  return (
    <main>
      <h1>Onboarding falhou</h1>
      <p>Motivo: {reason}</p>
      {detail ? <p>Detalhe: {detail}</p> : null}
      <p>
        <a href="/dashboard">Voltar para o painel</a>
      </p>
    </main>
  );
}

export default function OnboardingErrorPage() {
  return (
    <Suspense fallback={null}>
      <ErrorDetail />
    </Suspense>
  );
}
