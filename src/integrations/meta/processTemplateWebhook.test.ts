// Testes para processTemplateWebhook — webhook de status de templates Meta
// Cobre: transições de status (PENDING -> APPROVED/REJECTED), quality updates

import { processTemplateStatusUpdate, processTemplateQualityUpdate } from './processTemplateWebhook';

// Mock do Prisma
const mockTx = {
  whatsapp_template: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const ORG_ID = 'org-123';

describe('processTemplateStatusUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validação de payload', () => {
    it('retorna erro para campo não sendo message_templates', async () => {
      const payload = { entry: [{ field: 'messages', changes: [] }] };
      const result = await processTemplateStatusUpdate(ORG_ID, payload as any, mockTx as any);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Não é um webhook de template");
    });

    it('retorna sucesso graceful quando template não existe no tenant', async () => {
      const payload = {
        entry: [{
          field: 'message_templates',
          changes: [{
            value: {
              name: 'unknown_template',
              status: 'APPROVED',
              language: { code: 'en_US' },
            },
          }],
        }],
      };

      mockTx.whatsapp_template.findFirst.mockResolvedValue(null);

      const result = await processTemplateStatusUpdate(ORG_ID, payload as any, mockTx as any);
      expect(result.success).toBe(true);
      expect(result.template).toBeUndefined();
      // Não é erro, template pode ser de outro tenant
      expect(mockTx.whatsapp_template.update).not.toHaveBeenCalled();
    });

    it('retorna erro quando nome do template não está no payload', async () => {
      const payload = {
        entry: [{
          field: 'message_templates',
          changes: [{
            value: {
              status: 'APPROVED',
              language: { code: 'en_US' },
            },
          }],
        }],
      };

      const result = await processTemplateStatusUpdate(ORG_ID, payload as any, mockTx as any);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Nome do template não encontrado no payload');
    });
  });

  describe('Transição PENDING -> APPROVED', () => {
    it('atualiza status de PENDING para APPROVED', async () => {
      const payload = {
        entry: [{
          id: 'entry-1',
          field: 'message_templates',
          changes: [{
            value: {
              id: 'meta-tpl-123',
              name: 'welcome_template',
              category: 'UTILITY',
              status: 'APPROVED',
              language: { code: 'pt_BR' },
              quality_score: 4.5,
            },
          }],
        }],
      };

      const existingTemplate = {
        id: 'tpl-456',
        organizationId: ORG_ID,
        name: 'welcome_template',
        language: 'pt_BR',
        status: 'PENDING',
      };

      mockTx.whatsapp_template.findFirst.mockResolvedValue(existingTemplate);
      mockTx.whatsapp_template.update.mockResolvedValue({
        id: 'tpl-456',
        status: 'APPROVED',
        qualityScore: 4.5,
      });

      const result = await processTemplateStatusUpdate(ORG_ID, payload as any, mockTx as any);

      expect(result.success).toBe(true);
      expect(result.template?.status).toBe('APPROVED');
      expect(mockTx.whatsapp_template.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tpl-456' },
          data: expect.objectContaining({
            status: 'APPROVED',
            metaTemplateId: 'meta-tpl-123',
            rejectionReason: null,
            lastCheckedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('captura rejection_reason quando status é REJECTED', async () => {
      const payload = {
        entry: [{
          field: 'message_templates',
          changes: [{
            value: {
              name: 'promo_template',
              status: 'REJECTED',
              rejection_reason: 'Uso de linguagem promocional não aprovada',
              language: { code: 'en_US' },
            },
          }],
        }],
      };

      mockTx.whatsapp_template.findFirst.mockResolvedValue({
        id: 'tpl-789',
        organizationId: ORG_ID,
        name: 'promo_template',
      });

      mockTx.whatsapp_template.update.mockResolvedValue({
        id: 'tpl-789',
        status: 'REJECTED',
        rejectionReason: 'Uso de linguagem promocional não aprovada',
      });

      const result = await processTemplateStatusUpdate(ORG_ID, payload as any, mockTx as any);

      expect(result.success).toBe(true);
      expect(result.template?.rejectionReason).toBe('Uso de linguagem promocional não aprovada');
    });
  });

  describe('Atualização de quality_score', () => {
    it('atualiza quality_score quando fornecido', async () => {
      const payload = {
        entry: [{
          field: 'message_templates',
          changes: [{
            value: {
              name: 'approved_template',
              status: 'APPROVED',
              language: { code: 'en_US' },
              quality_score: 4.8,
            },
          }],
        }],
      };

      mockTx.whatsapp_template.findFirst.mockResolvedValue({
        id: 'tpl-quality',
        organizationId: ORG_ID,
        name: 'approved_template',
        status: 'APPROVED',
      });

      mockTx.whatsapp_template.update.mockResolvedValue({
        id: 'tpl-quality',
        status: 'APPROVED',
      });

      const result = await processTemplateStatusUpdate(ORG_ID, payload as any, mockTx as any);
      expect(result.success).toBe(true);
    });
  });

  describe('Multi-tenant isolation', () => {
    it('busca template apenas dentro do tenant', async () => {
      const payload = {
        entry: [{
          field: 'message_templates',
          changes: [{
            value: {
              name: 'org_specific_template',
              status: 'APPROVED',
              language: { code: 'en_US' },
            },
          }],
        }],
      };

      mockTx.whatsapp_template.findFirst.mockResolvedValue({
        id: 'tpl-tenant',
        organizationId: 'other-tenant', // Diferente do ORG_ID
      });

      const result = await processTemplateStatusUpdate(ORG_ID, payload as any, mockTx as any);
      // Deve encontrar o template e atualizar (isola por organizationId na query)
      expect(mockTx.whatsapp_template.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
          }),
        }),
      );
    });
  });
});

