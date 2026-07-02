<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  collectSupportDiagnostics,
  serializeSupportDiagnostics,
  type SupportDiagnostics,
} from '@/shared/services/supportDiagnosticsService';
import type { HealthCheckState } from '@/shared/api/healthApi';

const { t, locale } = useI18n();
const diagnostics = ref<SupportDiagnostics | null>(null);
const isLoading = ref(false);
const loadError = ref('');
const copyStatus = ref('');
const fallbackDiagnostics = ref('');
const showCopyFallback = ref(false);

const serializedDiagnostics = computed(() =>
  diagnostics.value ? serializeSupportDiagnostics(diagnostics.value) : ''
);

function formatDateTime(value?: string) {
  if (!value) {
    return t('common.notAvailable');
  }

  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatBoolean(value: boolean) {
  return value ? t('supportDiagnostics.yes') : t('supportDiagnostics.no');
}

function formatOptionalBoolean(value: boolean | null) {
  if (value === null) {
    return t('common.notAvailable');
  }

  return formatBoolean(value);
}

function healthStateLabel(state?: HealthCheckState) {
  if (!state) {
    return t('common.notAvailable');
  }

  return t(`supportDiagnostics.backendStates.${state}`);
}

function formatLastAuthError(
  error?: SupportDiagnostics['account']['lastAuthError']
) {
  if (!error) {
    return t('supportDiagnostics.authIssueNone');
  }

  const parts = [
    error.source,
    error.status ? String(error.status) : null,
    error.code,
    error.name,
    error.hasDetails ? t('supportDiagnostics.authIssueHasDetails') : null,
  ];

  return parts.filter(Boolean).join(' / ');
}

async function refreshDiagnostics() {
  isLoading.value = true;
  loadError.value = '';
  copyStatus.value = '';
  showCopyFallback.value = false;

  try {
    diagnostics.value = await collectSupportDiagnostics();
  } catch (error) {
    void error;
    loadError.value = t('supportDiagnostics.refreshFailed');
  } finally {
    isLoading.value = false;
  }
}

async function copyDiagnostics() {
  if (!serializedDiagnostics.value) {
    return;
  }

  copyStatus.value = '';
  showCopyFallback.value = false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(serializedDiagnostics.value);
      copyStatus.value = t('supportDiagnostics.copied');
      return;
    } catch (error) {
      void error;
    }
  }

  fallbackDiagnostics.value = serializedDiagnostics.value;
  showCopyFallback.value = true;
  copyStatus.value = t('supportDiagnostics.copyFallback');
}

onMounted(() => {
  void refreshDiagnostics();
});
</script>

