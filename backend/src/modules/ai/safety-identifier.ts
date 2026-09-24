import { createHmac } from 'node:crypto';

const SAFETY_IDENTIFIER_PREFIX = 'ow-v1-';
const MINIMUM_SECRET_LENGTH = 32;

export function buildSafetyIdentifier(userId: string, secret: string) {
  if (!userId.trim() || secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error('AI safety identifier configuration is invalid.');
  }

  return `${SAFETY_IDENTIFIER_PREFIX}${createHmac('sha256', secret)
    .update(userId, 'utf8')
    .digest('base64url')}`;
}
