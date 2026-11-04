/**
 * Growth CRM System Tests
 *
 * Tests for:
 * - /api/growth/leads (POST, GET)
 * - /api/growth/leads/[id]/status (PUT)
 * - /api/growth/analytics (GET)
 * - /api/webhooks/whatsapp/inbound (POST)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as createLead } from '../../../app/api/growth/leads/route';
import { GET as listLeads } from '../../../app/api/growth/leads/route';
import { PUT as updateStatus } from '../../../app/api/growth/leads/[id]/status/route';
import { GET as getAnalytics } from '../../../app/api/growth/analytics/route';
import { POST as handleInbound } from '../../../app/api/webhooks/whatsapp/inbound/route';
import { createServiceRoleClient } from '@/lib/supabase/server';

// Mock auth
vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: async () => ({
    id: 'test-user-id',
    organizationId: 'test-org-id',
    email: 'test@example.com',
  }),
}));

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
          })),
        })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        insert: vi.fn(() => Promise.resolve({ data: [{ id: 'new-id' }], error: null })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [{ id: 'test-id' }], error: null })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  })),
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => mockSupabase,
}));

describe('Growth CRM System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/growth/leads', () => {
    it('should create a lead', async () => {
      const req = {
        json: () => Promise.resolve({
          contact: '5511987654321',
          source: 'instagram',
          metadata: { name: 'Test Lead' },
        }),
      } as any;

      const response = await createLead(req);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.lead.contact).toBe('5511987654321');
    });

    it('should return 401 if not authenticated', async () => {
      vi.mocked(await import('@/lib/auth')).getAuthenticatedUser = async () => null;

      const req = {
        json: () => Promise.resolve({ contact: '5511987654321' }),
      } as any;

      const response = await createLead(req);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/growth/leads', () => {
    it('should list leads with filters', async () => {
      const req = {
        url: 'http://localhost/api/growth/leads?funnelStatus=pending&limit=50',
      } as any;

      const response = await listLeads(req);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(Array.isArray(data.leads)).toBe(true);
    });
  });

  describe('PUT /api/growth/leads/[id]/status', () => {
    it('should update funnel status', async () => {
      const req = {
        json: () => Promise.resolve({ funnelStatus: 'first_contact' }),
      } as any;

      const response = await updateStatus(req, { params: Promise.resolve({ id: 'test-id' }) });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.lead.funnelStatus).toBe('first_contact');
    });

    it('should return 400 for invalid funnel status', async () => {
      const req = {
        json: () => Promise.resolve({ funnelStatus: 'invalid' }),
      } as any;

      const response = await updateStatus(req, { params: Promise.resolve({ id: 'test-id' }) });
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/growth/analytics', () => {
    it('should return analytics data', async () => {
      const req = {
        url: 'http://localhost/api/growth/analytics?days=30',
      } as any;

      const response = await getAnalytics(req);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.analytics).toBeDefined();
      expect(data.analytics.funnel).toBeDefined();
      expect(data.analytics.messages).toBeDefined();
    });
  });

  describe('POST /api/webhooks/whatsapp/inbound', () => {
    it('should process inbound messages', async () => {
      const req = {
        json: () => Promise.resolve({
          messages: [{
            from: '5511987654321',
            body: 'Hello!',
            id: 'msg-123',
            timestamp: Math.floor(Date.now() / 1000),
          }],
          instanceName: 'test-instance',
        }),
      } as any;

      const response = await handleInbound(req);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.processed).toBe(true);
    });
  });
});
