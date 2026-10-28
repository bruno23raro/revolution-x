import { encryptToken, decryptToken } from './token-encryption';

// PBKDF2 100k iterations: cada operação leva centenas de ms no CI.
jest.setTimeout(30000);

describe('token-encryption (PBKDF2 + AES-GCM por usuário)', () => {
  const USER = 'user-abc-123';
  const TOKEN = 'EAAG...token-meta-com-mais-de-50-caracteres...xyz';

  it('round-trip encrypt -> decrypt', async () => {
    const enc = await encryptToken(TOKEN, USER);
    expect(enc).not.toContain(TOKEN);
    expect(enc.split(':')).toHaveLength(4);
    expect(await decryptToken(enc, USER)).toBe(TOKEN);
  });

  it('IV/salt aleatórios: duas cifragens do mesmo token diferem', async () => {
    const a = await encryptToken(TOKEN, USER);
    const b = await encryptToken(TOKEN, USER);
    expect(a).not.toBe(b);
    expect(await decryptToken(a, USER)).toBe(await decryptToken(b, USER));
  });

  it('userId errado não decriptografa', async () => {
    const enc = await encryptToken(TOKEN, USER);
    await expect(decryptToken(enc, 'outro-user')).rejects.toThrow();
  });

  it('ciphertext adulterado é rejeitado (tag GCM)', async () => {
    const enc = await encryptToken(TOKEN, USER);
    const parts = enc.split(':');
    const ct = parts[2];
    parts[2] = (ct[0] === 'a' ? 'b' : 'a') + ct.slice(1);
    await expect(decryptToken(parts.join(':'), USER)).rejects.toThrow();
  });

  it('formato inválido / hex inválido lançam', async () => {
    await expect(decryptToken('só-uma-parte', USER)).rejects.toThrow();
    await expect(decryptToken('zz:00:00:00', USER)).rejects.toThrow();
  });

  it('entradas vazias lançam', async () => {
    await expect(encryptToken('', USER)).rejects.toThrow();
    await expect(encryptToken(TOKEN, '')).rejects.toThrow();
  });

  it('token unicode sobrevive ao round-trip', async () => {
    const t = 'tokéñ-çã✓-😀';
    expect(await decryptToken(await encryptToken(t, USER), USER)).toBe(t);
  });
});
