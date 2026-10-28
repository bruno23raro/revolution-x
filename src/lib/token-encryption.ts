// Criptografia de tokens por usuário (AES-GCM) com chave derivada via PBKDF2.
//
// Formato armazenado no Supabase (tudo hex, separado por ':'):
//   salt:iv:ciphertext:authTag
//
// A chave NUNCA é armazenada: é derivada de (userId como senha PBKDF2 + salt
// aleatório guardado junto do ciphertext). Trocar a senha do usuário invalida
// tokens cifrados com a chave antiga → exigir reautenticação do provedor.
//
// Funciona em browser (Web Crypto) e Node >= 16 (webcrypto) — inclusive no
// ambiente do Jest. Para decriptografia server-side com a chave estática
// legacy (META_TOKEN_ENCRYPTION_KEY) existe `src/lib/encryption.ts`.

const webcrypto: Crypto =
  (globalThis as { crypto?: Crypto }).crypto?.subtle
    ? (globalThis as { crypto: Crypto }).crypto
    : // Node 16/18: subtle não exposto no global — usar o import de baixo
      require('crypto').webcrypto;

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit — recomendado para GCM
const SALT_LENGTH = 32;
const TAG_BYTES = 16;
const PBKDF2_ITERATIONS = 100_000;

function randomBytes(n: number): Uint8Array {
  return webcrypto.getRandomValues(new Uint8Array(n));
}

function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function fromHex(s: string): Uint8Array {
  if (!/^([0-9a-fA-F]{2})*$/.test(s)) throw new Error('hex inválido');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Deriva a chave AES-GCM do usuário: PBKDF2(userId, salt). */
async function deriveKey(userId: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(userId),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Cifra um token (access_token / refresh_token) para armazenamento.
 * Retorna `salt:iv:ciphertext:authTag` (hex). Somente este resultado
 * deve ser gravado no Supabase — nunca o token puro.
 */
export async function encryptToken(token: string, userId: string): Promise<string> {
  if (!token) throw new Error('token vazio');
  if (!userId) throw new Error('userId vazio');
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = await deriveKey(userId, salt);

  // Web Crypto concatena o authTag (16 bytes) ao fim do ciphertext.
  const sealed = new Uint8Array(
    await webcrypto.subtle.encrypt({ name: ALGORITHM, iv }, key, new TextEncoder().encode(token)),
  );
  const ciphertext = sealed.slice(0, -TAG_BYTES);
  const authTag = sealed.slice(-TAG_BYTES);

  return [toHex(salt), toHex(iv), toHex(ciphertext), toHex(authTag)].join(':');
}

/**
 * Decriptografa um token cifrado por `encryptToken`.
 * Lança se o formato for inválido, o userId não bater ou o ciphertext
 * tiver sido adulterado (a tag GCM cobre IV + ciphertext).
 */
export async function decryptToken(encrypted: string, userId: string): Promise<string> {
  const parts = encrypted.split(':');
  if (parts.length !== 4) throw new Error('formato inválido de token cifrado');

  let salt: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array, authTag: Uint8Array;
  try {
    salt = fromHex(parts[0]);
    iv = fromHex(parts[1]);
    ciphertext = fromHex(parts[2]);
    authTag = fromHex(parts[3]);
  } catch {
    throw new Error('formato inválido de token cifrado');
  }

  const key = await deriveKey(userId, salt);

  // Rejunta ciphertext + authTag para o Web Crypto.
  const sealed = new Uint8Array(ciphertext.length + authTag.length);
  sealed.set(ciphertext, 0);
  sealed.set(authTag, ciphertext.length);

  let plain: ArrayBuffer;
  try {
    plain = await webcrypto.subtle.decrypt({ name: ALGORITHM, iv }, key, sealed);
  } catch {
    throw new Error('falha ao decriptografar token');
  }
  return new TextDecoder().decode(plain);
}
