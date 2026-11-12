'use client';

// FASE 6 — Banner visual indicando modo demo
// Exibe em todas as páginas quando RX_DEMO_MODE=1

import { useEffect, useState } from 'react';

export function DemoBanner() {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    fetch('/api/dev/status')
      .then((r) => r.json())
      .then((d) => setIsDemo(d.demo))
      .catch(() => setIsDemo(false));
  }, []);

  if (!isDemo) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-black px-4 py-2 text-center text-sm font-medium shadow-md">
      ⚠️ MODO DEMONSTRAÇÃO — Dados fictícios, nenhuma ação real é executada
    </div>
  );
}

export default DemoBanner;