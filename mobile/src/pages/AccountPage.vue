<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import { useCalendarSyncStore } from '@/app/stores/calendarSync';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { usePrivateNotesStore } from '@/app/stores/privateNotes';
import { useRemindersStore } from '@/app/stores/reminders';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useTasksStore } from '@/app/stores/tasks';
import { useWorkspaceStore } from '@/app/stores/workspace';
import {
  AccountDeletionCleanupError,
  deleteAccountAndClearLocalData,
} from '@/features/auth/accountDeletionLifecycle';
import { canPurchasePremium } from '@/features/access/premiumPurchasePolicy';
import { PUBLIC_LEGAL_URLS } from '@/features/legal/productionLegalContent';
import { cancelReminderNotifications } from '@/features/reminders/reminderService';
import {
  deleteAccount as deleteAccountRequest,
  exportAccountData,
} from '@/shared/api/accountApi';
import { appConfig } from '@/shared/config/env';
import { saveOrShareExportFile } from '@/shared/services/exportFileDeliveryService';
import { warnSafely } from '@/shared/services/safeLogService';
import { clearAllLocalAppDataAfterAccountDeletion } from '@/shared/services/storageService';
import { nowIso } from '@/shared/utils/dates';
import ConfirmationDialog from '@/shared/components/ConfirmationDialog.vue';
import PremiumBadge from '@/shared/components/PremiumBadge.vue';

const authStore = useAuthStore();
const subscriptionStore = useSubscriptionStore();
const workspaceStore = useWorkspaceStore();
const router = useRouter();
const { t, locale } = useI18n();
const displayName = ref(authStore.user?.displayName ?? '');
const statusMessage = ref('');
const formError = ref('');
const dataActionError = ref('');
const isExportingAccount = ref(false);
const isDeletingAccount = ref(false);
const isDeleteAccountDialogOpen = ref(false);
const hasPostDeleteCleanupFailure = ref(false);
const isRetryingLocalCleanup = ref(false);

const user = computed(() => authStore.user);
const currentPlanLabel = computed(() =>
  subscriptionStore.currentPlan === 'premium'
    ? t('premium.badge')
    : t('common.free')
);
const canRestorePurchases = computed(() => appConfig.isRevenueCatEnabled);
const isWorkspaceOwner = computed(() =>
  canPurchasePremium(workspaceStore.currentUserRole)
);

