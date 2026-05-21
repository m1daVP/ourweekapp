<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import { useMeetingsStore } from '@/app/stores/meetings';
import {
  participantColors,
  useParticipantsStore,
} from '@/app/stores/participants';
import { reminderDayOptions, useRemindersStore } from '@/app/stores/reminders';
import { useTasksStore } from '@/app/stores/tasks';
import {
  featureAccessConfig,
  premiumFeatureKeys,
} from '@/features/access/featureAccess.config';
import type { FeatureKey, PlanType, UserRole } from '@/features/access/types';
import type { ReminderDay } from '@/features/reminders/types';
import type { ParticipantType } from '@/features/participants/types';
import PremiumLock from '@/shared/components/PremiumLock.vue';
import UpgradePrompt from '@/shared/components/UpgradePrompt.vue';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';
import { useNotifications } from '@/shared/composables/useNotifications';

const route = useRoute();
const authStore = useAuthStore();
const { planType, userRole, canUseFeature, setMockPlan, setMockRole } =
  useFeatureAccess();
const participantsStore = useParticipantsStore();
const remindersStore = useRemindersStore();
const tasksStore = useTasksStore();
const meetingsStore = useMeetingsStore();
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

participantsStore.ensureDefaultParticipants();

const planOptions: PlanType[] = ['free', 'premium'];
const roleOptions: Array<{ label: string; value: UserRole }> = [
  { label: 'Owner', value: 'owner' },
  { label: 'Adult member', value: 'adult_member' },
  { label: 'Viewer', value: 'viewer' },
];
const timeInputStep = 300;
const typeOptions: Array<{ label: string; value: ParticipantType }> = [
  { label: 'Adult', value: 'adult' },
  { label: 'Child', value: 'child' },
  { label: 'Other', value: 'other' },
];

const participantDraft = reactive({
  name: '',
  initials: '',
  avatarColor: participantColors[0],
  type: 'adult' as ParticipantType,
});
const editDrafts = reactive<
  Record<
    string,
    {
      name: string;
      initials: string;
      avatarColor: string;
      type: ParticipantType;
    }
  >
>({});
const participantMessage = reactive({
  text: '',
  tone: 'status' as 'status' | 'error',
});

