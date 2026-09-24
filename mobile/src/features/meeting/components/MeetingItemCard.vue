<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  Agreement,
  MeetingNote,
  MeetingTask,
} from '@/features/meeting/types';
import AnchoredActionMenu, {
  type AnchoredActionMenuItem,
} from '@/shared/components/AnchoredActionMenu.vue';

type MeetingItemCardTask = MeetingTask & {
  responsibilityLabel?: string;
};

const props = defineProps<{
  item: Agreement | MeetingNote | MeetingItemCardTask;
  type: 'agreement' | 'note' | 'task';
  editable: boolean;
}>();

const emit = defineEmits<{
  delete: [id: string];
  edit: [id: string];
  'toggle-task': [id: string, status: MeetingTask['status']];
}>();

const { t, locale } = useI18n();
const text = computed(() =>
  'title' in props.item ? props.item.title : props.item.text
);
const isTask = computed(() => props.type === 'task');
const taskItem = computed<MeetingItemCardTask | null>(() =>
  props.type === 'task' ? (props.item as MeetingItemCardTask) : null
);
const itemActions = computed<AnchoredActionMenuItem[]>(() => [
  { id: 'edit', label: t('common.edit'), icon: 'edit' },
  {
    id: 'delete',
    label: t('common.delete'),
    icon: 'delete_outline',
    variant: 'destructive',
  },
]);

function handleActionSelection(actionId: string) {
  if (actionId === 'edit') {
    emit('edit', props.item.id);
  }

  if (actionId === 'delete') {
    emit('delete', props.item.id);
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}
</script>

<template>
  <article class="meeting-item-card" :class="`meeting-item-card--${type}`">
    <span
      v-if="isTask"
      class="meeting-summary-action-list__check"
      aria-hidden="true"
    ></span>
    <p
      :class="{ 'meeting-item-card__text--done': taskItem?.status === 'done' }"
    >
      {{ text }}
      <span class="meeting-item-card__meta" v-if="isTask && taskItem">
        <small
          v-if="taskItem.responsibilityLabel"
          class="meeting-item-card__responsibility"
        >
          {{ taskItem.responsibilityLabel }}
        </small>
        <span v-if="taskItem.dueDate" class="meeting-item-card__due-date">
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path
              d="M7 3v3m10-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
            />
          </svg>
          {{ formatDate(taskItem.dueDate) }}
        </span>
      </span>
    </p>
    <AnchoredActionMenu
      v-if="editable"
      :items="itemActions"
      :menu-label="t('meeting.itemActionsAria', { item: text })"
      :trigger-label="t('meeting.itemActionsAria', { item: text })"
      @select="handleActionSelection"
    />
  </article>
</template>

<style scoped>
.meeting-item-card {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  align-items: start;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--color-outline-variant);
  border-radius: 16px;
  background: var(--color-surface-lowest);
  box-shadow: 0 2px 8px rgba(47, 42, 38, 0.06);
}
.meeting-item-card p {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--color-on-surface);
  line-height: 1.5;
}
.meeting-item-card__toggle {
  min-width: 44px;
  min-height: 44px;
}
.meeting-item-card__text--done {
  text-decoration: line-through;
}
.meeting-item-card__meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  color: var(--color-outline);
  font-size: var(--font-size-label-sm);
}
.meeting-item-card__responsibility {
  display: inline-block;
  border-radius: 8px;
  background: #eef4ef;
  padding: 2px 8px;
  color: #5d705f;
  font-size: var(--font-size-label-sm);
  font-weight: 650;
  line-height: 1.2;
}
.meeting-item-card__due-date {
  display: flex;
  align-items: center;
  gap: 4px;
}
.meeting-item-card__due-date svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}
</style>
