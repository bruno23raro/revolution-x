// FASE 18 — Facade da camada de IA multi-provedor (§13).
//
// Importar tudo daqui. Nenhum segredo sai: provedores expõem `configured`
// (booleano) + metadados de modelos; chaves vivem só no backend.
export * from './aiTypes';
export { buildAiProviders, buildOmniProvider, buildGeminiProvider, buildOllamaProvider, type BuildProvidersOptions } from './aiProviders';
export { discoverModels, clearDiscoveryCache, type DiscoveryResult } from './discovery';
export { selectModelForTask, type AutoSelectPrefs } from './autoSelect';
export { generateWithFallback, type GenerateOptions } from './generate';
