import { encryptToken, decryptToken } from './encryption';

describe('encryption', () => {
  const originalKey = process.env.META_TOKEN_ENCRYPTION_KEY;
  beforeAll(() => { process.env.META_TOKEN_ENCRYPTION_KEY = 'test-key-must-be-at-least-32-characters!!'; });
  beforeEach(() => { process.env.META_TOKEN_ENCRYPTION_KEY = 'test-key-must-be-at-least-32-characters!!'; });
  it('encrypt/decrypt', () => { const c = encryptToken('secret'); expect(decryptToken(c)).toBe('secret'); });
  it('invalid token', () => { expect(() => decryptToken('bad')).toThrow(); });
  it('missing key', () => { const old = process.env.META_TOKEN_ENCRYPTION_KEY; delete process.env.META_TOKEN_ENCRYPTION_KEY; expect(() => encryptToken('x')).toThrow(); process.env.META_TOKEN_ENCRYPTION_KEY = old; });
  it('corruption', () => {
    const c = encryptToken('secret');
    // IV (16 bytes) é aleatório por execução; flipar o 1º hex do IV é a
    // corrupção determinística que rompe a autenticação GCM (a tag cobre o IV).
    const corrupted = (c[0] === 'a' ? 'b' : 'a') + c.slice(1);
    expect(() => decryptToken(corrupted)).toThrow();
  });
});
