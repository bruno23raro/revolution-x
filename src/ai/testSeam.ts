// FASE 13/18 — Seam de teste da camada de IA (§16): permite aos testes injetar
// a cadeia de provedores SEM rede/creds reais. As rotas `app/api/ai/*` leem o
// estado aqui; as rotas em si NÃO exportam nada além dos handlers HTTP (Next
// exige módulos de rota "puros"). O módulo é único (singleton do Jest) — o
// mesmo holder é compartilhado entre /api/ai/models e /api/ai/generate.

import type { AiProvider } from './aiTypes';

let testProviders: AiProvider[] | undefined;

/** Injeta a cadeia de provedores usada pelas rotas de IA em teste. */
export function setTestProviders(providers: AiProvider[] | undefined) {
  testProviders = providers;
}

/** Lê a cadeia injetada (ou undefined → a rota constrói os reais). */
export function getTestProviders(): AiProvider[] | undefined {
  return testProviders;
}
