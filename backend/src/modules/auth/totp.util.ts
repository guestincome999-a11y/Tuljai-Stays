import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function createTotpUri(secret: string, account: string): string {
  const issuer = 'Tuljai Stays Admin';
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  const normalized = code.replace(/\s/gu, '');
  if (!/^\d{6}$/u.test(normalized)) return false;
  const counter = Math.floor(now / 1000 / 30);
  for (let offset = -1; offset <= 1; offset += 1) {
    if (totp(secret, counter + offset) === normalized) return true;
  }
  return false;
}

export function encryptTotpSecret(secret: string, keyMaterial: string): string {
  const key = createHash('sha256').update(keyMaterial).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${tag.toString('base64url')}`;
}

export function decryptTotpSecret(payload: string, keyMaterial: string): string {
  const [ivText, ciphertextText, tagText] = payload.split('.');
  if (!ivText || !ciphertextText || !tagText) throw new Error('Invalid encrypted TOTP secret');
  const key = createHash('sha256').update(keyMaterial).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function totp(secret: string, counter: number): string {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter), 0);
  const digest = createHmac('sha1', key).update(buffer).digest();
  const lastDigestByte = digest[digest.length - 1];
  if (lastDigestByte === undefined) throw new Error('Invalid TOTP digest');
  const offset = lastDigestByte & 0x0f;
  const byte0 = digest[offset];
  const byte1 = digest[offset + 1];
  const byte2 = digest[offset + 2];
  const byte3 = digest[offset + 3];
  if (byte0 === undefined || byte1 === undefined || byte2 === undefined || byte3 === undefined) {
    throw new Error('Invalid TOTP digest offset');
  }
  const value =
    ((byte0 & 0x7f) << 24) |
    (byte1 << 16) |
    (byte2 << 8) |
    byte3;
  return String(value % 1_000_000).padStart(6, '0');
}

function encodeBase32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value: string): Buffer {
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const char of value.replace(/=+$/u, '').toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Invalid TOTP secret');
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
