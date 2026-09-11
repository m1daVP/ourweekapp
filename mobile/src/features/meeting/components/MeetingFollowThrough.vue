<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import type {
  FollowThroughObservation,
  Meeting,
  SummarySourceRef,
} from '../types';
import {
  resolveSummarySource,
  suggestedTaskId,
  summarySourceFingerprint,
} from '../followThrough';
import { useTasksStore } from '@/app/stores/tasks';
import { useParticipantsStore } from '@/app/stores/participants';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import { copyExportToClipboard } from '@/features/export/services/exportService';

const props = defineProps<{
  meeting: Meeting;
  canRegenerate?: boolean;
  generating?: boolean;
}>();
defineEmits<{ regenerate: [] }>();
const { t } = useI18n();
const router = useRouter();
const tasks = useTasksStore();
const participants = useParticipantsStore();
const { can } = useWorkspacePermissions();
const freshness = ref<'checking' | 'current' | 'stale' | 'legacy'>('checking');
const selectedSource = ref<SummarySourceRef | null>(null);
const draftObservation = ref<FollowThroughObservation | null>(null);
const title = ref('');
const responsibility = ref('');
const date = ref('');
const feedback = ref('');
const saving = ref(false);
const draftMeetingId = ref('');
const draftFingerprint = ref('');
const summary = computed(() => props.meeting.aiSummary);
const source = computed(() =>
  selectedSource.value
    ? resolveSummarySource(props.meeting, selectedSource.value)
    : null
);
const canCreate = computed(
  () => freshness.value === 'current' && can('editTasks')
);
watch(
  () => JSON.stringify(props.meeting),
  async (_, __, onCleanup) => {
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    const fingerprint = summary.value?.followThrough?.sourceFingerprint;
    if (!fingerprint) {
      freshness.value = 'legacy';
      return;
    }
    freshness.value = 'checking';
    try {
      const current = await summarySourceFingerprint(props.meeting);
      if (!cancelled)
        freshness.value = current === fingerprint ? 'current' : 'stale';
    } catch {
      if (!cancelled) freshness.value = 'legacy';
    }
  },
  { immediate: true }
);

function act(observation: FollowThroughObservation) {
  const action = observation.action;
  const ref = action && observation.sourceRefs[action.sourceRefIndex];
  if (!action || !ref || !resolveSummarySource(props.meeting, ref)) return;
  if (action.type === 'openSource') {
    selectedSource.value = ref;
    return;
  }
  if (!canCreate.value || ref.kind !== 'note') return;
  draftMeetingId.value = props.meeting.id;
  draftFingerprint.value =
    summary.value?.followThrough?.sourceFingerprint ?? '';
  title.value = observation.question.slice(0, 140);
  responsibility.value = '';
  date.value = '';
  draftObservation.value = observation;
}
async function saveTask() {
  if (
    saving.value ||
    !canCreate.value ||
    !draftObservation.value ||
    !title.value.trim() ||
    title.value.trim().length > 140 ||
    !responsibility.value
  )
    return;
  const observation = draftObservation.value;
  const meetingId = draftMeetingId.value;
  const fingerprint = draftFingerprint.value;
  saving.value = true;
  try {
    const [currentFingerprint, id] = await Promise.all([
      summarySourceFingerprint(props.meeting),
      suggestedTaskId(meetingId, observation),
    ]);
    if (
      !canCreate.value ||
      props.meeting.id !== meetingId ||
      draftObservation.value !== observation ||
      fingerprint !== currentFingerprint ||
      fingerprint !== summary.value?.followThrough?.sourceFingerprint
    )
      return;
    const existing = tasks.tasks.find(
      (task) =>
        task.id === id ||
        (!task.deletedAt &&
          task.sourceMeetingId === meetingId &&
          task.title.trim() === title.value.trim())
    );
    if (existing) {
      feedback.value = t('followThrough.alreadySaved');
      draftObservation.value = null;
      return;
    }
    const validIds = participants.activeParticipants
      .filter((item) => props.meeting.participantIds.includes(item.id))
      .map((item) => item.id);
    if (
      responsibility.value !== 'shared' &&
      responsibility.value !== 'needsDiscussion' &&
      !validIds.includes(responsibility.value)
    )
      return;
    const created = tasks.addTask({
      id,
      title: title.value.trim(),
      description: observation.question,
      dueDate: date.value || undefined,
      sourceMeetingId: meetingId,
      responsibilityType:
        responsibility.value === 'shared'
          ? 'shared'
          : responsibility.value === 'needsDiscussion'
            ? 'needsDiscussion'
            : 'participant',
      responsibleParticipantIds:
        responsibility.value === 'shared'
          ? validIds
          : responsibility.value === 'needsDiscussion'
            ? []
            : [responsibility.value],
    });
    if (created) {
      draftObservation.value = null;
      feedback.value = t('followThrough.saved');
    } else feedback.value = t('followThrough.saveFailed');
  } catch {
    feedback.value = t('followThrough.saveFailed');
  } finally {
    saving.value = false;
  }
}
async function copyQuestion(question: string) {
  try {
    await copyExportToClipboard(question);
    feedback.value = t('meeting.copied');
  } catch {
    feedback.value = t('meeting.copyFailed');
  }
}
function openTask() {
  if (!selectedSource.value?.itemId) return;
  const taskId = selectedSource.value.itemId;
  selectedSource.value = null;
  void router.push({ name: 'tasks', query: { taskId } });
}
</script>

