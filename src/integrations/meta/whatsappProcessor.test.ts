// src/integrations/meta/whatsappProcessor.test.ts
import { processWhatsAppPayload } from './whatsappProcessor';

describe('whatsappProcessor', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      contact: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      message: {
        create: jest.fn(),
      },
    };
  });

  it('should process a valid text message and create a contact if it does not exist', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '16505551111',
                  phone_number_id: '123456789',
                },
                contacts: [
                  {
                    profile: { name: 'John Doe' },
                    wa_id: '1234567890',
                  },
                ],
                messages: [
                  {
                    from: '1234567890',
                    id: 'wamid.HBgLMTIzNDU2Nzg5MFVVAAYSMRFDRThCOERCM0VDN0NCNTI3AA==',
                    timestamp: '1666887588',
                    text: { body: 'Hello world' },
                    type: 'text',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    mockPrisma.contact.findFirst.mockResolvedValue(null);
    mockPrisma.contact.create.mockResolvedValue({
      id: 'contact-123',
      name: 'John Doe',
      waId: '1234567890',
    });
    mockPrisma.message.create.mockResolvedValue({ id: 'msg-123' });

    const results = await processWhatsAppPayload(payload, 'org-123', mockPrisma);

    expect(results[0].success).toBe(true);
    expect(results[0].contactId).toBe('contact-123');
    expect(results[0].messageId).toBe('msg-123');
    expect(mockPrisma.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'John Doe',
          waId: '1234567890',
          email: null,
        }),
      })
    );
    expect(mockPrisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: 'Hello world',
          fromChannel: 'whatsapp',
          direction: 'inbound',
          status: 'received',
          externalId: 'wamid.HBgLMTIzNDU2Nzg5MFVVAAYSMRFDRThCOERCM0VDN0NCNTI3AA==',
          contactId: 'contact-123',
        }),
      })
    );
  });

  it('should reuse existing contact', async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '123456789' },
                messages: [
                  {
                    from: '1234567890',
                    text: { body: 'Again' },
                    id: 'mid2',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    mockPrisma.contact.findFirst.mockResolvedValue({ id: 'existing-contact-id' });
    mockPrisma.message.create.mockResolvedValue({ id: 'msg-456' });

    const results = await processWhatsAppPayload(payload, 'org-123', mockPrisma);

    expect(mockPrisma.contact.create).not.toHaveBeenCalled();
    expect(results[0].success).toBe(true);
    expect(results[0].contactId).toBe('existing-contact-id');
    expect(mockPrisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-123',
          contactId: 'existing-contact-id',
        }),
      })
    );
  });

  it('should handle invalid payload structure gracefully', async () => {
    const invalidPayload = { invalid: 'payload' };
    const results = await processWhatsAppPayload(invalidPayload, 'org-123', mockPrisma);
    expect(results).toEqual([{ success: false, error: 'invalid_payload_structure' }]);
  });

  it('should return error if wa_id is missing', async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ text: { body: 'No sender' } }],
              },
            },
          ],
        },
      ],
    };
    const results = await processWhatsAppPayload(payload, 'org-123', mockPrisma);
    expect(results).toEqual([{ success: false, error: 'missing_wa_id' }]);
  });

  it('should strictly isolate data by organizationId', async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: '5511999999999', text: { body: 'Secret' } }],
              },
            },
          ],
        },
      ],
    };

    mockPrisma.contact.findFirst.mockResolvedValue(null);
    mockPrisma.contact.create.mockResolvedValue({ id: 'c-tenant-B' });
    mockPrisma.message.create.mockResolvedValue({ id: 'm-tenant-B' });

    await processWhatsAppPayload(payload, 'tenant-B', mockPrisma);

    // Verify contact lookup only queries within tenant-B
    expect(mockPrisma.contact.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'tenant-B', waId: '5511999999999' },
      select: { id: true },
    });

    // Verify contact create belongs to tenant-B
    expect(mockPrisma.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'tenant-B' }),
      })
    );

    // Verify message create belongs to tenant-B
    expect(mockPrisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'tenant-B', contactId: 'c-tenant-B' }),
      })
    );
  });
});
