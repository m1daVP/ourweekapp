<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import { useLocalizationStore } from '@/app/stores/localization';
import { reminderDayOptions, useRemindersStore } from '@/app/stores/reminders';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { canPurchasePremium } from '@/features/access/premiumPurchasePolicy';
import AccountSettingsSection from '@/features/auth/components/AccountSettingsSection.vue';
import { featureAccessConfig } from '@/features/access/featureAccess.config';
import type { FeatureKey } from '@/features/access/types';
import {
  isSupportedLocale,
  localeNames,
  supportedLocales,
} from '@/features/localization/locale';
import type { SupportedLocale } from '@/features/localization/types';
import HouseholdMembersSettings from '@/features/participants/components/HouseholdMembersSettings.vue';
import type { ReminderDay } from '@/features/reminders/types';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import SelectPickerField from '@/shared/components/SelectPickerField.vue';
import TimePickerField from '@/shared/components/TimePickerField.vue';
import UpgradePrompt from '@/shared/components/UpgradePrompt.vue';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';
import { useNotifications } from '@/shared/composables/useNotifications';
import { useToast } from '@/shared/composables/useToast';
import { useInAppNotification } from '@/shared/composables/useInAppNotification';
import { appConfig } from '@/shared/config/env';

const route = useRoute();
const { t } = useI18n();
const authStore = useAuthStore();
const localizationStore = useLocalizationStore();
const remindersStore = useRemindersStore();
const subscriptionStore = useSubscriptionStore();
const workspaceStore = useWorkspaceStore();
const { canUseFeature } = useFeatureAccess();
const { showToast } = useToast();
const { showInAppNotification } = useInAppNotification();
const {
  clearLastError,
  disableReminders,
  enableReminders,
  isAvailable: notificationsAvailable,
  lastError: notificationError,
  lastReminderResult,
  permissionStatus,
  syncPermissionStatus,
} = useNotifications();

void syncPermissionStatus();

watch(
  () => subscriptionStore.statusMessage,
  (message) => {
    if (!message) {
      return;
    }

    showInAppNotification(message);
    subscriptionStore.clearStatusMessage();
  },
  { immediate: true }
);

watch(
  () => subscriptionStore.errorMessage,
  (message) => {
    if (!message) {
      return;
    }

    showInAppNotification(message, { tone: 'error' });
    subscriptionStore.clearErrorMessage();
  },
  { immediate: true }
);

watch(
  () => notificationError.value,
  (message) => {
    if (!message) {
      return;
    }

    showInAppNotification(message, { tone: 'error' });
    clearLastError();
  },
  { immediate: true }
);

const isReminderSheetOpen = ref(false);
const isLanguageSheetOpen = ref(false);
const timeInputStep = 300;
const appVersion =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__.trim()
    ? __APP_VERSION__
    : '';
const localizedReminderDayOptions = computed(() =>
  reminderDayOptions.map((option) => ({
    ...option,
    label: t(`days.${option.value}`),
  }))
);
const localeOptions = supportedLocales.map((locale) => ({
  value: locale,
  label: localeNames[locale],
}));
const currentLocaleLabel = computed(
  () => localeNames[localizationStore.locale]
);
const canUseReminders = computed(() => canUseFeature('agreementReminders'));
const hasPremium = computed(() => subscriptionStore.hasPremiumEntitlement);
const isWorkspaceOwner = computed(() =>
  canPurchasePremium(workspaceStore.currentUserRole)
);
const canRestorePurchases = computed(() => appConfig.isRevenueCatEnabled);
const currentPlanLabel = computed(() =>
  hasPremium.value ? t('settings.plan.premium') : t('settings.plan.free')
);
const subscriptionPlanTitle = computed(() =>
  t('settings.currentPlanName', {
    plan: currentPlanLabel.value,
  })
);
const accountStatusText = computed(() => {
  if (authStore.isAuthenticated) {
    return t('settings.signedInAs', {
      email: authStore.user?.email ?? t('settings.signedInFallback'),
    });
  }

  return t('settings.noAccount');
});
const subscriptionRenewalLabel = computed(() => {
  const expiresAt = subscriptionStore.premiumEntitlement?.expiresAt;

  return expiresAt ? formatDate(expiresAt) : t('account.renewalUnavailable');
});
const subscriptionManagementLabel = computed(() =>
  subscriptionStore.canManageSubscription
    ? t('account.manageAvailable')
    : t('account.manageUnavailable')
);
const reminderStatusText = computed(() => {
  if (!canUseReminders.value) {
    return t('settings.reminderLocked');
  }

  if (!remindersStore.settings.enabled) {
    return t('settings.remindersOff');
  }

  if (!notificationsAvailable.value) {
    return t('settings.notificationsUnavailable');
  }

  if (permissionStatus.value === 'denied') {
    return t('settings.notificationsBlocked');
  }

  if (lastReminderResult.value?.scheduled) {
    return t('settings.remindersScheduled');
  }

  return t('settings.remindersSaved');
});
const lockedFeature = computed(() => {
  const value = route.query.lockedFeature;

  if (typeof value !== 'string') {
    return undefined;
  }

  if (!Object.prototype.hasOwnProperty.call(featureAccessConfig, value)) {
    return undefined;
  }

  return value as FeatureKey;
});

