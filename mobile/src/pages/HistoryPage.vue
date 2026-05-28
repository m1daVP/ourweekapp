<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import type { Meeting } from '@/features/meeting/types';
import PremiumLock from '@/shared/components/PremiumLock.vue';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';

const meetingsStore = useMeetingsStore();
const router = useRouter();
const { canAccessMeetingHistoryItem, getFreeLimit } = useFeatureAccess();
const { t, locale } = useI18n();

const freeHistoryLimit = getFreeLimit('limitedHistory') ?? 3;

const sortedCompletedMeetings = computed(() =>
  [...meetingsStore.completedMeetings].sort(compareMeetingsByDate)
);

const historyItems = computed(() => {
  const completedIndexes = new Map(
    sortedCompletedMeetings.value.map((meeting, index) => [meeting.id, index])
  );

  return [...meetingsStore.meetings]
    .sort(compareMeetingsByDate)
    .map((meeting) => {
      const completedIndex = completedIndexes.get(meeting.id) ?? -1;

      return {
        meeting,
        completedIndex,
        isLocked: !canAccessMeetingHistoryItem(meeting, completedIndex),
        preview: getMeetingPreview(meeting),
        counts: getMeetingCounts(meeting),
        dateLabel: formatDate(getMeetingDate(meeting)),
        statusLabel: getMeetingStatusLabel(meeting),
      };
    });
});

function compareMeetingsByDate(first: Meeting, second: Meeting) {
  return getMeetingDate(second).getTime() - getMeetingDate(first).getTime();
}

function getMeetingDate(meeting: Meeting) {
  return new Date(
    meeting.completedAt ?? meeting.updatedAt ?? meeting.createdAt
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function truncateText(text: string, maxLength = 92) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function getMeetingPreview(meeting: Meeting) {
  for (const section of meeting.sections) {
    const note = section.notes[0];

    if (note) {
      return truncateText(note.text);
    }

    const task = section.tasks[0];

    if (task) {
      return truncateText(task.title);
    }

    const agreement = section.agreements[0];

    if (agreement) {
      return truncateText(agreement.text);
    }
  }

  return t('meeting.noContentPreview');
}

function getMeetingCounts(meeting: Meeting) {
  const notes = meeting.sections.reduce(
    (total, section) => total + section.notes.length,
    0
  );
  const tasks = meeting.sections.reduce(
    (total, section) => total + section.tasks.length,
    0
  );
  const agreements = meeting.sections.reduce(
    (total, section) => total + section.agreements.length,
    0
  );

  return t('history.counts', { notes, tasks, agreements });
}

function getMeetingStatusLabel(meeting: Meeting) {
  return meeting.status === 'completed'
    ? t('export.finished')
    : t('export.draft');
}

function openHistoryItem(item: (typeof historyItems.value)[number]) {
  if (item.isLocked) {
    return;
  }

  if (item.meeting.status === 'completed') {
    router.push({
      name: 'meeting-details',
      params: { meetingId: item.meeting.id },
    });
    return;
  }

  meetingsStore.resumeMeeting(item.meeting.id);
  router.push({ name: 'meeting' });
}
</script>

<template>
  <section class="page-stack history-page">
    <header>
      <p class="page-kicker">{{ t('history.kicker') }}</p>
      <h1>{{ t('history.title') }}</h1>
      <p class="page-copy">
        {{ t('history.intro', { count: freeHistoryLimit }) }}
      </p>
    </header>

    <RouterLink
      class="content-panel history-private-notes-link"
      :to="{ name: 'private-notes' }"
    >
      <span class="section-icon material-symbols-outlined" aria-hidden="true">
        edit_note
      </span>
      <span>
        <strong>{{ t('history.privateNotes') }}</strong>
        <small>{{ t('history.privateNotesText') }}</small>
      </span>
      <span class="material-symbols-outlined" aria-hidden="true">
        chevron_right
      </span>
    </RouterLink>

    <ul v-if="historyItems.length" class="history-list">
      <li
        v-for="item in historyItems"
        :key="item.meeting.id"
        :class="['history-item', { 'is-locked': item.isLocked }]"
      >
        <button
          v-if="!item.isLocked"
          type="button"
          class="history-item__button"
          @click="openHistoryItem(item)"
        >
          <span class="history-item__meta">
            <span>{{ item.dateLabel }}</span>
            <span>{{ item.statusLabel }}</span>
          </span>
          <strong>{{ item.meeting.title }}</strong>
          <p>{{ item.preview }}</p>
          <small>{{ item.counts }}</small>
        </button>

        <div v-else class="history-item__locked">
          <span class="history-item__meta">
            <span>{{ item.dateLabel }}</span>
            <span>{{ item.statusLabel }}</span>
          </span>
          <strong>{{ item.meeting.title }}</strong>
          <p>{{ item.preview }}</p>
          <small>{{ item.counts }}</small>
          <PremiumLock
            feature="unlimitedHistory"
            :title="t('history.lockedTitle')"
            :message="t('history.lockedMessage', { count: freeHistoryLimit })"
            :show-preview="false"
          />
        </div>
      </li>
    </ul>

    <div v-else class="content-panel">
      <h2>{{ t('history.emptyTitle') }}</h2>
      <p>{{ t('history.emptyText') }}</p>
    </div>
  </section>
</template>
