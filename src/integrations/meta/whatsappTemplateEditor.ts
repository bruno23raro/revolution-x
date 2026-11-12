// FASE 5.0 — Editor de Templates WhatsApp com suporte completo a componentes Meta Cloud API

// Tipos oficiais da Meta Cloud API
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export type TemplateLanguage = string; // Ex: 'en_US', 'pt_BR', 'es_ES'

export type HeaderType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | 'FALSE_NAME';

export type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTP';

export interface TemplateHeader {
  type: HeaderType;
  text?: string; // Para TEXT
  format?: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION'; // Não usar com TEXT
  example?: string; // Exemplo de conteúdo dinâmico
  mediaHandle?: string; // media_handle_id para mídia
}

export interface TemplateFooter {
  text: string;
}

export interface TemplateButton {
  type: ButtonType;
  text: string; // Texto do botão
  subType?: 'url' | 'phone' | 'copy_code' | 'otp' | 'quick_reply'; // Para QUICK_REPLY
  index?: number; // Posição no template (0-based)
}

export interface TemplateBody {
  text: string; // Texto com placeholders {{1}}, {{2}}, etc.
  example?: string[]; // Exemplo de valores para variáveis
  variables?: number; // Número esperado de variáveis
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' | 'EXAMPLES';
  header?: TemplateHeader;
  body: TemplateBody;
  footer?: TemplateFooter;
  buttons?: TemplateButton[];
  example?: { BODY: string[][] }; // Exemplo para validação
}

export interface TemplateCreateRequest {
  name: string;
  language: TemplateLanguage;
  category: TemplateCategory;
  components: TemplateComponent[];
}

export interface TemplateResponse {
  id?: string; // ID retornado pela Meta
  name: string;
  language: string;
  category?: string;
  status?: string; // PENDING, APPROVED, REJECTED, etc.
  quality_score?: number; // 1-5
  rejection_reason?: string;
  created_at?: string;
  updated_at?: string;
  components?: Array<{
    type: string;
    text?: string;
    format?: string;
    example?: any;
  }>;
  error?: {
    message: string;
    code: number;
    error_subcode?: number;
  };
}

// Resultados das operações
export interface CreateTemplateResult {
  ok: boolean;
  templateId?: string;
  templateName?: string;
  error?: 'meta_not_configured' | 'fetch_unavailable' | 'http_error' | 'network_error' | 'validation_error';
  errorDetail?: string;
  validationErrors?: string[];
}

export interface ListTemplatesResult {
  ok: boolean;
  templates: TemplateResponse[];
  error?: 'meta_not_configured' | 'fetch_unavailable' | 'http_error' | 'network_error';
  errorDetail?: string;
}

export interface SendTestResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  errorDetail?: string;
}

// Validação do nome de template
// Regras da Meta: lowercase, numbers, underscores, max 50 chars
export function validateTemplateName(name: string): { ok: boolean; error?: string } {
  if (!name || name.length === 0) return { ok: false, error: 'Nome é obrigatório' };
  if (name.length > 50) return { ok: false, error: 'Nome deve ter até 50 caracteres' };
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    return { ok: false, error: 'Nome deve começar com letra minúscula e conter apenas letras minúsculas, números e underscores' };
  }
  return { ok: true };
}

