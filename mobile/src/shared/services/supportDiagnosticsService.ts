import { Capacitor } from '@capacitor/core';
import { useAuthStore, type AuthErrorDiagnostics } from '@/app/stores/auth';
import { useLocalizationStore } from '@/app/stores/localization';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { appConfig } from '@/shared/config/env';
import {
  getBackendHealthSummary,
  type HealthCheckResult,
  type HealthStatusDto,
  type ReadinessStatusDto,
} from '@/shared/api/healthApi';
import {
  getAggregateSyncStatus,
  type AggregateSyncStatus,
} from '@/shared/services/syncService';
import { storageRecoveryState } from '@/shared/services/storageService';
import {
  createRedactedJson,
  redactSensitiveValue,
} from '@/shared/services/redactionService';
import { nowIso } from '@/shared/utils/dates';

type AccountDiagnosticsState = 'signed_in' | 'guest' | 'loading' | 'error';

interface BackendHealthDiagnostics {
  health: HealthCheckResult<HealthStatusDto>;
  liveness: HealthCheckResult<HealthStatusDto>;
  readiness: HealthCheckResult<ReadinessStatusDto>;
}

export interface SupportDiagnostics {
  generatedAt: string;
  app: {
    environment: string;
    backendOrigin: string;
  };
  device: {
    platform: string;
    native: boolean;
    online: boolean | null;
    language: string | null;
  };
  account: {
    state: AccountDiagnosticsState;
    role: string | null;
    lastAuthError: AuthErrorDiagnostics | null;
  };
  subscription: {
    plan: string;
    premiumEntitlement: boolean;
    canManageSubscription: boolean;
  };
  localization: {
    locale: string;
  };
  sync: AggregateSyncStatus;
  storage: {
    hasIssue: boolean;
    messageCount: number;
    backupCount: number;
  };
  backend: BackendHealthDiagnostics;
}

export type SupportDiagnosticsInput = Omit<
  SupportDiagnostics,
  'generatedAt'
> & {
  generatedAt?: string;
};

function getBackendOrigin() {
  try {
    return new URL(appConfig.apiBaseUrl).origin;
  } catch {
    return '';
  }
}

function getDeviceDiagnostics() {
  const hasNavigator = typeof navigator !== 'undefined';

  return {
    platform: Capacitor.getPlatform(),
    native: Capacitor.isNativePlatform(),
    online: hasNavigator ? navigator.onLine : null,
    language: hasNavigator ? navigator.language : null,
  };
}

function getAccountState(): AccountDiagnosticsState {
  const authStore = useAuthStore();

  if (authStore.isAuthenticated) {
    return 'signed_in';
  }

  if (authStore.authStatus === 'loading') {
    return 'loading';
  }

  if (authStore.authStatus === 'error') {
    return 'error';
  }

  return 'guest';
}

export function createSupportDiagnosticsSnapshot(
  input: SupportDiagnosticsInput
): SupportDiagnostics {
  return createAllowedSupportDiagnostics({
    generatedAt: input.generatedAt ?? nowIso(),
    ...input,
  });
}

export async function collectSupportDiagnostics(): Promise<SupportDiagnostics> {
  const authStore = useAuthStore();
  const subscriptionStore = useSubscriptionStore();
  const workspaceStore = useWorkspaceStore();
  const localizationStore = useLocalizationStore();
  const backend = await getBackendHealthSummary();

  return createSupportDiagnosticsSnapshot({
    app: {
      environment: appConfig.appEnvironment,
      backendOrigin: getBackendOrigin(),
    },
    device: getDeviceDiagnostics(),
    account: {
      state: getAccountState(),
      role: authStore.isAuthenticated ? workspaceStore.currentUserRole : null,
      lastAuthError: authStore.lastAuthError,
    },
    subscription: {
      plan: subscriptionStore.currentPlan,
      premiumEntitlement: subscriptionStore.hasPremiumEntitlement,
      canManageSubscription: subscriptionStore.canManageSubscription,
    },
    localization: {
      locale: localizationStore.locale,
    },
    sync: getAggregateSyncStatus(),
    storage: {
      hasIssue: storageRecoveryState.value.hasIssue,
      messageCount: storageRecoveryState.value.messages.length,
      backupCount: storageRecoveryState.value.backupKeys.length,
    },
    backend,
  });
}

export function serializeSupportDiagnostics(diagnostics: SupportDiagnostics) {
  return createRedactedJson(createAllowedSupportDiagnostics(diagnostics));
}

function createAllowedHealthResult<TData>(
  result: HealthCheckResult<TData>,
  data: TData | undefined
): HealthCheckResult<TData> {
  return {
    state: result.state,
    ...(typeof result.httpStatus === 'number'
      ? { httpStatus: result.httpStatus }
      : {}),
    ...(data ? { data } : {}),
  };
}

function createAllowedHealthStatus(
  data: HealthStatusDto | undefined
): HealthStatusDto | undefined {
  if (!data) {
    return undefined;
  }

  return {
    status: data.status,
    uptime: data.uptime,
  };
}

function createAllowedReadinessStatus(
  data: ReadinessStatusDto | undefined
): ReadinessStatusDto | undefined {
  if (!data) {
    return undefined;
  }

  return {
    status: data.status,
    uptime: data.uptime,
    checks: Object.fromEntries(
      Object.entries(data.checks).map(([key, value]) => [key, value])
    ),
  };
}

function createAllowedSupportDiagnostics(
  diagnostics: SupportDiagnostics
): SupportDiagnostics {
  return redactSensitiveValue({
    generatedAt: diagnostics.generatedAt,
    app: {
      environment: diagnostics.app.environment,
      backendOrigin: diagnostics.app.backendOrigin,
    },
    device: {
      platform: diagnostics.device.platform,
      native: diagnostics.device.native,
      online: diagnostics.device.online,
      language: diagnostics.device.language,
    },
    account: {
      state: diagnostics.account.state,
      role: diagnostics.account.role,
      lastAuthError: diagnostics.account.lastAuthError,
    },
    subscription: {
      plan: diagnostics.subscription.plan,
      premiumEntitlement: diagnostics.subscription.premiumEntitlement,
      canManageSubscription: diagnostics.subscription.canManageSubscription,
    },
    localization: {
      locale: diagnostics.localization.locale,
    },
    sync: {
      state: diagnostics.sync.state,
      resources: diagnostics.sync.resources,
      conflictCount: diagnostics.sync.conflictCount,
      lastSyncedAt: diagnostics.sync.lastSyncedAt,
      lastAttemptedAt: diagnostics.sync.lastAttemptedAt,
      errorMessage: diagnostics.sync.errorMessage,
    },
    storage: {
      hasIssue: diagnostics.storage.hasIssue,
      messageCount: diagnostics.storage.messageCount,
      backupCount: diagnostics.storage.backupCount,
    },
    backend: {
      health: createAllowedHealthResult(
        diagnostics.backend.health,
        createAllowedHealthStatus(diagnostics.backend.health.data)
      ),
      liveness: createAllowedHealthResult(
        diagnostics.backend.liveness,
        createAllowedHealthStatus(diagnostics.backend.liveness.data)
      ),
      readiness: createAllowedHealthResult(
        diagnostics.backend.readiness,
        createAllowedReadinessStatus(diagnostics.backend.readiness.data)
      ),
    },
  }) as SupportDiagnostics;
}
