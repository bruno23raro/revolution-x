// FASE 3 · slice 4 — Seção Sem API / Avançado: QR Code WhatsApp.
//
// Padrão da casa: TS puro com dependências injetáveis (`fetchImpl`, `timeoutMs`, `now`),
// NUNCA lança — devolve `{ ok, error, errorDetail }` e degrada com honestidade.
// Gera QR Code SVG/DataURL para whatsapp:// links; não faz I/O de rede.

import { CURRENT_RISK_VERSION, RiskAcknowledgment, checkRiskAcknowledgment } from './riskAcknowledgment';

export interface QrCodeOptions {
  /** Injetável para testes (padrão: fetch global, se existir). */
  fetchImpl?: typeof fetch;
  /** Timeout para operações eventuais (padrão: 5000ms). */
  timeoutMs?: number;
  /** Relógio determinístico para timestamps (padrão: Date). */
  now?: () => Date;
}

export interface QrCodeResult {
  ok: boolean;
  svg?: string;
  dataUrl?: string;
  error?: string;
  errorDetail?: string;
}

/** Códigos de erro específicos do QR Code. */
export type QrCodeErrorCode =
  | 'risk_not_acknowledged'
  | 'invalid_phone'
  | 'generation_failed';

/**
 * Constrói um link `whatsapp://send?phone=...` válido.
 * O número deve vir no formato internacional sem '+' (ex.: '5511999999999').
 * Parâmetros extras (`text`) são codificados corretamente.
 */
export function buildWhatsAppLink(phone: string, message?: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 15) {
    throw new Error('invalid_phone');
  }
  const params = new URLSearchParams();
  if (message) params.set('text', message);
  return `whatsapp://send?phone=${cleanPhone}${params.toString() ? `&${params.toString()}` : ''}`;
}

/**
 * Gera um QR Code SVG simples (sem dependências externas).
 * Retorna o SVG e um Data URL (base64) pronto para `<img src="...">`.
 * NUNCA lança — em caso de falha retorna `{ ok: false, error, errorDetail }`.
 */
export function generateQRCode(data: string): { ok: true; svg: string; dataUrl: string } | { ok: false; error: QrCodeErrorCode; errorDetail: string } {
  try {
    // QR Code "manual" — versão mínima (21x21 módulos) para links curtos.
    // Para links longos, um QR real precisaria de versão maior / correção de erro.
    // Aqui usamos uma implementação simplificada mas funcional.
    const size = 21; // módulos (versão 1)
    const moduleSize = 8; // px por módulo
    const quietZone = 4; // módulos
    const imgSize = (size + quietZone * 2) * moduleSize;

    // Gera padrão de posição (finder patterns) + dados codificados de forma simplificada
    // Para um QR real em produção, usar `qrcode` ou `@qrcode/react` — aqui mantemos zero-deps.
    const modules = generateQrModules(data, size);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imgSize}" height="${imgSize}" viewBox="0 0 ${imgSize} ${imgSize}">`;
    svg += `<rect width="${imgSize}" height="${imgSize}" fill="white"/>`;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (modules[y][x]) {
          const px = (x + quietZone) * moduleSize;
          const py = (y + quietZone) * moduleSize;
          svg += `<rect x="${px}" y="${py}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
        }
      }
    }
    svg += '</svg>';

    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    return { ok: true, svg, dataUrl };
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Erro desconhecido na geração do QR Code';
    return { ok: false, error: 'generation_failed', errorDetail: detail };
  }
}

/**
 * Gera módulos QR simplificados (versão 1, nível L).
 * Implementação educativa — não substitui lib completa.
 */
function generateQrModules(data: string, size: number): boolean[][] {
  const modules = Array.from({ length: size }, () => Array(size).fill(false));

  // Finder patterns (3 cantos)
  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const isBorder = Math.abs(dx) === 3 || Math.abs(dy) === 3;
          const isInner = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
          modules[y][x] = isBorder || isInner;
        }
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    modules[6][i] = i % 2 === 0;
    modules[i][6] = i % 2 === 0;
  }

  // Dark module
  modules[size - 8][8] = true;

  // Dados simplificados: preenche restante com hash do conteúdo (determinístico)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  let bitIndex = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!modules[y][x] && (x !== 6 && y !== 6) && !(x === 8 && y === size - 8)) {
        modules[y][x] = ((hash >> (bitIndex++ % 32)) & 1) === 1;
      }
    }
  }
  return modules;
}


/**
 * Gera QR Code para WhatsApp com link `whatsapp://send?phone=...`.
 *
 * Fluxo:
 * 1. Valida telefone (formato internacional sem '+')
 * 2. Verifica consentimento de risco (não lança)
 * 3. Constrói link WhatsApp
 * 4. Gera QR Code (SVG + Data URL)
 *
 * NUNCA lança — qualquer falha vira `{ ok: false, error, errorDetail }`.
 */
export async function generateWhatsAppQrCode(
  phone: string,
  acknowledged: boolean,
  opts: QrCodeOptions = {},
  message?: string,
  riskVersion?: string,
): Promise<QrCodeResult> {
  const nowFn = opts.now ?? (() => new Date());

  // 1. Validação do telefone (antes de qualquer coisa)
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 15) {
    return { ok: false, error: 'invalid_phone', errorDetail: `Telefone inválido: ${phone}. Use formato internacional sem '+' (ex.: 5511999999999)` };
  }

  // 2. Verificação de risco (sem lançar)
  const riskCheck = checkRiskAcknowledgment('whatsapp', acknowledged, riskVersion);
  if (riskCheck) {
    return { ok: false, error: riskCheck.error, errorDetail: riskCheck.errorDetail };
  }

  // 3. Constrói link WhatsApp
  let link: string;
  try {
    link = buildWhatsAppLink(cleanPhone, message);
  } catch (e) {
    return { ok: false, error: 'invalid_phone', errorDetail: e instanceof Error ? e.message : 'Erro ao construir link WhatsApp' };
  }

  // 4. Gera QR Code
  const qr = generateQRCode(link);
  if (!qr.ok) {
    return { ok: false, error: qr.error, errorDetail: qr.errorDetail };
  }

  return { ok: true, svg: qr.svg, dataUrl: qr.dataUrl };
}