<template>
  <div v-if="summary" class="follow-through">
    <p>{{ summary.shortSummary }}</p>
    <p v-if="freshness !== 'current'" role="status" class="meeting-help">
      {{ t(`followThrough.${freshness}`) }}
    </p>
    <template v-if="summary.followThrough">
      <h3>{{ t('followThrough.title') }}</h3>
      <p v-if="!summary.followThrough.observations.length">
        {{ t('followThrough.empty') }}
      </p>
      <article
        v-for="(observation, index) in summary.followThrough.observations"
        :key="index"
        class="follow-through__card"
      >
        <small>{{ t(`followThrough.${observation.reviewHorizon}`) }}</small>
        <h4>{{ observation.title }}</h4>
        <p>{{ observation.explanation }}</p>
        <p>
          <strong>{{ t('followThrough.suggestion') }}</strong
          >: {{ observation.question }}
        </p>
        <div class="follow-through__sources">
          <span>{{ t('followThrough.evidence') }}</span>
          <button
            v-for="(reference, refIndex) in observation.sourceRefs"
            :key="refIndex"
            type="button"
            :disabled="!resolveSummarySource(meeting, reference)"
            @click="selectedSource = reference"
          >
            {{ reference.label }}
          </button>
        </div>
        <button
          v-if="observation.action"
          type="button"
          class="meeting-primary"
          :disabled="
            !resolveSummarySource(
              meeting,
              observation.sourceRefs[observation.action.sourceRefIndex]!
            ) ||
            (observation.action.type === 'createTask' && !canCreate)
          "
          @click="act(observation)"
        >
          {{ t(`followThrough.${observation.action.type}`) }}
        </button>
        <button
          type="button"
          class="secondary-button"
          @click="copyQuestion(observation.question)"
        >
          {{ t('followThrough.copyQuestion') }}
        </button>
      </article>
    </template>
    <button
      v-if="
        canRegenerate && freshness !== 'current' && freshness !== 'checking'
      "
      type="button"
      class="meeting-secondary"
      :disabled="generating"
      @click="$emit('regenerate')"
    >
      {{ t('followThrough.regenerate') }}
    </button>
    <p v-if="feedback" role="status">{{ feedback }}</p>
    <BaseBottomSheet
      :open="Boolean(selectedSource)"
      :title="t('followThrough.evidence')"
      @close="selectedSource = null"
    >
      <template v-if="source">
        <h3>{{ source.section.title }}</h3>
        <p>{{ source.text }}</p>
        <template v-if="selectedSource?.kind === 'section'">
          <p v-for="note in source.section.notes" :key="note.id">
            {{ note.text }}
          </p>
          <p v-for="task in source.section.tasks" :key="task.id">
            {{ task.title }} — {{ t(`meeting.taskStatus.${task.status}`) }}
          </p>
          <p v-for="agreement in source.section.agreements" :key="agreement.id">
            {{ agreement.text }}
          </p>
        </template>
        <button
          v-if="selectedSource?.kind === 'task' && selectedSource.itemId"
          type="button"
          class="meeting-primary"
          @click="openTask"
        >
          {{ t('followThrough.openSource') }}
        </button>
      </template>
      <p v-else>{{ t('followThrough.sourceUnavailable') }}</p>
    </BaseBottomSheet>
    <BaseBottomSheet
      :open="Boolean(draftObservation)"
      :title="t('followThrough.createTask')"
      @close="draftObservation = null"
    >
      <form
        class="follow-through__form task-editor-form"
        @submit.prevent="saveTask"
      >
        <label
          >{{ t('followThrough.taskTitle')
          }}<input v-model="title" required maxlength="140"
        /></label>
        <label
          >{{ t('followThrough.responsibility')
          }}<select v-model="responsibility" required>
            <option value="" disabled>{{ t('followThrough.choose') }}</option>
            <option value="needsDiscussion">
              {{ t('followThrough.needsDiscussion') }}
            </option>
            <option value="shared">{{ t('followThrough.shared') }}</option>
            <option
              v-for="participant in participants.activeParticipants.filter(
                (item) => meeting.participantIds.includes(item.id)
              )"
              :key="participant.id"
              :value="participant.id"
            >
              {{ participant.name }}
            </option>
          </select></label
        >
        <label
          >{{ t('followThrough.date') }}<input v-model="date" type="date"
        /></label>
        <p v-if="!canCreate" role="status">{{ t('followThrough.stale') }}</p>
        <button
          type="submit"
          class="meeting-primary"
          :disabled="saving || !canCreate || !title.trim() || !responsibility"
        >
          {{ t('followThrough.save') }}
        </button>
        <button
          type="button"
          class="meeting-secondary"
          @click="draftObservation = null"
        >
          {{ t('followThrough.cancel') }}
        </button>
      </form>
    </BaseBottomSheet>
  </div>
</template>

<style scoped>
.follow-through,
.follow-through__card,
.follow-through__form,
.follow-through__form label {
  display: grid;
  gap: 0.75rem;
}
.follow-through__card {
  border-top: 1px solid var(--color-border, #ddd);
  padding-top: 1rem;
  overflow-wrap: anywhere;
}
.follow-through__card h4,
.follow-through__card p {
  margin: 0;
}
.follow-through__sources {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.follow-through button,
.follow-through input,
.follow-through select {
  min-height: 44px;
  max-width: 100%;
}
.follow-through__sources button {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-outline-variant);
  border-radius: 0.75rem;
  background: var(--color-surface-lowest);
  color: var(--color-on-surface-variant);
  overflow-wrap: anywhere;
  font: inherit;
}
.follow-through__form .secondary-button {
  min-height: 44px;
  border: 1px solid var(--color-outline-variant);
  border-radius: 999px;
  background: var(--color-surface-lowest);
  color: var(--color-on-surface);
  font: inherit;
}
.follow-through__form input,
.follow-through__form select {
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem;
  border: 1px solid var(--color-outline-variant);
  border-radius: 0.75rem;
  background: var(--color-surface-lowest);
  color: var(--color-on-surface);
  font: inherit;
}
</style>
