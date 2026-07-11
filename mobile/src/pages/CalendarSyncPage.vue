<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useCalendarSyncStore } from '@/app/stores/calendarSync';
import { parseCalendarCallbackQuery } from '@/features/calendar/services/calendarCallback';
import type { CalendarSyncSettings } from '@/features/calendar/types';
import PremiumLock from '@/shared/components/PremiumLock.vue';
import { useToast } from '@/shared/composables/useToast';

type CalendarSyncOptionKey = keyof Omit<CalendarSyncSettings, 'updatedAt'>;

const calendarSyncStore = useCalendarSyncStore();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { showToast } = useToast();

watch(
  () => route.query,
  (query) => {
    const result = parseCalendarCallbackQuery(query);

    if (!result) {
      return;
    }

    if (result.status === 'connected') {
      void showToast(t('calendar.callback.connected'));
    } else {
      void showToast(t(result.messageKey), {
        tone: 'error',
        durationMs: 3600,
      });
    }

    void calendarSyncStore.initializeCalendarConnection();
    const rest = { ...query };
    delete rest.calendar;
    delete rest.reason;
    void router.replace({ query: rest });
  },
  { immediate: true }
);

void calendarSyncStore.initializeCalendarConnection();

const calendarOptions: Array<{
  key: CalendarSyncOptionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'addWeeklyMeetingReminder',
    label: t('calendar.options.weeklyMeeting.label'),
    description: t('calendar.options.weeklyMeeting.description'),
  },
  {
    key: 'addTaskDueDates',
    label: t('calendar.options.taskDueDates.label'),
    description: t('calendar.options.taskDueDates.description'),
  },
  {
    key: 'addFollowUpDates',
    label: t('calendar.options.followUpDates.label'),
    description: t('calendar.options.followUpDates.description'),
  },
];

const connectionStatusText = computed(() => {
  if (calendarSyncStore.isCheckingConnection) {
    return t('calendar.checkingConnection');
  }

  return (
    calendarSyncStore.connectionStatus?.message ?? t('calendar.notConnected')
  );
});

function updateCalendarOption(key: CalendarSyncOptionKey, event: Event) {
  calendarSyncStore.updateSetting(
    key,
    (event.target as HTMLInputElement).checked
  );
}
</script>

<template>
  <section class="page-stack calendar-sync-page">
    <header>
      <p class="page-kicker">{{ t('calendar.kicker') }}</p>
      <h1>{{ t('calendar.title') }}</h1>
      <p class="page-copy">{{ t('calendar.intro') }}</p>
    </header>

    <PremiumLock
      feature="googleCalendarSync"
      :title="t('calendar.premiumTitle')"
      :message="t('calendar.premiumMessage')"
    >
      <section class="content-panel calendar-sync-panel">
        <div>
          <h2>{{ t('calendar.connectionTitle') }}</h2>
          <p>{{ connectionStatusText }}</p>
        </div>

        <button
          class="meeting-primary"
          type="button"
          :disabled="calendarSyncStore.isConnecting"
          @click="calendarSyncStore.connectCalendar"
        >
          {{
            calendarSyncStore.isConnecting
              ? t('calendar.preparingConnection')
              : t('calendar.connect')
          }}
        </button>

        <button
          v-if="calendarSyncStore.isConnected"
          class="calendar-sync-secondary"
          type="button"
          :disabled="calendarSyncStore.isDisconnecting"
          @click="calendarSyncStore.disconnectCalendar"
        >
          {{ t('calendar.disconnect') }}
        </button>

        <p class="meeting-help">
          {{ t('calendar.noTokens') }}
        </p>
      </section>

      <section class="content-panel calendar-sync-panel">
        <div>
          <h2>{{ t('calendar.optionsTitle') }}</h2>
          <p>{{ t('calendar.optionsText') }}</p>
        </div>

        <div class="calendar-sync-options">
          <label
            v-for="option in calendarOptions"
            :key="option.key"
            class="calendar-sync-option"
          >
            <input
              type="checkbox"
              :checked="calendarSyncStore.settings[option.key]"
              @change="updateCalendarOption(option.key, $event)"
            />
            <span>
              <strong>{{ option.label }}</strong>
              <small>{{ option.description }}</small>
            </span>
          </label>
        </div>

        <p v-if="calendarSyncStore.statusMessage" class="meeting-status">
          {{ calendarSyncStore.statusMessage }}
        </p>
        <p
          v-if="calendarSyncStore.errorMessage"
          class="meeting-error"
          role="alert"
        >
          {{ calendarSyncStore.errorMessage }}
        </p>
      </section>
    </PremiumLock>
  </section>
</template>
