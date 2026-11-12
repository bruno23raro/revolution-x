// Tipos compartilhados para o projeto Revolution X

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