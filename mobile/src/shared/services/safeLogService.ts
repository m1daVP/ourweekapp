import { redactSensitiveValue } from '@/shared/services/redactionService';

export function warnSafely(message: string, ...details: unknown[]) {
  if (!import.meta.env.DEV) {
    return;
  }

  console.warn(message, ...details.map(redactSensitiveValue));
}
