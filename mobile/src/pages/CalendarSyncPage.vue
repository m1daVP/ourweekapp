<script setup lang="ts">
import { computed } from 'vue';
import { useCalendarSyncStore } from '@/app/stores/calendarSync';
import type { CalendarSyncSettings } from '@/features/calendar/types';
import PremiumLock from '@/shared/components/PremiumLock.vue';

type CalendarSyncOptionKey = keyof Omit<CalendarSyncSettings, 'updatedAt'>;

const calendarSyncStore = useCalendarSyncStore();

void calendarSyncStore.initializeCalendarConnection();

const calendarOptions: Array<{
  key: CalendarSyncOptionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'addWeeklyMeetingReminder',
    label: 'Add weekly meeting reminder to calendar',
    description: 'Create one calendar event for the household check-in.',
  },
  {
    key: 'addTaskDueDates',
    label: 'Add task due dates to calendar',
    description: 'Use due dates from tasks that need a clear follow-up.',
  },
  {
    key: 'addFollowUpDates',
    label: 'Add follow-up dates to calendar',
    description: 'Keep agreed revisit dates visible between meetings.',
  },
];

const connectionStatusText = computed(() => {
  if (calendarSyncStore.isCheckingConnection) {
    return 'Checking Google Calendar connection.';
  }

  return (
    calendarSyncStore.connectionStatus?.message ??
    'Google Calendar is not connected.'
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
      <p class="page-kicker">Calendar sync</p>
      <h1>Google Calendar</h1>
      <p class="page-copy">
        Prepare weekly meetings, task due dates, and follow-ups for calendar
        sync.
      </p>
    </header>

    <section class="content-panel calendar-sync-note">
      <strong>Connection placeholder</strong>
      <p>
        Google OAuth and token handling should be backend-supported or use a
        secure recommended flow before real sync is enabled.
      </p>
    </section>

    <PremiumLock
      feature="googleCalendarSync"
      title="Google Calendar sync is premium"
      message="Upgrade to prepare Weekly Us meetings, task due dates, and follow-ups for Google Calendar."
    >
      <section class="content-panel calendar-sync-panel">
        <div>
          <h2>Google Calendar connection</h2>
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
              ? 'Preparing connection'
              : 'Connect Google Calendar'
          }}
        </button>

        <button
          v-if="calendarSyncStore.isConnected"
          class="calendar-sync-secondary"
          type="button"
          :disabled="calendarSyncStore.isDisconnecting"
          @click="calendarSyncStore.disconnectCalendar"
        >
          Disconnect
        </button>

        <p class="meeting-help">
          No Google tokens are stored in this mobile app.
        </p>
      </section>

      <section class="content-panel calendar-sync-panel">
        <div>
          <h2>Sync options</h2>
          <p>
            Choose what Weekly Us should sync once Google Calendar is ready.
          </p>
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
