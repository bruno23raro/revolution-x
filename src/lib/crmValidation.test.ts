// TESTE UNITÁRIO — CRM validações (independente de banco)
import { validateContact, validateLead, validateDeal, validatePipeline } from '../services/crmService';

describe('CRM validations', () => {
  it('contact requires valid email and name', () => {
    expect(validateContact({ email: 'bad', name: '' })).toContain('invalid_email');
    expect(validateContact({ email: 'a@b.c', name: 'X' })).toHaveLength(0);
  });
  it('lead validates status', () => {
    expect(validateLead({ status: 'bad' })).toContain('invalid_status');
    expect(validateLead({ status: 'new' })).toHaveLength(0);
  });
  it('deal validates title/value/stage', () => {
    expect(validateDeal({ title: '', value: -1, stage: 'bad' })).toEqual(
      expect.arrayContaining(['title_required', 'value_negative', 'invalid_stage'])
    );
  });
  it('pipeline validates name', () => {
    expect(validatePipeline({ name: '' })).toContain('name_required');
  });
});
