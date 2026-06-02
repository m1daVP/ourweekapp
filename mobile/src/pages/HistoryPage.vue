<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import type { Participant } from '@/features/participants/types';
import type { Meeting } from '@/features/meeting/types';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';

const meetingsStore = useMeetingsStore();
const participantsStore = useParticipantsStore();
const router = useRouter();
const { canAccessMeetingHistoryItem, canUseFeature, getFreeLimit } =
  useFeatureAccess();
const { t, locale } = useI18n();

const freeHistoryLimit = getFreeLimit('limitedHistory') ?? 3;

const sortedCompletedMeetings = computed(() =>
  [...meetingsStore.completedMeetings].sort(compareMeetingsByDate)
);

const inProgressItems = computed(() =>
  meetingsStore.meetings
    .filter((meeting) => meeting.status !== 'completed')
    .sort(compareMeetingsByDate)
    .map((meeting) => ({
      meeting,
      title: getMeetingTitle(meeting),
      subtitle: formatDraftLabel(meeting),
    }))
);

const completedItems = computed(() =>
  sortedCompletedMeetings.value.map((meeting) => {
    const completedIndex = sortedCompletedMeetings.value.findIndex(
      (item) => item.id === meeting.id
    );

    return {
      meeting,
      completedIndex,
      isLocked: !canAccessMeetingHistoryItem(meeting, completedIndex),
      title: `${formatMeetingDate(getMeetingDate(meeting))}: ${getMeetingTitle(
        meeting
      )}`,
      subtitle: formatCompletedLabel(meeting),
      participants: getMeetingParticipants(meeting),
    };
  })
);

const showPremiumUnlock = computed(() => !canUseFeature('unlimitedHistory'));

function compareMeetingsByDate(first: Meeting, second: Meeting) {
  return getMeetingDate(second).getTime() - getMeetingDate(first).getTime();
}

function getMeetingDate(meeting: Meeting) {
  return new Date(
    meeting.completedAt ?? meeting.updatedAt ?? meeting.createdAt
  );
}

function getMeetingTitle(meeting: Meeting) {
  return meeting.title || t('history.defaultMeetingTitle');
}

function formatMeetingDate(date: Date) {
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatDraftLabel(meeting: Meeting) {
  const date = new Date(meeting.updatedAt ?? meeting.createdAt);
  const relativeDays = getRelativeDayCount(date);

  if (relativeDays === 0) {
    return t('history.draftedToday');
  }

  if (relativeDays === 1) {
    return t('history.draftedYesterday');
  }

  return t('history.draftedDaysAgo', { count: relativeDays });
}

function formatCompletedLabel(meeting: Meeting) {
  const date = getMeetingDate(meeting);
  const weekday = new Intl.DateTimeFormat(locale.value, {
    weekday: 'long',
  }).format(date);

  return t('history.completedOn', { day: weekday });
}

function getRelativeDayCount(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return Math.max(
    0,
    Math.round((today.getTime() - target.getTime()) / 86_400_000)
  );
}

function getMeetingParticipants(meeting: Meeting): Participant[] {
  const participants = meeting.participantIds
    .map((participantId) => participantsStore.getParticipantById(participantId))
    .filter((participant): participant is Participant => Boolean(participant));

  if (participants.length) {
    return participants;
  }

  return participantsStore.activeParticipants;
}

function openInProgressMeeting(meeting: Meeting) {
  meetingsStore.resumeMeeting(meeting.id);
  router.push({ name: 'meeting' });
}

function openCompletedMeeting(item: (typeof completedItems.value)[number]) {
  if (item.isLocked) {
    return;
  }

  router.push({
    name: 'meeting-details',
    params: { meetingId: item.meeting.id },
  });
}

function openUpgrade() {
  router.push({
    name: 'upgrade',
    query: { lockedFeature: 'unlimitedHistory' },
  });
}
</script>

<template>
  <section class="history-page history-page--redesign">
    <section class="history-section" aria-labelledby="history-progress-title">
      <h2 id="history-progress-title">{{ t('history.inProgress') }}</h2>
      <ul v-if="inProgressItems.length" class="history-card-list">
        <li
          v-for="item in inProgressItems"
          :key="item.meeting.id"
          class="history-progress-card"
        >
          <button
            type="button"
            class="history-progress-card__button"
            @click="openInProgressMeeting(item.meeting)"
          >
            <span class="history-progress-card__icon" aria-hidden="true">
              <span class="material-symbols-outlined">edit_document</span>
            </span>
            <span class="history-progress-card__copy">
              <strong>{{ item.title }}</strong>
              <small>{{ item.subtitle }}</small>
            </span>
            <span
              class="history-card__chevron material-symbols-outlined"
              aria-hidden="true"
            >
              chevron_right
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="history-empty-card">{{ t('history.noDrafts') }}</p>
    </section>

    <section class="history-section" aria-labelledby="history-completed-title">
      <h2 id="history-completed-title">{{ t('history.completedMeetings') }}</h2>
      <ul v-if="completedItems.length" class="history-card-list">
        <li
          v-for="item in completedItems"
          :key="item.meeting.id"
          :class="['history-completed-card', { 'is-locked': item.isLocked }]"
        >
          <button
            type="button"
            class="history-completed-card__button"
            :disabled="item.isLocked"
            @click="openCompletedMeeting(item)"
          >
            <span class="history-completed-card__header">
              <span class="history-completed-card__copy">
                <strong>{{ item.title }}</strong>
                <small>{{ item.subtitle }}</small>
              </span>
              <span
                class="history-completed-card__status material-symbols-outlined"
                aria-hidden="true"
              >
                {{ item.isLocked ? 'lock' : 'check_circle' }}
              </span>
            </span>
            <span class="history-avatar-stack" aria-hidden="true">
              <span
                v-for="participant in item.participants.slice(0, 3)"
                :key="participant.id"
                class="history-avatar"
                :style="{ backgroundColor: participant.avatarColor }"
              >
                {{ participant.initials }}
              </span>
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="history-empty-card">{{ t('history.emptyText') }}</p>
    </section>

    <section
      v-if="showPremiumUnlock"
      class="history-premium-card"
      aria-labelledby="history-premium-title"
    >
      <span class="history-premium-card__icon" aria-hidden="true">
        <span class="material-symbols-outlined">lock</span>
      </span>
      <div>
        <h2 id="history-premium-title">{{ t('history.unlockFullHistory') }}</h2>
        <p>
          {{
            t('history.unlockFullHistoryMessage', {
              count: freeHistoryLimit,
            })
          }}
        </p>
      </div>
      <button type="button" @click="openUpgrade">
        {{ t('history.upgradePremium') }}
      </button>
    </section>
  </section>
</template>