// Validar categorias
export function validateCategory(category: string): category is TemplateCategory {
  return ['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(category);
}

// Contador de variáveis nos placeholders {{1}}, {{2}}, etc.
export function countVariables(text: string): number {
  const matches = text.match(/\{\{\d+\}\}/g);
  return matches ? matches.length : 0;
}

// Validar template completo antes do envio
export function validateTemplateForSubmission(spec: TemplateCreateRequest): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validar nome
  const nameValidation = validateTemplateName(spec.name);
  if (!nameValidation.ok) errors.push(nameValidation.error!);

  // Validar categoria
  if (!validateCategory(spec.category)) {
    errors.push('Categoria inválida. Use: MARKETING, UTILITY ou AUTHENTICATION');
  }

  // Validar idioma
  if (!spec.language || spec.language.length === 0) {
    errors.push('Idioma é obrigatório');
  }

  // Validar componentes
  if (!spec.components || spec.components.length === 0) {
    errors.push('Pelo menos um componente (BODY) é obrigatório');
  }

  for (const comp of spec.components) {
    if (comp.type === 'BODY') {
      if (!comp.body?.text || comp.body.text.length === 0) {
        errors.push('BODY é obrigatório e deve conter texto');
      }
      // Validar placeholders
      const varCount = countVariables(comp.body.text);
      if (comp.body.example && comp.body.example.length > 0) {
        if (comp.body.example.length !== varCount) {
          errors.push(`Exemplo de variáveis (${comp.body.example.length}) não corresponde ao número de placeholders (${varCount})`);
        }
      }
    }

    if (comp.type === 'HEADER') {
      if (!comp.header) {
        errors.push('HEADER deve ter conteúdo');
      } else if (comp.header.type === 'TEXT') {
        if (!comp.header.text || comp.header.text.length === 0) {
          errors.push('HEADER de texto é obrigatório');
        }
      }
    }

    if (comp.type === 'FOOTER') {
      if (!comp.footer?.text || comp.footer.text.length === 0) {
        errors.push('FOOTER é obrigatório');
      }
    }

    if (comp.type === 'BUTTONS') {
      if (!comp.buttons || comp.buttons.length === 0) {
        errors.push('BUTTONS deve conter ao menos um botão');
      } else {
        // Validar cada botão
        for (const btn of comp.buttons) {
          if (!btn.text || btn.text.length === 0) {
            errors.push('Texto do botão é obrigatório');
          }
          if (btn.type === 'URL' && btn.subType !== 'url') {
            errors.push('Botão URL deve ter subType "url"');
          }
          if (btn.type === 'PHONE_NUMBER' && btn.subType !== 'phone') {
            errors.push('Botão PHONE_NUMBER deve ter subType "phone"');
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// Gerar payload para criação no Meta
export function buildMetaPayload(spec: TemplateCreateRequest): any {
  const components: Record<string, any>[] = [];

  // Header
  const headerComp = spec.components.find(c => c.type === 'HEADER');
  if (headerComp?.header) {
    const hdr: Record<string, any> = { type: 'HEADER' };
    if (headerComp.header.type === 'TEXT') {
      hdr.text = headerComp.header.text;
      hdr.format = 'TEXT';
    } else if (headerComp.header.type === 'IMAGE') {
      hdr.format = 'IMAGE';
    } else if (headerComp.header.type === 'VIDEO') {
      hdr.format = 'VIDEO';
    } else if (headerComp.header.type === 'DOCUMENT') {
      hdr.format = 'DOCUMENT';
    }
    if (headerComp.header.example) hdr.example = [{ HEADER: [headerComp.header.example] }];
    components.push(hdr);
  }

  // Body
  const bodyComp = spec.components.find(c => c.type === 'BODY');
  if (bodyComp?.body) {
    const body: any = { type: 'BODY', text: bodyComp.body.text };
    if (bodyComp.body.example) {
      body.example = [{ BODY: [bodyComp.body.example] }];
    }
    components.push(body);
  }

  // Footer
  const footerComp = spec.components.find(c => c.type === 'FOOTER');
  if (footerComp?.footer) {
    components.push({ type: 'FOOTER', text: footerComp.footer.text });
  }

  // Buttons
  const buttonsComp = spec.components.find(c => c.type === 'BUTTONS');
  if (buttonsComp?.buttons && buttonsComp.buttons.length > 0) {
    const bodyComp = spec.components.find(c => c.type === 'BODY');
    const varCount = bodyComp ? countVariables(bodyComp.body.text) : 0;

    const btns = buttonsComp.buttons.map((btn, idx) => {
      const b: any = { type: btn.type, text: btn.text };
      if (btn.type === 'QUICK_REPLY' || btn.type === 'URL' || btn.type === 'PHONE_NUMBER') {
        b.sub_type = btn.subType;
      }
      return b;
    });
    components.push({ type: 'BUTTONS', buttons: btns });
  }

  return {
    name: spec.name,
    language: spec.language,
    category: spec.category,
    components
  };
}