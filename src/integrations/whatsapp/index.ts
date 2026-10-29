// Barrel — WhatsApp oficial (factory + contratos).
export * from './types';
export { getWhatsAppProvider } from './provider';
export { openbspConfig, mintOnboardingToken, fetchConnectedAddress } from './openbsp/client';
export { buildOfficialSender, checkTier } from './dispatcher';
export * from './channelRepo';
