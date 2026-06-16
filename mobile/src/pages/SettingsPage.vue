<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import { useLocalizationStore } from '@/app/stores/localization';
import { reminderDayOptions, useRemindersStore } from '@/app/stores/reminders';
import {
  featureAccessConfig,
  premiumFeatureKeys,
} from '@/features/access/featureAccess.config';
import type { FeatureKey, UserRole } from '@/features/access/types';
import type { ReminderDay } from '@/features/reminders/types';
import {
  isSupportedLocale,
  localeNames,
  supportedLocales,
} from '@/features/localization/locale';
import HouseholdMembersSettings from '@/features/participants/components/HouseholdMembersSettings.vue';
import PremiumLock from '@/shared/components/PremiumLock.vue';
import UpgradePrompt from '@/shared/components/UpgradePrompt.vue';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';
import { useNotifications } from '@/shared/composables/useNotifications';
import { appConfig } from '@/shared/config/env';

const route = useRoute();
const { t } = useI18n();
const authStore = useAuthStore();
const localizationStore = useLocalizationStore();
const { userRole, canUseFeature, getFeatureAccess, setMockRole } =
  useFeatureAccess();
const remindersStore = useRemindersStore();
const {
  disableReminders,
  enableReminders,
  isAvailable: notificationsAvailable,
  lastError: notificationError,
  lastReminderResult,
  permissionStatus,
  syncPermissionStatus,
} = useNotifications();

void syncPermissionStatus();

const roleOptions = computed<Array<{ label: string; value: UserRole }>>(() => [
  { label: t('settings.role.owner'), value: 'owner' },
  { label: t('settings.role.adultMember'), value: 'adult_member' },
  { label: t('settings.role.viewer'), value: 'viewer' },
]);
const timeInputStep = 300;
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
const premiumFeatures = computed(() =>
  premiumFeatureKeys.map((featureKey) => ({
    key: featureKey,
    access: getFeatureAccess(featureKey),
  }))
);
const canShowDevelopmentMockUi = computed(
  () => appConfig.isDevelopmentMockUiEnabled
);

const canUseReminders = computed(() => canUseFeature('agreementReminders'));
const canShowCalendarSync = computed(
  () => appConfig.isGoogleCalendarSyncEnabled
);
const accountStatusText = computed(() => {
  if (authStore.isAuthenticated) {
    return t('settings.signedInAs', {
      email: authStore.user?.email ?? t('settings.signedInFallback'),
    });
  }

  if (authStore.isLocalOnly) {
    return t('settings.localOnly');
  }

  return t('settings.noAccount');
});
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

async function handleReminderEnabledChange(event: Event) {
  const enabled = (event.target as HTMLInputElement).checked;

  if (enabled) {
    await enableReminders();
    return;
  }

  await disableReminders();
}

function updateWeeklyMeetingReminderDay(event: Event) {
  remindersStore.updateWeeklyMeetingReminder({
    day: toReminderDay((event.target as HTMLSelectElement).value),
  });
}

function updateWeeklyMeetingReminderTime(event: Event) {
  remindersStore.updateWeeklyMeetingReminder({
    time: (event.target as HTMLInputElement).value,
  });
}

function updateUnfinishedTaskReminderDay(event: Event) {
  remindersStore.updateUnfinishedTaskReminder({
    day: toReminderDay((event.target as HTMLSelectElement).value),
  });
}

function updateUnfinishedTaskReminderTime(event: Event) {
  remindersStore.updateUnfinishedTaskReminder({
    time: (event.target as HTMLInputElement).value,
  });
}

function updateLocale(event: Event) {
  const value = (event.target as HTMLSelectElement).value;

  if (isSupportedLocale(value)) {
    localizationStore.setLocale(value);
  }
}
</script>

