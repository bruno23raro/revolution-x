import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
function getKey(): string | undefined {
  return process.env.META_TOKEN_ENCRYPTION_KEY;
}

export function encryptToken(plaintext: string): string {
  const KEY = getKey();
  if (!KEY || KEY.length < 32) throw new Error('META_TOKEN_ENCRYPTION_KEY missing');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decryptToken(ciphertext: string): string {
  const KEY = getKey();
  if (!KEY || KEY.length < 32) throw new Error('META_TOKEN_ENCRYPTION_KEY missing');
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('invalid ciphertext');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY.slice(0, 32)), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