function toReminderDay(value: string) {
  return reminderDayOptions.some((option) => option.value === value)
    ? (value as ReminderDay)
    : 'sunday';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(localizationStore.locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

async function handleReminderEnabledChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const enabled = input.checked;

  if (enabled) {
    const result = await enableReminders();

    if (result === 'permission-denied') {
      input.checked = false;
      await showToast(t('notifications.permissionDeclined'));
    } else if (result === 'error' || result === 'premium-only') {
      input.checked = false;
    }

    return;
  }

  await disableReminders();
}

function updateWeeklyMeetingReminderDay(day: string) {
  remindersStore.updateWeeklyMeetingReminder({
    day: toReminderDay(day),
  });
}

function updateWeeklyMeetingReminderTime(time: string) {
  remindersStore.updateWeeklyMeetingReminder({
    time,
  });
}

function updateUnfinishedTaskReminderDay(day: string) {
  remindersStore.updateUnfinishedTaskReminder({
    day: toReminderDay(day),
  });
}

function updateUnfinishedTaskReminderTime(time: string) {
  remindersStore.updateUnfinishedTaskReminder({
    time,
  });
}

function updateLocale(locale: SupportedLocale) {
  if (isSupportedLocale(locale)) {
    localizationStore.setLocale(locale);
    isLanguageSheetOpen.value = false;
  }
}

function openReminderSheet() {
  if (canUseReminders.value) {
    isReminderSheetOpen.value = true;
  }
}
</script>

<template>
  <section class="settings-redesign">
    <HouseholdMembersSettings />

    <section class="settings-redesign-section">
      <h2 class="settings-redesign-section__title">
        {{ t('settings.sections.preferences') }}
      </h2>

      <div class="settings-redesign-card settings-redesign-card--flush">
        <RouterLink
          class="settings-redesign-row"
          :to="{ name: 'calendar-sync' }"
        >
          <span class="settings-redesign-row__icon material-symbols-outlined">
            calendar_month
          </span>
          <span class="settings-redesign-row__body">
            <span class="settings-redesign-row__title">
              {{ t('settings.calendarSync') }}
              <span class="settings-premium-badge">
                {{ t('settings.premiumBadge') }}
              </span>
            </span>
            <span class="settings-redesign-row__text">
              {{ t('settings.calendarSyncSubtitle') }}
            </span>
          </span>
          <span
            class="settings-redesign-row__chevron material-symbols-outlined"
          >
            chevron_right
          </span>
        </RouterLink>

        <div class="settings-redesign-row settings-redesign-row--control">
          <button
            class="settings-redesign-row__main"
            type="button"
            :disabled="!canUseReminders"
            @click="openReminderSheet"
          >
            <span class="settings-redesign-row__icon material-symbols-outlined">
              notifications
            </span>
            <span class="settings-redesign-row__body">
              <span class="settings-redesign-row__title">
                {{ t('settings.reminderNotifications') }}
              </span>
              <span class="settings-redesign-row__text">
                {{ t('settings.reminderNotificationsSubtitle') }}
              </span>
            </span>
          </button>

          <label class="settings-toggle">
            <span class="sr-only">{{ t('settings.enableReminders') }}</span>
            <input
              type="checkbox"
              :checked="remindersStore.settings.enabled"
              :disabled="!canUseReminders"
              @change="handleReminderEnabledChange"
            />
            <span aria-hidden="true" />
          </label>
        </div>

        <button
          class="settings-redesign-row"
          type="button"
          @click="isLanguageSheetOpen = true"
        >
          <span class="settings-redesign-row__icon material-symbols-outlined">
            translate
          </span>
          <span class="settings-redesign-row__body">
            <span class="settings-redesign-row__title">
              {{ t('localization.title') }}
            </span>
            <span class="settings-redesign-row__text">
              {{ currentLocaleLabel }}
            </span>
          </span>
          <span
            class="settings-redesign-row__chevron material-symbols-outlined"
          >
            chevron_right
          </span>
        </button>
      </div>
    </section>

    <section class="settings-redesign-section">
      <h2 class="settings-redesign-section__title">
        {{ t('settings.sections.subscription') }}
      </h2>

      <article class="settings-subscription-card">
        <div class="settings-subscription-card__content">
          <span class="settings-field-label">
            {{ t('settings.currentPlan') }}
          </span>
          <h3>{{ subscriptionPlanTitle }}</h3>
        </div>

        <ul class="settings-subscription-benefits">
          <li>
            <span
              class="material-symbols-outlined settings-subscription-benefit__icon"
              :class="{
                'settings-subscription-benefit__icon--locked': !hasPremium,
              }"
              aria-hidden="true"
              data-testid="subscription-benefit-icon"
            >
              {{ hasPremium ? 'check' : 'lock' }}
            </span>
            {{ t('settings.subscriptionBenefits.aiSummaries') }}
          </li>
          <li>
            <span
              class="material-symbols-outlined settings-subscription-benefit__icon"
              :class="{
                'settings-subscription-benefit__icon--locked': !hasPremium,
              }"
              aria-hidden="true"
              data-testid="subscription-benefit-icon"
            >
              {{ hasPremium ? 'check' : 'lock' }}
            </span>
            {{ t('settings.subscriptionBenefits.calendarSync') }}
          </li>
          <li>
            <span
              class="material-symbols-outlined settings-subscription-benefit__icon"
              :class="{
                'settings-subscription-benefit__icon--locked': !hasPremium,
              }"
              aria-hidden="true"
              data-testid="subscription-benefit-icon"
            >
              {{ hasPremium ? 'check' : 'lock' }}
            </span>
            {{ t('settings.subscriptionBenefits.export') }}
          </li>
        </ul>

        <dl class="subscription-status-list">
          <div>
            <dt>{{ t('account.renewal') }}</dt>
            <dd>{{ subscriptionRenewalLabel }}</dd>
          </div>
          <div>
            <dt>{{ t('account.manageSubscription') }}</dt>
            <dd>{{ subscriptionManagementLabel }}</dd>
          </div>
        </dl>

        <button
          v-if="
            hasPremium &&
            isWorkspaceOwner &&
            subscriptionStore.canManageSubscription
          "
          class="settings-subscription-card__button"
          type="button"
          data-testid="manage-subscription"
          :disabled="subscriptionStore.isManaging"
          @click="subscriptionStore.manageSubscription()"
        >
          {{ t('common.manageSubscription') }}
        </button>
        <RouterLink
          v-else-if="!hasPremium && isWorkspaceOwner"
          class="settings-subscription-card__button"
          :to="{ name: 'upgrade' }"
        >
          {{ t('settings.upgradeToPremium') }}
        </RouterLink>
        <p v-else-if="!hasPremium" class="settings-subscription-card__note">
          {{ t('settings.subscriptionOwnerManaged') }}
        </p>
        <button
          v-if="isWorkspaceOwner"
          class="settings-subscription-card__secondary-action"
          type="button"
          data-testid="restore-purchases"
          :disabled="subscriptionStore.isRestoring || !canRestorePurchases"
          @click="subscriptionStore.restorePurchases()"
        >
          {{ t('common.restorePurchases') }}
        </button>
      </article>
    </section>

    <AccountSettingsSection />

    <section class="settings-redesign-section">
      <h2 class="settings-redesign-section__title">
        {{ t('settings.sections.supportLegal') }}
      </h2>

      <div class="settings-redesign-card settings-redesign-card--flush">
        <a
          v-if="appConfig.contactEmail"
          class="settings-redesign-row settings-redesign-row--trailing-icon"
          :href="`mailto:${appConfig.contactEmail}`"
        >
          <span class="settings-redesign-row__body">
            <span class="settings-redesign-row__title">
              {{ t('settings.contactUs') }}
            </span>
            <span class="settings-redesign-row__text">
              {{ t('settings.contactUsText') }}
            </span>
          </span>
          <span
            class="settings-redesign-row__chevron material-symbols-outlined"
            aria-hidden="true"
          >
            mail
          </span>
        </a>
        <RouterLink
          class="settings-redesign-row settings-redesign-row--trailing-icon"
          :to="{ name: 'privacy' }"
        >
          <span class="settings-redesign-row__body">
            <span class="settings-redesign-row__title">
              {{ t('settings.privacyPolicy') }}
            </span>
          </span>
          <span
            class="settings-redesign-row__chevron material-symbols-outlined"
          >
            chevron_right
          </span>
        </RouterLink>
        <RouterLink
          class="settings-redesign-row settings-redesign-row--trailing-icon"
          :to="{ name: 'terms' }"
        >
          <span class="settings-redesign-row__body">
            <span class="settings-redesign-row__title">
              {{ t('settings.terms') }}
            </span>
          </span>
          <span
            class="settings-redesign-row__chevron material-symbols-outlined"
          >
            chevron_right
          </span>
        </RouterLink>
      </div>
    </section>

    <section class="settings-footer">
      <div class="settings-account-summary">
        <span>{{ t('settings.account') }}</span>
        <small>{{ accountStatusText }}</small>
      </div>

      <RouterLink
        v-if="authStore.isAuthenticated"
        class="settings-sign-out-link"
        :to="{ name: 'logout' }"
      >
        <span class="material-symbols-outlined" aria-hidden="true">logout</span>
        {{ t('common.logOut') }}
      </RouterLink>

      <p v-if="appVersion" class="settings-version">
        {{ t('settings.version', { version: appVersion }) }}
      </p>
    </section>

    <UpgradePrompt v-if="lockedFeature" :feature="lockedFeature" />

    <BaseBottomSheet
      :open="isReminderSheetOpen"
      :title="t('settings.reminderDetails')"
      @close="isReminderSheetOpen = false"
    >
      <div class="settings-reminder-sheet">
        <!-- <p class="settings-reminder-sheet__intro">
          {{ t('settings.reminderIntro') }}
        </p> -->

        <div class="reminder-grid">
          <fieldset class="reminder-fieldset">
            <legend>{{ t('settings.weeklyMeetingReminder') }}</legend>
            <label>
              <span>{{ t('settings.day') }}</span>
              <SelectPickerField
                :model-value="remindersStore.settings.weeklyMeetingReminder.day"
                :label="t('settings.day')"
                :options="localizedReminderDayOptions"
                @update:model-value="updateWeeklyMeetingReminderDay"
              />
            </label>
            <label>
              <span>{{ t('settings.time') }}</span>
              <TimePickerField
                :model-value="
                  remindersStore.settings.weeklyMeetingReminder.time
                "
                :label="t('settings.time')"
                :step-minutes="timeInputStep / 60"
                @update:model-value="updateWeeklyMeetingReminderTime"
              />
            </label>
          </fieldset>

          <fieldset class="reminder-fieldset">
            <legend>{{ t('settings.unfinishedTaskReminder') }}</legend>
            <label>
              <span>{{ t('settings.day') }}</span>
              <SelectPickerField
                :model-value="
                  remindersStore.settings.unfinishedTaskReminder.day
                "
                :label="t('settings.day')"
                :options="localizedReminderDayOptions"
                @update:model-value="updateUnfinishedTaskReminderDay"
              />
            </label>
            <label>
              <span>{{ t('settings.time') }}</span>
              <TimePickerField
                :model-value="
                  remindersStore.settings.unfinishedTaskReminder.time
                "
                :label="t('settings.time')"
                :step-minutes="timeInputStep / 60"
                @update:model-value="updateUnfinishedTaskReminderTime"
              />
            </label>
          </fieldset>
        </div>

        <!-- <p class="meeting-help">{{ t('settings.reminderExample') }}</p> -->
        <p class="meeting-status" role="status">{{ reminderStatusText }}</p>
      </div>
    </BaseBottomSheet>

    <BaseBottomSheet
      :open="isLanguageSheetOpen"
      :title="t('settings.languageSheetTitle')"
      @close="isLanguageSheetOpen = false"
    >
      <div class="settings-language-list">
        <button
          v-for="locale in localeOptions"
          :key="locale.value"
          type="button"
          :class="[
            'settings-language-option',
            {
              'settings-language-option--active':
                locale.value === localizationStore.locale,
            },
          ]"
          @click="updateLocale(locale.value)"
        >
          <span>{{ locale.label }}</span>
          <span
            v-if="locale.value === localizationStore.locale"
            class="material-symbols-outlined"
            aria-hidden="true"
          >
            check
          </span>
        </button>
      </div>
    </BaseBottomSheet>
  </section>
</template>
