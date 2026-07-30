import { redactSensitiveValue } from '@/shared/services/redactionService';
import { isDebugDiagnosticsEnabled } from '@/shared/services/vconsoleService';

export function debugSafely(message: string, ...details: unknown[]) {
  if (!isDebugDiagnosticsEnabled(import.meta.env)) {
    return;
  }

  console.info(message, ...details.map(redactSensitiveValue));
}

export function warnSafely(message: string, ...details: unknown[]) {
  if (!isDebugDiagnosticsEnabled(import.meta.env)) {
    return;
  }

  console.warn(message, ...details.map(redactSensitiveValue));
}
