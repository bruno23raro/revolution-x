import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("e-mail invalido").max(254);

export const passwordSchema = z.string()
  .min(10, "minimo 10")
  .regex(/[A-Z]/, "maiuscula")
  .regex(/[a-z]/, "minuscula")
  .regex(/\d/, "numero")
  .regex(/[^A-Za-z0-9]/, "simbolo");

export const slugSchema = z.string().min(3).max(40).regex(/^[a-z0-9-]+$/, "slug invalido");

export const nameSchema = z.string().trim().min(2).max(120);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidSchema = z.string().uuid("uuid invalido");

// Auth schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "senha obrigatoria"),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "token obrigatorio"),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "token obrigatorio"),
});

// Contact schemas
export const contactCreateSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "telefone invalido (E.164)").optional(),
  company: z.string().max(255).optional(),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  source: z.string().max(120).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

export const contactUpdateSchema = contactCreateSchema.partial();

// Lead schemas
export const leadCreateSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'lost']).default('new'),
  source: z.string().max(120).optional(),
});

export const leadUpdateSchema = leadCreateSchema.partial();

// Deal schemas
export const dealCreateSchema = z.object({
  title: nameSchema,
  value: z.number().nonnegative("valor nao pode ser negativo").optional(),
  stage: z.enum(['prospecting', 'proposal', 'negotiation', 'won', 'lost']).default('prospecting'),
  pipelineId: uuidSchema.optional(),
});

export const dealUpdateSchema = dealCreateSchema.partial();

// Pipeline schemas
export const pipelineCreateSchema = z.object({
  name: nameSchema,
  stages: z.array(z.string().min(1).max(50)).min(1).default(['prospecting', 'proposal', 'negotiation', 'won', 'lost']),
});

export const pipelineUpdateSchema = pipelineCreateSchema.partial();

// Campaign schemas
export const campaignCreateSchema = z.object({
  title: nameSchema,
  channel: z.enum(['whatsapp', 'email', 'sms', 'manual']),
  message: z.string().min(1, "mensagem obrigatoria"),
  variables: z.record(z.string(), z.string()).default({}),
  audienceJson: z.record(z.string(), z.unknown()).default({}),
  accountId: z.string().max(64).optional(),
  resultKind: z.enum(['auto', 'manual']).optional(),
  scheduledFor: z.string().datetime().optional(),
});

export const campaignUpdateSchema = campaignCreateSchema.partial();

// WhatsApp schemas
export const whatsappSendSchema = z.object({
  to: z.array(z.string().regex(/^\+?[1-9]\d{1,14}$/, "telefone invalido (E.164)")).min(1),
  recipients: z.array(z.object({
    to: z.string(),
    text: z.string().optional(),
  })).optional(),
  text: z.string().optional(),
  templateId: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
  delayMs: z.number().min(0).max(60000).optional(),
  account: z.string().optional(),
  template: z.object({
    name: z.string(),
    variables: z.array(z.string()).optional(),
    language: z.string().optional(),
  }).optional(),
});

export const whatsappTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  language: z.string().min(2).max(10).default('pt_BR'),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  componentsJson: z.array(z.unknown()).default([]),
  body: z.string().optional(),
  account: z.string().optional(),
});

// Integration schemas
export const integrationConnectSchema = z.object({
  channel: z.enum(['whatsapp', 'instagram', 'facebook', 'meta']),
  mode: z.enum(['official', 'non_official']).optional(),
  provider: z.enum(['openbsp', 'evolution', 'session_login', 'oauth_meta']).optional(),
});

export const integrationConfigSchema = z.object({
  channel: z.enum(['whatsapp', 'instagram', 'facebook', 'meta']),
  config: z.record(z.string(), z.unknown()),
});

// Query params
export const searchParamsSchema = z.object({
  q: z.string().max(200).optional(),
  status: z.string().max(50).optional(),
  channel: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

// Error response format
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});