describe('processTemplateQualityUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna erro quando não é webhook de quality', async () => {
    const payload = { entry: [{ field: 'messages', changes: [] }] };
    const result = await processTemplateQualityUpdate(ORG_ID, payload as any, mockTx as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Não é um webhook de qualidade de template');
  });

  it('retorna sucesso quando template não existe', async () => {
    const payload = {
      entry: [{
        field: 'message_template_quality',
        changes: [{
          value: {
            name: 'nonexistent_template',
            quality_score: 3.5,
          },
        }],
      }],
    };

    mockTx.whatsapp_template.findFirst.mockResolvedValue(null);

    const result = await processTemplateQualityUpdate(ORG_ID, payload as any, mockTx as any);
    expect(result.success).toBe(true);
    // Não atualiza se template não existe
    expect(mockTx.whatsapp_template.update).not.toHaveBeenCalled();
  });

  it('atualiza template com quality_score', async () => {
    const payload = {
      entry: [{
        field: 'message_template_quality',
        changes: [{
          value: {
            name: 'quality_template',
            quality_score: 4.9,
          },
        }],
      }],
    };

    mockTx.whatsapp_template.findFirst.mockResolvedValue({
      id: 'tpl-quality-update',
      organizationId: ORG_ID,
      name: 'quality_template',
    });

    mockTx.whatsapp_template.update.mockResolvedValue({
      id: 'tpl-quality-update',
      quality_score: 4.9,
    });

    const result = await processTemplateQualityUpdate(ORG_ID, payload as any, mockTx as any);

    expect(result.success).toBe(true);
    expect(mockTx.whatsapp_template.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tpl-quality-update' },
        data: expect.objectContaining({
          updatedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('retorna sucesso mesmo sem quality_score (apenas log)', async () => {
    const payload = {
      entry: [{
        field: 'message_template_quality',
        changes: [{
          value: {
            name: 'no_score_template',
            // quality_score ausente
          },
        }],
      }],
    };

    mockTx.whatsapp_template.findFirst.mockResolvedValue({
      id: 'tpl-no-score',
      organizationId: ORG_ID,
    });

    const result = await processTemplateQualityUpdate(ORG_ID, payload as any, mockTx as any);
    expect(result.success).toBe(true);
    // Não atualiza quality_score se ausente
    expect(mockTx.whatsapp_template.update).not.toHaveBeenCalled();
  });
});