const canUseReminders = computed(() => canUseFeature('agreementReminders'));
const accountStatusText = computed(() => {
  if (authStore.isAuthenticated) {
    return `Signed in as ${authStore.user?.email ?? 'your account'}.`;
  }

  if (authStore.isLocalOnly) {
    return 'Using Weekly Us on this device only.';
  }

  return 'No account connected yet.';
});
const reminderStatusText = computed(() => {
  if (!canUseReminders.value) {
    return 'Reminder settings are available with Premium.';
  }

  if (!remindersStore.settings.enabled) {
    return 'Reminders are off.';
  }

  if (!notificationsAvailable.value) {
    return 'Local notifications are available in the Android app. Web dev mode keeps these settings without scheduling notifications.';
  }

  if (permissionStatus.value === 'denied') {
    return 'Notifications are blocked in system settings.';
  }

  if (lastReminderResult.value?.scheduled) {
    return 'Reminders are scheduled on this device.';
  }

  return 'Reminders are saved and will be scheduled when notifications are available.';
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

watch(
  () =>
    participantsStore.participants
      .map((participant) => participant.updatedAt)
      .join('|'),
  () => syncEditDrafts(),
  { immediate: true }
);

function syncEditDrafts() {
  const participantIds = new Set(
    participantsStore.participants.map((participant) => participant.id)
  );

  for (const participant of participantsStore.participants) {
    if (!editDrafts[participant.id]) {
      editDrafts[participant.id] = {
        name: participant.name,
        initials: participant.initials,
        avatarColor: participant.avatarColor,
        type: participant.type,
      };
    }
  }

  for (const participantId of Object.keys(editDrafts)) {
    if (!participantIds.has(participantId)) {
      delete editDrafts[participantId];
    }
  }
}

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

function setParticipantMessage(
  text: string,
  tone: 'status' | 'error' = 'status'
) {
  participantMessage.text = text;
  participantMessage.tone = tone;
}

function createParticipant() {
  const participant = participantsStore.createParticipant({
    name: participantDraft.name,
    initials: participantDraft.initials,
    avatarColor: participantDraft.avatarColor,
    type: participantDraft.type,
  });

  if (!participant) {
    setParticipantMessage('Add a name first.', 'error');
    return;
  }

  meetingsStore.syncActiveMeetingParticipants();
  participantDraft.name = '';
  participantDraft.initials = '';
  participantDraft.avatarColor =
    participantColors[
      participantsStore.participants.length % participantColors.length
    ];
  participantDraft.type = 'adult';
  setParticipantMessage('Participant added.');
}

function saveParticipant(participantId: string) {
  const draft = editDrafts[participantId];

  if (!draft) {
    return;
  }

  const participant = participantsStore.updateParticipant(participantId, draft);

  if (!participant) {
    setParticipantMessage('Add a name first.', 'error');
    return;
  }

  setParticipantMessage('Participant updated.');
}

function participantIsUsed(participantId: string) {
  return (
    tasksStore.tasks.some((task) =>
      task.responsibleParticipantIds.includes(participantId)
    ) ||
    tasksStore.agreements.some((agreement) =>
      agreement.participantIds.includes(participantId)
    ) ||
    meetingsStore.meetings.some((meeting) =>
      meeting.sections.some(
        (section) =>
          section.notes.some((note) => note.participantId === participantId) ||
          section.tasks.some((task) =>
            task.responsibleParticipantIds.includes(participantId)
          ) ||
          section.agreements.some((agreement) =>
            agreement.participantIds.includes(participantId)
          )
      )
    )
  );
}

function disableOrRemoveParticipant(participantId: string) {
  const participant = participantsStore.getParticipantById(participantId);

  if (!participant) {
    return;
  }

  if (participantIsUsed(participantId)) {
    participantsStore.disableParticipant(participantId);
    setParticipantMessage(
      'Participant disabled. Existing records still keep their name.'
    );
    return;
  }

  participantsStore.removeParticipant(participantId);
  setParticipantMessage('Unused participant removed.');
}

function enableParticipant(participantId: string) {
  participantsStore.enableParticipant(participantId);
  meetingsStore.syncActiveMeetingParticipants();
  setParticipantMessage('Participant enabled.');
}
</script>

<template>
  <section class="page-stack">
    <div>
      <p class="page-kicker">Settings</p>
      <h1>Household setup</h1>
      <p class="page-copy">
        Manage the local people list used for notes, tasks, and agreements.
      </p>
    </div>

    <section class="content-panel settings-panel">
      <div>
        <h2>Account</h2>
        <p>{{ accountStatusText }}</p>
      </div>
      <RouterLink
        v-if="authStore.isAuthenticated"
        class="secondary-button link-button"
        :to="{ name: 'account' }"
      >
        Account settings
      </RouterLink>
      <RouterLink
        v-else
        class="secondary-button link-button"
        :to="{ name: 'welcome' }"
      >
        Account options
      </RouterLink>
      <RouterLink
        class="secondary-button link-button"
        :to="{ name: 'workspace-settings' }"
      >
        Workspace settings
      </RouterLink>
    </section>
    <PremiumLock
      feature="agreementReminders"
      title="Reminder settings are premium"
      message="Upgrade to schedule gentle local reminders for weekly meetings and unfinished household follow-ups."
    >
      <section class="content-panel settings-panel reminder-panel">
        <div>
          <h2>Reminders</h2>
          <p>
            Weekly Us can use local device notifications for your meeting and
            unfinished follow-ups. No push notifications or account setup are
            used.
          </p>
        </div>

        <label class="reminder-toggle">
          <input
            type="checkbox"
            :checked="remindersStore.settings.enabled"
            @change="handleReminderEnabledChange"
          />
          <span>Enable reminders</span>
        </label>

        <div class="reminder-grid">
          <fieldset class="reminder-fieldset">
            <legend>Weekly meeting reminder</legend>
            <label>
              <span>Day</span>
              <select
                :value="remindersStore.settings.weeklyMeetingReminder.day"
                @change="updateWeeklyMeetingReminderDay"
              >
                <option
                  v-for="day in reminderDayOptions"
                  :key="day.value"
                  :value="day.value"
                >
                  {{ day.label }}
                </option>
              </select>
            </label>
            <label>
              <span>Time</span>
              <input
                type="time"
                :step="timeInputStep"
                :value="remindersStore.settings.weeklyMeetingReminder.time"
                @change="updateWeeklyMeetingReminderTime"
              />
            </label>
          </fieldset>

          <fieldset class="reminder-fieldset">
            <legend>Unfinished task reminder</legend>
            <label>
              <span>Day</span>
              <select
                :value="remindersStore.settings.unfinishedTaskReminder.day"
                @change="updateUnfinishedTaskReminderDay"
              >
                <option
                  v-for="day in reminderDayOptions"
                  :key="day.value"
                  :value="day.value"
                >
                  {{ day.label }}
                </option>
              </select>
            </label>
            <label>
              <span>Time</span>
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
          Example: A gentle reminder to review unfinished agreements.
        </p>
        <p class="meeting-status" role="status">{{ reminderStatusText }}</p>
        <p v-if="notificationError" class="meeting-error" role="status">
          {{ notificationError }}
        </p>
      </section>
    </PremiumLock>

    <section class="content-panel settings-panel participant-panel">
      <div>
        <h2>Participants</h2>
        <p>Stored on this device for now. No accounts or invitations yet.</p>
      </div>

      <form class="participant-form" @submit.prevent="createParticipant">
        <label>
          <span>Name</span>
          <input
            v-model="participantDraft.name"
            type="text"
            placeholder="Name"
          />
        </label>
        <label>
          <span>Initials</span>
          <input
            v-model="participantDraft.initials"
            type="text"
            maxlength="3"
            placeholder="Auto"
          />
        </label>
        <label>
          <span>Type</span>
          <select v-model="participantDraft.type">
            <option
              v-for="type in typeOptions"
              :key="type.value"
              :value="type.value"
            >
              {{ type.label }}
            </option>
          </select>
        </label>
        <fieldset class="color-selector">
          <legend>Avatar color</legend>
          <label v-for="color in participantColors" :key="color">
            <input
              v-model="participantDraft.avatarColor"
              type="radio"
              :value="color"
            />
            <span :style="{ backgroundColor: color }" />
          </label>
        </fieldset>
        <button class="meeting-primary" type="submit">Add participant</button>
      </form>

      <ul class="participant-list">
        <li
          v-for="participant in participantsStore.participants"
          :key="participant.id"
          :class="{ 'is-disabled': !participant.isActive }"
        >
          <span
            class="participant-avatar participant-avatar--large"
            :style="{
              backgroundColor: editDrafts[participant.id]?.avatarColor,
            }"
          >
            {{ editDrafts[participant.id]?.initials || participant.initials }}
          </span>
          <div class="participant-list__fields">
            <label>
              <span>Name</span>
              <input v-model="editDrafts[participant.id].name" type="text" />
            </label>
            <label>
              <span>Initials</span>
              <input
                v-model="editDrafts[participant.id].initials"
                type="text"
                maxlength="3"
              />
            </label>
            <label>
              <span>Type</span>
              <select v-model="editDrafts[participant.id].type">
                <option
                  v-for="type in typeOptions"
                  :key="type.value"
                  :value="type.value"
                >
                  {{ type.label }}
                </option>
              </select>
            </label>
            <fieldset class="color-selector color-selector--compact">
              <legend>Color</legend>
              <label v-for="color in participantColors" :key="color">
                <input
                  v-model="editDrafts[participant.id].avatarColor"
                  type="radio"
                  :value="color"
                />
                <span :style="{ backgroundColor: color }" />
              </label>
            </fieldset>
          </div>
          <div class="participant-list__actions">
            <button type="button" @click="saveParticipant(participant.id)">
              Save
            </button>
            <button
              v-if="participant.isActive"
              type="button"
              @click="disableOrRemoveParticipant(participant.id)"
            >
              {{ participantIsUsed(participant.id) ? 'Disable' : 'Remove' }}
            </button>
            <button
              v-else
              type="button"
              @click="enableParticipant(participant.id)"
            >
              Enable
            </button>
          </div>
        </li>
      </ul>

      <p
        v-if="participantMessage.text"
        :class="
          participantMessage.tone === 'error'
            ? 'meeting-error'
            : 'meeting-status'
        "
        role="status"
      >
        {{ participantMessage.text }}
      </p>
    </section>

    <UpgradePrompt v-if="lockedFeature" :feature="lockedFeature" />

    <div class="content-panel settings-panel">
      <h2>Mock plan</h2>
      <div class="segmented-control" aria-label="Mock plan">
        <button
          v-for="plan in planOptions"
          :key="plan"
          type="button"
          :class="[
            'segmented-control__button',
            { 'is-active': planType === plan },
          ]"
          @click="setMockPlan(plan)"
        >
          {{ plan }}
        </button>
      </div>
    </div>

    <div class="content-panel settings-panel">
      <h2>Mock workspace role</h2>
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

    <div class="content-panel settings-panel">
      <h2>Premium feature checks</h2>
      <ul class="feature-list">
        <li v-for="featureKey in premiumFeatureKeys" :key="featureKey">
          <div>
            <strong>{{ featureAccessConfig[featureKey].label }}</strong>
            <p>{{ featureAccessConfig[featureKey].description }}</p>
          </div>
          <span
            :class="[
              'feature-status',
              { 'is-available': canUseFeature(featureKey) },
            ]"
          >
            {{ canUseFeature(featureKey) ? 'Available' : 'Locked' }}
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>
