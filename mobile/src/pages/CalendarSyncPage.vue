<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useCalendarSyncStore } from '@/app/stores/calendarSync';
import { parseCalendarCallbackQuery } from '@/features/calendar/services/calendarCallback';
import type { CalendarWeekday } from '@/features/calendar/types';
import PremiumLock from '@/shared/components/PremiumLock.vue';
import ConfirmationDialog from '@/shared/components/ConfirmationDialog.vue';
import SelectPickerField from '@/shared/components/SelectPickerField.vue';
import TimePickerField from '@/shared/components/TimePickerField.vue';
import { useToast } from '@/shared/composables/useToast';
import { useInAppNotification } from '@/shared/composables/useInAppNotification';

const calendarSyncStore = useCalendarSyncStore();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { showToast } = useToast();
const { showInAppNotification } = useInAppNotification();
const isDisconnectConfirmationOpen = ref(false);

watch(
  () => calendarSyncStore.statusMessage,
  (message) => {
    if (!message) {
      return;
    }

    showInAppNotification(message);
    calendarSyncStore.clearStatusMessage();
  },
  { immediate: true }
);

watch(
  () => calendarSyncStore.errorMessage,
  (message) => {
    if (!message) {
      return;
    }

    showInAppNotification(message, { tone: 'error' });
    calendarSyncStore.clearErrorMessage();
  },
  { immediate: true }
);

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
  key: 'weeklyMeetingSyncEnabled' | 'assignedTaskSyncEnabled';
  label: string;
  description: string;
  cleanupDescription: string;
}> = [
  {
    key: 'weeklyMeetingSyncEnabled',
    label: t('calendar.options.weeklyMeeting.label'),
    description: t('calendar.options.weeklyMeeting.description'),
    cleanupDescription: t('calendar.options.weeklyMeeting.cleanupDescription'),
  },
  {
    key: 'assignedTaskSyncEnabled',
    label: t('calendar.options.taskDueDates.label'),
    description: t('calendar.options.taskDueDates.description'),
    cleanupDescription: t('calendar.options.taskDueDates.cleanupDescription'),
  },
];

const calendarWeekdays: CalendarWeekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const weekdayOptions = computed(() =>
  calendarWeekdays.map((value) => ({
    value,
    label: t(`calendar.schedule.weekdays.${value}`),
  }))
);

const connectionStatusText = computed(() => {
  if (calendarSyncStore.isCheckingConnection) {
    return t('calendar.checkingConnection');
  }

  return (
    calendarSyncStore.connectionStatus?.message ?? t('calendar.notConnected')
  );
});

function updateCalendarOption(
  key: 'weeklyMeetingSyncEnabled' | 'assignedTaskSyncEnabled',
  event: Event
) {
  const enabled = (event.target as HTMLInputElement).checked;
  const preferences = calendarSyncStore.connectionStatus?.preferences;
  const payload = {
    [key]: (event.target as HTMLInputElement).checked,
    ...(key === 'weeklyMeetingSyncEnabled'
      ? {
          weeklyMeetingDay: preferences?.weeklyMeetingDay ?? 'sunday',
          weeklyMeetingTime: preferences?.weeklyMeetingTime ?? '18:00',
          timeZone: getDeviceTimeZone(),
        }
      : {}),
  };

  void calendarSyncStore.updateSettings({ ...payload, [key]: enabled });
}

function getDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

function updateWeeklyMeetingSchedule(input: {
  weeklyMeetingDay?: CalendarWeekday;
  weeklyMeetingTime?: string;
}) {
  const preferences = calendarSyncStore.connectionStatus?.preferences;

  void calendarSyncStore.updateSettings({
    weeklyMeetingDay:
      input.weeklyMeetingDay ?? preferences?.weeklyMeetingDay ?? 'sunday',
    weeklyMeetingTime:
      input.weeklyMeetingTime ?? preferences?.weeklyMeetingTime ?? '18:00',
    timeZone: getDeviceTimeZone(),
  });
}

function updateWeeklyMeetingDay(day: CalendarWeekday) {
  updateWeeklyMeetingSchedule({
    weeklyMeetingDay: day,
  });
}

function updateWeeklyMeetingTime(time: string) {
  updateWeeklyMeetingSchedule({
    weeklyMeetingTime: time,
  });
}

function confirmDisconnect() {
  isDisconnectConfirmationOpen.value = false;
  void calendarSyncStore.disconnectCalendar();
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
          <h2>{{ t('calendar.personalConnectionTitle') }}</h2>
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
          @click="isDisconnectConfirmationOpen = true"
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
          <div
            v-for="option in calendarOptions"
            :key="option.key"
            class="calendar-sync-option"
          >
            <label class="calendar-sync-option__toggle">
              <input
                type="checkbox"
                :checked="
                  calendarSyncStore.connectionStatus?.preferences[option.key] ??
                  false
                "
                :disabled="!calendarSyncStore.isConnected"
                @change="updateCalendarOption(option.key, $event)"
              />
              <span>
                <strong>{{ option.label }}</strong>
                <small>{{ option.description }}</small>
                <small>{{ option.cleanupDescription }}</small>
              </span>
            </label>

            <div
              v-if="option.key === 'weeklyMeetingSyncEnabled'"
              class="calendar-weekly-schedule"
            >
              <label>
                <span>{{ t('calendar.schedule.day') }}</span>
                <SelectPickerField
                  data-testid="calendar-weekday"
                  :model-value="
                    calendarSyncStore.connectionStatus?.preferences
                      .weeklyMeetingDay ?? 'sunday'
                  "
                  :label="t('calendar.schedule.day')"
                  :options="weekdayOptions"
                  :disabled="!calendarSyncStore.isConnected"
                  @update:model-value="
                    updateWeeklyMeetingDay($event as CalendarWeekday)
                  "
                />
              </label>

              <label>
                <span>{{ t('calendar.schedule.time') }}</span>
                <TimePickerField
                  data-testid="calendar-time"
                  :model-value="
                    calendarSyncStore.connectionStatus?.preferences
                      .weeklyMeetingTime ?? '18:00'
                  "
                  :label="t('calendar.schedule.time')"
                  :step-minutes="5"
                  :disabled="!calendarSyncStore.isConnected"
                  @update:model-value="updateWeeklyMeetingTime"
                />
              </label>
            </div>
          </div>
        </div>

        <p class="meeting-help">
          {{ t('calendar.sharedItemsNotice') }}
        </p>

        <button
          v-if="
            calendarSyncStore.connectionStatus?.preferences
              .lastSyncErrorCode === 'provider-error'
          "
          class="calendar-sync-secondary"
          type="button"
          @click="calendarSyncStore.retrySync"
        >
          {{ t('calendar.retry') }}
        </button>
      </section>
    </PremiumLock>
    <ConfirmationDialog
      :open="isDisconnectConfirmationOpen"
      :title="t('calendar.disconnectConfirmTitle')"
      :message="t('calendar.disconnectConfirmText')"
      :confirm-label="t('calendar.disconnect')"
      @close="isDisconnectConfirmationOpen = false"
      @confirm="confirmDisconnect"
    />
  </section>
</template>
