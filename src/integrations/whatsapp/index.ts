// Barrel — WhatsApp OpenBSP (factory + contratos).
export * from './types';
export { getWhatsAppProvider } from './provider';
export { openbspConfig, mintOnboardingToken, fetchConnectedAddress, sendViaOpenbsp, textContent, templateContent } from './openbsp/client';
export { buildOfficialSender, checkTier } from './dispatcher';
export * from './channelRepo';