function formatDate(value?: string) {
  if (!value) {
    return t('common.notAvailable');
  }

  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function saveProfile() {
  statusMessage.value = '';
  formError.value = '';

  if (!displayName.value.trim()) {
    formError.value = t('account.addDisplayName');
    return;
  }

  if (!authStore.updateProfile(displayName.value)) {
    formError.value = t('account.updateFailed');
    return;
  }

  statusMessage.value = t('account.updated');
}

async function saveAccountExport(data: unknown) {
  const exportedAt = nowIso().slice(0, 10);

  return saveOrShareExportFile({
    content: JSON.stringify(data, null, 2),
    fileName: `ourweek-account-export-${exportedAt}.json`,
    mimeType: 'application/json;charset=utf-8',
    title: t('account.exportAccount'),
  });
}

async function exportAccount() {
  dataActionError.value = '';
  statusMessage.value = '';
  isExportingAccount.value = true;

  try {
    const data = await exportAccountData();
    await saveAccountExport(data);
    statusMessage.value = t('account.exportReady');
  } catch (error) {
    dataActionError.value =
      error instanceof Error ? error.message : t('account.exportFailed');
  } finally {
    isExportingAccount.value = false;
  }
}

async function deleteAccount() {
  dataActionError.value = '';
  statusMessage.value = '';
  isDeleteAccountDialogOpen.value = true;
}

function resetInMemoryStoresAfterAccountDeletion() {
  useCalendarSyncStore().$reset();
  useMeetingsStore().$reset();
  useParticipantsStore().$reset();
  usePrivateNotesStore().$reset();
  useRemindersStore().$reset();
  useSubscriptionStore().$reset();
  useTasksStore().$reset();
  useWorkspaceStore().$reset();
}

async function cancelLocalRemindersAfterAccountDeletion() {
  try {
    await cancelReminderNotifications();
  } catch (error) {
    warnSafely('Unable to cancel reminders during account deletion.', error);
  }
}

async function finishLocalCleanupAfterAccountDeletion() {
  await cancelLocalRemindersAfterAccountDeletion();
  await clearAllLocalAppDataAfterAccountDeletion();
  await authStore.clearSessionAfterUnauthorized();
  resetInMemoryStoresAfterAccountDeletion();
}

async function confirmDeleteAccount() {
  dataActionError.value = '';
  statusMessage.value = '';
  isDeleteAccountDialogOpen.value = false;

  isDeletingAccount.value = true;

  try {
    await deleteAccountAndClearLocalData({
      deleteBackendAccount: deleteAccountRequest,
      clearSession: () => authStore.clearSessionAfterUnauthorized(),
      cancelLocalReminders: cancelLocalRemindersAfterAccountDeletion,
      clearLocalAppData: clearAllLocalAppDataAfterAccountDeletion,
      resetInMemoryStores: resetInMemoryStoresAfterAccountDeletion,
    });
    await router.replace({ name: 'welcome' });
  } catch (error) {
    if (error instanceof AccountDeletionCleanupError) {
      hasPostDeleteCleanupFailure.value = true;
      dataActionError.value = '';
      return;
    }

    dataActionError.value = t('account.deleteFailed');
  } finally {
    isDeletingAccount.value = false;
  }
}

async function retryLocalCleanupAfterAccountDeletion() {
  dataActionError.value = '';
  isRetryingLocalCleanup.value = true;

  try {
    await finishLocalCleanupAfterAccountDeletion();
    hasPostDeleteCleanupFailure.value = false;
    await router.replace({ name: 'welcome' });
  } catch {
    dataActionError.value = t('account.cleanupRetryFailed');
  } finally {
    isRetryingLocalCleanup.value = false;
  }
}

async function continueAfterCleanupFailure() {
  await authStore.clearSessionAfterUnauthorized();
  await router.replace({ name: 'welcome' });
}
</script>

<template>
  <section v-if="hasPostDeleteCleanupFailure" class="page-stack account-page">
    <div>
      <p class="page-kicker">{{ t('account.kicker') }}</p>
      <h1>{{ t('account.cleanupFailedTitle') }}</h1>
      <p class="page-copy">{{ t('account.cleanupFailedIntro') }}</p>
    </div>

    <section class="content-panel settings-panel">
      <p>{{ t('account.cleanupFailedHelp') }}</p>
      <button
        class="meeting-primary"
        type="button"
        :disabled="isRetryingLocalCleanup"
        @click="retryLocalCleanupAfterAccountDeletion"
      >
        {{
          isRetryingLocalCleanup
            ? t('account.retryingCleanup')
            : t('account.retryCleanup')
        }}
      </button>
      <button
        class="secondary-button"
        type="button"
        :disabled="isRetryingLocalCleanup"
        @click="continueAfterCleanupFailure"
      >
        {{ t('account.continueWithLocalDataWarning') }}
      </button>
      <p v-if="dataActionError" class="meeting-error" role="alert">
        {{ dataActionError }}
      </p>
    </section>
  </section>

  <section v-else-if="user" class="page-stack account-page">
    <div>
      <p class="page-kicker">{{ t('account.kicker') }}</p>
      <h1>{{ t('account.title') }}</h1>
      <p class="page-copy">{{ t('account.intro') }}</p>
    </div>

    <section class="content-panel account-summary">
      <div>
        <span class="account-label">{{ t('account.signedInAs') }}</span>
        <strong>{{ user.email }}</strong>
      </div>
      <div>
        <span class="account-label">{{ t('account.plan') }}</span>
        <strong>{{ currentPlanLabel }}</strong>
      </div>
      <div>
        <span class="account-label">{{ t('account.created') }}</span>
        <strong>{{ formatDate(user.createdAt) }}</strong>
      </div>
    </section>

    <section class="content-panel settings-panel subscription-status-panel">
      <div>
        <PremiumBadge v-if="subscriptionStore.hasPremiumEntitlement" />
        <h2>{{ t('account.subscription') }}</h2>
        <p>{{ t('account.currentPlan', { plan: currentPlanLabel }) }}</p>
      </div>

      <dl class="subscription-status-list">
        <div>
          <dt>{{ t('account.renewal') }}</dt>
          <dd>
            {{
              subscriptionStore.premiumEntitlement?.expiresAt
                ? formatDate(subscriptionStore.premiumEntitlement.expiresAt)
                : t('account.renewalUnavailable')
            }}
          </dd>
        </div>
        <div>
          <dt>{{ t('account.manageSubscription') }}</dt>
          <dd>
            {{
              subscriptionStore.canManageSubscription
                ? t('account.manageAvailable')
                : t('account.manageUnavailable')
            }}
          </dd>
        </div>
      </dl>

      <RouterLink
        class="secondary-button link-button"
        :to="{ name: 'upgrade' }"
      >
        {{ t('account.viewPremium') }}
      </RouterLink>
      <button
        v-if="isWorkspaceOwner"
        class="secondary-button"
        type="button"
        data-testid="restore-purchases"
        :disabled="subscriptionStore.isRestoring || !canRestorePurchases"
        @click="subscriptionStore.restorePurchases()"
      >
        {{ t('account.restorePurchases') }}
      </button>
      <p
        v-if="isWorkspaceOwner && subscriptionStore.statusMessage"
        class="meeting-status"
        role="status"
      >
        {{ subscriptionStore.statusMessage }}
      </p>
      <p
        v-if="isWorkspaceOwner && subscriptionStore.errorMessage"
        class="meeting-error"
        role="alert"
      >
        {{ subscriptionStore.errorMessage }}
      </p>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>{{ t('account.profile') }}</h2>
        <p>{{ t('account.profileHelp') }}</p>
      </div>
      <form class="auth-form" @submit.prevent="saveProfile">
        <label>
          <span>{{ t('common.displayName') }}</span>
          <input v-model="displayName" type="text" autocomplete="name" />
        </label>
        <p v-if="formError" class="meeting-error" role="alert">
          {{ formError }}
        </p>
        <p v-if="statusMessage" class="meeting-status" role="status">
          {{ statusMessage }}
        </p>
        <button class="meeting-primary" type="submit">
          {{ t('account.saveAccount') }}
        </button>
      </form>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>{{ t('account.dataRights') }}</h2>
        <p>{{ t('account.dataRightsHelp') }}</p>
      </div>
      <button
        class="secondary-button"
        type="button"
        :disabled="isExportingAccount || isDeletingAccount"
        @click="exportAccount"
      >
        {{
          isExportingAccount
            ? t('account.exportingAccount')
            : t('account.exportAccount')
        }}
      </button>
      <button
        class="history-item__delete"
        type="button"
        :disabled="isDeletingAccount || isExportingAccount"
        @click="deleteAccount"
      >
        {{
          isDeletingAccount
            ? t('account.deletingAccount')
            : t('account.deleteAccount')
        }}
      </button>
      <a
        class="secondary-button link-button"
        :href="PUBLIC_LEGAL_URLS.deleteAccount"
        data-testid="external-delete-account"
      >
        Delete account online
      </a>
      <p v-if="dataActionError" class="meeting-error" role="alert">
        {{ dataActionError }}
      </p>
    </section>

    <RouterLink class="secondary-button link-button" :to="{ name: 'logout' }">
      {{ t('account.logOut') }}
    </RouterLink>

    <ConfirmationDialog
      :open="isDeleteAccountDialogOpen"
      :title="t('account.deleteAccountTitle')"
      :message="t('account.deleteAccountConfirm')"
      :confirm-label="t('account.deleteAccount')"
      :loading="isDeletingAccount"
      destructive
      @close="isDeleteAccountDialogOpen = false"
      @confirm="confirmDeleteAccount"
    />
  </section>
</template>
