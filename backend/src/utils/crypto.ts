import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

export function hmacHash(value: string, pepper: string): string {
  return createHmac('sha256', pepper).update(value).digest('hex');
}

export function safeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  try {
    return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
  } catch {
    return false;
  }
}
