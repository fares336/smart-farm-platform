import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newDeviceUid() {
  const bytes = crypto.randomBytes(8);
  return 'SF-' + Array.from(bytes, (b: number) => ALPHABET[b % ALPHABET.length]).join('');
}

export function newDeviceKey() {
  const key = `sfk_${crypto.randomBytes(24).toString('base64url')}`;
  return { key, prefix: key.slice(0, 10), hash: hashKey(key) };
}

export function hashKey(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function keyMatches(key: string, hash: string) {
  const a = Buffer.from(hashKey(key), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