<template>
  <section class="page-stack">
    <div>
      <p class="page-kicker">{{ t('settings.kicker') }}</p>
      <h1>{{ t('settings.title') }}</h1>
      <p class="page-copy">{{ t('settings.intro') }}</p>
    </div>

    <section class="content-panel settings-panel">
      <div>
        <h2>{{ t('localization.title') }}</h2>
        <p>{{ t('localization.description') }}</p>
      </div>
      <label>
        <span>{{ t('localization.label') }}</span>
        <select :value="localizationStore.locale" @change="updateLocale">
          <option
            v-for="locale in localeOptions"
            :key="locale.value"
            :value="locale.value"
          >
            {{ locale.label }}
          </option>
        </select>
      </label>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>{{ t('settings.account') }}</h2>
        <p>{{ accountStatusText }}</p>
      </div>
      <RouterLink
        v-if="authStore.isAuthenticated"
        class="secondary-button link-button"
        :to="{ name: 'account' }"
      >
        {{ t('settings.accountSettings') }}
      </RouterLink>
      <RouterLink
        v-else
        class="secondary-button link-button"
        :to="{ name: 'welcome' }"
      >
        {{ t('settings.accountOptions') }}
      </RouterLink>
      <RouterLink
        class="secondary-button link-button"
        :to="{ name: 'workspace-settings' }"
      >
        {{ t('settings.workspaceSettings') }}
      </RouterLink>
      <RouterLink
        v-if="canShowCalendarSync"
        class="secondary-button link-button"
        :to="{ name: 'calendar-sync' }"
      >
        {{ t('settings.calendarSync') }}
      </RouterLink>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>{{ t('settings.support') }}</h2>
        <p>{{ t('settings.supportText') }}</p>
      </div>
      <RouterLink
        class="secondary-button link-button"
        :to="{ name: 'support-diagnostics' }"
      >
        {{ t('settings.supportDiagnostics') }}
      </RouterLink>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>{{ t('settings.legal') }}</h2>
        <p>{{ t('settings.legalText') }}</p>
      </div>
      <RouterLink
        class="secondary-button link-button"
        :to="{ name: 'privacy' }"
      >
        {{ t('settings.privacyPolicy') }}
      </RouterLink>
      <RouterLink class="secondary-button link-button" :to="{ name: 'terms' }">
        {{ t('settings.terms') }}
      </RouterLink>
    </section>

    <PremiumLock
      feature="agreementReminders"
      :title="t('settings.reminderPremiumTitle')"
      :message="t('settings.reminderPremiumMessage')"
    >
      <section class="content-panel settings-panel reminder-panel">
        <div>
          <h2>{{ t('settings.reminders') }}</h2>
          <p>{{ t('settings.reminderIntro') }}</p>
        </div>

        <label class="reminder-toggle">
          <input
            type="checkbox"
            :checked="remindersStore.settings.enabled"
            @change="handleReminderEnabledChange"
          />
          <span>{{ t('settings.enableReminders') }}</span>
        </label>

        <div class="reminder-grid">
          <fieldset class="reminder-fieldset">
            <legend>{{ t('settings.weeklyMeetingReminder') }}</legend>
            <label>
              <span>{{ t('settings.day') }}</span>
              <select
                :value="remindersStore.settings.weeklyMeetingReminder.day"
                @change="updateWeeklyMeetingReminderDay"
              >
                <option
                  v-for="day in localizedReminderDayOptions"
                  :key="day.value"
                  :value="day.value"
                >
                  {{ day.label }}
                </option>
              </select>
            </label>
            <label>
              <span>{{ t('settings.time') }}</span>
              <input
                type="time"
                :step="timeInputStep"
                :value="remindersStore.settings.weeklyMeetingReminder.time"
                @change="updateWeeklyMeetingReminderTime"
              />
            </label>
          </fieldset>

          <fieldset class="reminder-fieldset">
            <legend>{{ t('settings.unfinishedTaskReminder') }}</legend>
            <label>
              <span>{{ t('settings.day') }}</span>
              <select
                :value="remindersStore.settings.unfinishedTaskReminder.day"
                @change="updateUnfinishedTaskReminderDay"
              >
                <option
                  v-for="day in localizedReminderDayOptions"
                  :key="day.value"
                  :value="day.value"
                >
                  {{ day.label }}
                </option>
              </select>
            </label>
            <label>
              <span>{{ t('settings.time') }}</span>
              <input
                type="time"
                :step="timeInputStep"
                :value="remindersStore.settings.unfinishedTaskReminder.time"
                @change="updateUnfinishedTaskReminderTime"
              />
            </label>
          </fieldset>
        </div>

        <p class="meeting-help">
          {{ t('settings.reminderExample') }}
        </p>
        <p class="meeting-status" role="status">{{ reminderStatusText }}</p>
        <p v-if="notificationError" class="meeting-error" role="status">
          {{ notificationError }}
        </p>
      </section>
    </PremiumLock>

    <HouseholdMembersSettings />

    <UpgradePrompt v-if="lockedFeature" :feature="lockedFeature" />

    <div v-if="canShowDevelopmentMockUi" class="content-panel settings-panel">
      <h2>{{ t('settings.mockWorkspaceRole') }}</h2>
      <div class="role-grid">
        <button
          v-for="role in roleOptions"
          :key="role.value"
          type="button"
          :class="['role-option', { 'is-active': userRole === role.value }]"
          @click="setMockRole(role.value)"
        >
          {{ role.label }}
        </button>
      </div>
    </div>

    <div v-if="canShowDevelopmentMockUi" class="content-panel settings-panel">
      <h2>{{ t('settings.premiumFeatureChecks') }}</h2>
      <ul class="feature-list">
        <li v-for="feature in premiumFeatures" :key="feature.key">
          <div>
            <strong>{{ feature.access.label }}</strong>
            <p>{{ feature.access.description }}</p>
          </div>
          <span
            :class="[
              'feature-status',
              { 'is-available': canUseFeature(feature.key) },
            ]"
          >
            {{
              canUseFeature(feature.key)
                ? t('common.available')
                : t('common.locked')
            }}
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>
