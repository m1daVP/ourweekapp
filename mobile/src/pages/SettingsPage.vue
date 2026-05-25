<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import { useLocalizationStore } from '@/app/stores/localization';
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
import type { FeatureKey, UserRole } from '@/features/access/types';
import type { ReminderDay } from '@/features/reminders/types';
import type { ParticipantType } from '@/features/participants/types';
import { localeNames, supportedLocales } from '@/features/localization/locale';
import PremiumLock from '@/shared/components/PremiumLock.vue';
import UpgradePrompt from '@/shared/components/UpgradePrompt.vue';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';
import { useNotifications } from '@/shared/composables/useNotifications';

const route = useRoute();
const { t } = useI18n();
const authStore = useAuthStore();
const localizationStore = useLocalizationStore();
const { userRole, canUseFeature, getFeatureAccess, setMockRole } =
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

const roleOptions = computed<Array<{ label: string; value: UserRole }>>(() => [
  { label: t('settings.role.owner'), value: 'owner' },
  { label: t('settings.role.adultMember'), value: 'adult_member' },
  { label: t('settings.role.viewer'), value: 'viewer' },
]);
const timeInputStep = 300;
const typeOptions = computed<Array<{ label: string; value: ParticipantType }>>(
  () => [
    { label: t('settings.participantType.adult'), value: 'adult' },
    { label: t('settings.participantType.child'), value: 'child' },
    { label: t('settings.participantType.other'), value: 'other' },
  ]
);
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

function updateLocale(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  localizationStore.setLocale(value === 'uk' ? 'uk' : 'en');
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
    setParticipantMessage(t('settings.addNameFirst'), 'error');
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
  setParticipantMessage(t('settings.participantAdded'));
}

function saveParticipant(participantId: string) {
  const draft = editDrafts[participantId];

  if (!draft) {
    return;
  }

  const participant = participantsStore.updateParticipant(participantId, draft);

  if (!participant) {
    setParticipantMessage(t('settings.addNameFirst'), 'error');
    return;
  }

  setParticipantMessage(t('settings.participantUpdated'));
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
    setParticipantMessage(t('settings.participantDisabled'));
    return;
  }

  participantsStore.removeParticipant(participantId);
  setParticipantMessage(t('settings.participantRemoved'));
}

function enableParticipant(participantId: string) {
  participantsStore.enableParticipant(participantId);
  meetingsStore.syncActiveMeetingParticipants();
  setParticipantMessage(t('settings.participantEnabled'));
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
        class="secondary-button link-button"
        :to="{ name: 'calendar-sync' }"
      >
        {{ t('settings.calendarSync') }}
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

    <section class="content-panel settings-panel participant-panel">
      <div>
        <h2>{{ t('settings.participants') }}</h2>
        <p>{{ t('settings.participantsIntro') }}</p>
      </div>

      <form class="participant-form" @submit.prevent="createParticipant">
        <label>
          <span>{{ t('settings.name') }}</span>
          <input
            v-model="participantDraft.name"
            type="text"
            :placeholder="t('settings.name')"
          />
        </label>
        <label>
          <span>{{ t('settings.initials') }}</span>
          <input
            v-model="participantDraft.initials"
            type="text"
            maxlength="3"
            :placeholder="t('settings.auto')"
          />
        </label>
        <label>
          <span>{{ t('settings.type') }}</span>
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
          <legend>{{ t('settings.avatarColor') }}</legend>
          <label v-for="color in participantColors" :key="color">
            <input
              v-model="participantDraft.avatarColor"
              type="radio"
              :value="color"
            />
            <span :style="{ backgroundColor: color }" />
          </label>
        </fieldset>
        <button class="meeting-primary" type="submit">
          {{ t('settings.addParticipant') }}
        </button>
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
              <span>{{ t('settings.name') }}</span>
              <input v-model="editDrafts[participant.id].name" type="text" />
            </label>
            <label>
              <span>{{ t('settings.initials') }}</span>
              <input
                v-model="editDrafts[participant.id].initials"
                type="text"
                maxlength="3"
              />
            </label>
            <label>
              <span>{{ t('settings.type') }}</span>
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
              <legend>{{ t('settings.color') }}</legend>
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
              {{ t('common.save') }}
            </button>
            <button
              v-if="participant.isActive"
              type="button"
              @click="disableOrRemoveParticipant(participant.id)"
            >
              {{
                participantIsUsed(participant.id)
                  ? t('settings.disable')
                  : t('common.remove')
              }}
            </button>
            <button
              v-else
              type="button"
              @click="enableParticipant(participant.id)"
            >
              {{ t('common.enable') }}
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

    <div class="content-panel settings-panel">
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
