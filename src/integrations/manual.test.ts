// manual.ts — verificação honesta de credencial manual (sem rede: fetch injetado).
import { verifyManualCredential } from './manual';

const TOKEN = 'EAA'.padEnd(40, 'x');

describe('verifyManualCredential', () => {
  const env = process.env;
  beforeEach(() => {
    process.env = { ...env, META_APP_ID: 'app', META_APP_SECRET: 'secret' };
  });
  afterAll(() => {
    process.env = env;
  });

  it('recusa credencial muito curta sem chamar a rede', async () => {
    const f = jest.fn();
    const r = await verifyManualCredential('instagram', 'abc', f as unknown as typeof fetch);
    expect(r).toMatchObject({ valid: false, reason: 'invalid_credential' });
    expect(f).not.toHaveBeenCalled();
  });

  it('cookie e WhatsApp manual => verify_unavailable (sem endpoint de sonda)', async () => {
    const f = jest.fn();
    expect(await verifyManualCredential('whatsapp', TOKEN, f as unknown as typeof fetch, 100, 'cookie'))
      .toMatchObject({ valid: false, reason: 'verify_unavailable' });
    expect(await verifyManualCredential('instagram', TOKEN, f as unknown as typeof fetch, 100, 'cookie'))
      .toMatchObject({ valid: false, reason: 'verify_unavailable' });
    expect(f).not.toHaveBeenCalled();
  });

  it('token valido na Graph API => valid', async () => {
    const f = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { is_valid: true } }) });
    const r = await verifyManualCredential('instagram', TOKEN, f as unknown as typeof fetch);
    expect(r.valid).toBe(true);
    expect(f).toHaveBeenCalledWith(expect.stringContaining('debug_token'), expect.anything());
  });

  it('token invalido => platform_rejected', async () => {
    const f = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { is_valid: false } }) });
    expect(await verifyManualCredential('facebook', TOKEN, f as unknown as typeof fetch))
      .toMatchObject({ valid: false, reason: 'platform_rejected' });
  });

  it('falha de rede => verify_unavailable (nunca afirma invalido sem certeza)', async () => {
    const f = jest.fn().mockRejectedValue(new Error('timeout'));
    expect(await verifyManualCredential('instagram', TOKEN, f as unknown as typeof fetch))
      .toMatchObject({ valid: false, reason: 'verify_unavailable' });
  });
});