<template>
  <section class="page-stack support-diagnostics-page">
    <div>
      <p class="page-kicker">{{ t('supportDiagnostics.kicker') }}</p>
      <h1>{{ t('supportDiagnostics.title') }}</h1>
      <p class="page-copy">{{ t('supportDiagnostics.intro') }}</p>
    </div>

    <section class="content-panel settings-panel">
      <div>
        <h2>{{ t('supportDiagnostics.appStatus') }}</h2>
        <p>{{ t('supportDiagnostics.privacyNote') }}</p>
      </div>
      <dl class="diagnostics-list">
        <div>
          <dt>{{ t('supportDiagnostics.environment') }}</dt>
          <dd>
            {{ diagnostics?.app.environment ?? t('common.notAvailable') }}
          </dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.backendOrigin') }}</dt>
          <dd>
            {{ diagnostics?.app.backendOrigin ?? t('common.notAvailable') }}
          </dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.platform') }}</dt>
          <dd>
            {{ diagnostics?.device.platform ?? t('common.notAvailable') }}
          </dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.online') }}</dt>
          <dd>
            {{ formatOptionalBoolean(diagnostics?.device.online ?? null) }}
          </dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.accountState') }}</dt>
          <dd>
            {{
              diagnostics
                ? t(
                    `supportDiagnostics.accountStates.${diagnostics.account.state}`
                  )
                : t('common.notAvailable')
            }}
          </dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.lastAuthIssue') }}</dt>
          <dd>{{ formatLastAuthError(diagnostics?.account.lastAuthError) }}</dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.plan') }}</dt>
          <dd>
            {{ diagnostics?.subscription.plan ?? t('common.notAvailable') }}
          </dd>
        </div>
      </dl>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>{{ t('supportDiagnostics.syncStatus') }}</h2>
        <p>{{ t('supportDiagnostics.syncHelp') }}</p>
      </div>
      <dl class="diagnostics-list">
        <div>
          <dt>{{ t('common.status') }}</dt>
          <dd>
            {{
              diagnostics
                ? t(`sync.${diagnostics.sync.state}`)
                : t('common.notAvailable')
            }}
          </dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.conflicts') }}</dt>
          <dd>{{ diagnostics?.sync.conflictCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.lastAttempted') }}</dt>
          <dd>{{ formatDateTime(diagnostics?.sync.lastAttemptedAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.lastSynced') }}</dt>
          <dd>{{ formatDateTime(diagnostics?.sync.lastSyncedAt) }}</dd>
        </div>
      </dl>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>{{ t('supportDiagnostics.backendStatus') }}</h2>
        <p>{{ t('supportDiagnostics.backendHelp') }}</p>
      </div>
      <dl class="diagnostics-list">
        <div>
          <dt>{{ t('supportDiagnostics.health') }}</dt>
          <dd>{{ healthStateLabel(diagnostics?.backend.health.state) }}</dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.liveness') }}</dt>
          <dd>{{ healthStateLabel(diagnostics?.backend.liveness.state) }}</dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.readiness') }}</dt>
          <dd>{{ healthStateLabel(diagnostics?.backend.readiness.state) }}</dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.database') }}</dt>
          <dd>
            {{
              diagnostics?.backend.readiness.data?.checks.database ??
              t('common.notAvailable')
            }}
          </dd>
        </div>
      </dl>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>{{ t('supportDiagnostics.storageStatus') }}</h2>
        <p>{{ t('supportDiagnostics.storageHelp') }}</p>
      </div>
      <dl class="diagnostics-list">
        <div>
          <dt>{{ t('supportDiagnostics.storageIssue') }}</dt>
          <dd>{{ formatBoolean(diagnostics?.storage.hasIssue ?? false) }}</dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.storageMessages') }}</dt>
          <dd>{{ diagnostics?.storage.messageCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.storageBackups') }}</dt>
          <dd>{{ diagnostics?.storage.backupCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>{{ t('supportDiagnostics.generatedAt') }}</dt>
          <dd>{{ formatDateTime(diagnostics?.generatedAt) }}</dd>
        </div>
      </dl>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>{{ t('supportDiagnostics.shareTitle') }}</h2>
        <p>{{ t('supportDiagnostics.shareHelp') }}</p>
      </div>
      <div class="diagnostics-actions">
        <button
          class="secondary-button"
          type="button"
          :disabled="isLoading"
          @click="refreshDiagnostics"
        >
          {{
            isLoading
              ? t('supportDiagnostics.refreshing')
              : t('supportDiagnostics.refresh')
          }}
        </button>
        <button
          class="meeting-primary"
          type="button"
          :disabled="isLoading || !diagnostics"
          @click="copyDiagnostics"
        >
          {{ t('supportDiagnostics.copy') }}
        </button>
      </div>
      <p v-if="loadError" class="meeting-error" role="alert">
        {{ loadError }}
      </p>
      <p v-if="copyStatus" class="meeting-status" role="status">
        {{ copyStatus }}
      </p>
      <label v-if="showCopyFallback" class="diagnostics-fallback">
        <span>{{ t('supportDiagnostics.fallbackLabel') }}</span>
        <textarea readonly :value="fallbackDiagnostics" />
      </label>
    </section>
  </section>
</template>

<style scoped>
.support-diagnostics-page {
  padding-bottom: var(--space-4);
}

.diagnostics-list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
}

.diagnostics-list > div {
  display: grid;
  gap: var(--space-1);
}

.diagnostics-list dt {
  color: var(--color-muted);
  font-size: var(--font-size-label-lg);
}

.diagnostics-list dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.diagnostics-actions {
  display: grid;
  gap: var(--space-3);
}

.diagnostics-fallback {
  display: grid;
  gap: var(--space-2);
}

.diagnostics-fallback textarea {
  min-height: 180px;
  resize: vertical;
}
</style>
