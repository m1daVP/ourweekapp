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
import { isNativeGoogleSignInSupported } from '@/features/auth/googleSignInService';
import { cancelReminderNotifications } from '@/features/reminders/reminderService';
import {
  deleteAccount as deleteAccountRequest,
  exportAccountData,
} from '@/shared/api/accountApi';
import ConfirmationDialog from '@/shared/components/ConfirmationDialog.vue';
import { useInAppNotification } from '@/shared/composables/useInAppNotification';
import { saveOrShareExportFile } from '@/shared/services/exportFileDeliveryService';
import { haptics } from '@/shared/services/hapticsService';
import { warnSafely } from '@/shared/services/safeLogService';
import { clearAllLocalAppDataAfterAccountDeletion } from '@/shared/services/storageService';
import { nowIso } from '@/shared/utils/dates';

const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();
const { showInAppNotification } = useInAppNotification();
const isExportingAccount = ref(false);
const isDeletingAccount = ref(false);
const isDeleteAccountDialogOpen = ref(false);
const hasPostDeleteCleanupFailure = ref(false);
const isRetryingLocalCleanup = ref(false);

const user = computed(() => authStore.user);
const signInMethods = computed(() => user.value?.signInMethods ?? []);
const hasGoogleSignIn = computed(() => signInMethods.value.includes('google'));
const canLinkGoogle = computed(
  () => isNativeGoogleSignInSupported() && !hasGoogleSignIn.value
);

async function linkGoogleAccount() {
  const result = await authStore.linkGoogleAccount();

  if (result === 'linked') {
    showInAppNotification(t('account.googleLinked'));
    return;
  }

  if (result === 'failed') {
    const message =
      authStore.googleLinkErrorMessage || t('account.googleLinkFailed');
    showInAppNotification(message, { tone: 'error' });
    authStore.clearGoogleLinkErrorMessage();
  }
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
  isExportingAccount.value = true;

  try {
    const data = await exportAccountData();
    await saveAccountExport(data);
    showInAppNotification(t('account.exportReady'));
  } catch (error) {
    showInAppNotification(
      error instanceof Error ? error.message : t('account.exportFailed'),
      { tone: 'error' }
    );
  } finally {
    isExportingAccount.value = false;
  }
}

async function deleteAccount() {
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
    void haptics.impact();
    await router.replace({ name: 'welcome' });
  } catch (error) {
    if (error instanceof AccountDeletionCleanupError) {
      hasPostDeleteCleanupFailure.value = true;
      return;
    }

    showInAppNotification(t('account.deleteFailed'), { tone: 'error' });
  } finally {
    isDeletingAccount.value = false;
  }
}

async function retryLocalCleanupAfterAccountDeletion() {
  isRetryingLocalCleanup.value = true;

  try {
    await finishLocalCleanupAfterAccountDeletion();
    hasPostDeleteCleanupFailure.value = false;
    await router.replace({ name: 'welcome' });
  } catch {
    showInAppNotification(t('account.cleanupRetryFailed'), { tone: 'error' });
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
  <section
    v-if="hasPostDeleteCleanupFailure"
    class="settings-redesign-section settings-account-section"
  >
    <h2 class="settings-redesign-section__title">
      {{ t('account.cleanupFailedTitle') }}
    </h2>
    <div class="settings-redesign-card settings-panel">
      <p>{{ t('account.cleanupFailedIntro') }}</p>
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
    </div>
  </section>

  <section
    v-else-if="user"
    class="settings-redesign-section settings-account-section"
  >
    <h2 class="settings-redesign-section__title">
      {{ t('account.title') }}
    </h2>

    <div class="settings-account-block">
      <h3 class="settings-redesign-row__title">
        {{ t('account.signInMethods') }}
      </h3>
      <div class="settings-redesign-card settings-panel">
        <p>{{ t('account.signInMethodsHelp') }}</p>
        <ul v-if="signInMethods.length" class="subscription-status-list">
          <li v-if="signInMethods.includes('password')">
            {{ t('account.passwordSignIn') }} ·
            {{ t('account.signInAvailable') }}
          </li>
          <li v-if="hasGoogleSignIn">
            {{ t('account.googleSignIn') }} · {{ t('account.signInConnected') }}
          </li>
        </ul>
        <p v-else>{{ t('account.signInMethodsLoading') }}</p>
        <button
          v-if="canLinkGoogle"
          class="secondary-button"
          type="button"
          data-testid="link-google-account"
          :disabled="authStore.isLinkingGoogle"
          @click="linkGoogleAccount"
        >
          {{
            authStore.isLinkingGoogle
              ? t('account.linkingGoogle')
              : t('account.linkGoogle')
          }}
        </button>
      </div>
    </div>

    <div class="settings-account-block">
      <h3 class="settings-redesign-row__title">
        {{ t('account.dataRights') }}
      </h3>
      <div class="settings-redesign-card settings-panel">
        <p>{{ t('account.dataRightsHelp') }}</p>
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
      </div>
    </div>

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
