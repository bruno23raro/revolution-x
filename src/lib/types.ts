// Tipos compartilhados para o projeto Revolution X

// WhatsApp types
export interface WhatsappTemplate {
  id: string;
  organizationId: string;
  metaTemplateId?: string | null;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  componentsJson: any[];
  rejectionReason?: string | null;
  qualityScore?: number;
  lastCheckedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateHeader {
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  example?: string;
  mediaHandle?: string;
}

export interface TemplateBody {
  text: string;
  example?: string[];
}

export interface TemplateFooter {
  text: string;
}

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTP';
  text: string;
  subType?: 'reply' | 'url' | 'phone' | 'copy_code' | 'otp';
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' | 'EXAMPLES';
  header?: TemplateHeader;
  body: TemplateBody;
  footer?: TemplateFooter;
  buttons?: TemplateButton[];
  example?: { BODY: string[][] };
}

export interface TemplateCreateRequest {
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components: TemplateComponent[];
}

export interface TemplatePreviewData {
  header?: {
    format: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    mediaHandle?: string;
  };
  body: string;
  footer?: string;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTP';
    text: string;
    value?: string;
  }>;
}

// CRM types
export interface Pipeline {
  id: string;
  organizationId: string;
  name: string;
  stages: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  organizationId: string;
  email?: string | null;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phone?: string | null;
  waId?: string | null;
  externalId?: string | null;
  source?: string | null;
  tags?: string[] | null;
  customFields?: Record<string, unknown> | null;
  preferences?: Record<string, unknown> | null;
  consentMarketing: boolean;
  consentSource?: string | null;
  consentAt?: string | null;
  optOut: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  organizationId: string;
  contactId?: string | null;
  source: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  organizationId: string;
  contactId?: string | null;
  pipelineId?: string | null;
  title: string;
  value: number;
  stage: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  leadId?: string | null;
  lead?: Lead | null;
}

export interface Product {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  price?: number | null;
  category?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Media {
  id: string;
  organizationId: string;
  url?: string | null;
  type?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string | null;
  organizationId: string;
  role: string;
  organizationMembers?: Array<{ organizationId: string; role: string }>;
}

// Auth types
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  organizationId: string;
  role: string;
}

// Auth types
export interface JWTPayload {
  sub: string;
  fid?: string;
  role?: string;
  organizationId?: string;
}

export interface TokenFamily {
  familyId: string;
  createdAt: number;
  revokedAt?: number;
}