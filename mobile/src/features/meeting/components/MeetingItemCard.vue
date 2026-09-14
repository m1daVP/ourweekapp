<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  Agreement,
  MeetingNote,
  MeetingTask,
} from '@/features/meeting/types';

const props = defineProps<{
  item: Agreement | MeetingNote | MeetingTask;
  type: 'agreement' | 'note' | 'task';
  editable: boolean;
}>();

const emit = defineEmits<{
  delete: [id: string];
  edit: [id: string];
  'toggle-task': [id: string, status: MeetingTask['status']];
}>();

const { t } = useI18n();
const text = computed(() =>
  'title' in props.item ? props.item.title : props.item.text
);
const isTask = computed(() => props.type === 'task');
const taskItem = computed(() =>
  props.type === 'task' ? (props.item as MeetingTask) : null
);
</script>

<template>
  <article class="meeting-item-card" :class="`meeting-item-card--${type}`">
    <button
      v-if="isTask"
      class="meeting-item-card__toggle material-symbols-outlined"
      type="button"
      :aria-label="
        taskItem?.status === 'done'
          ? t('meeting.markTaskOpen', { title: text })
          : t('meeting.markTaskDone', { title: text })
      "
      :disabled="!editable"
      @click="taskItem && emit('toggle-task', item.id, taskItem.status)"
    >
      {{
        taskItem?.status === 'done' ? 'check_circle' : 'radio_button_unchecked'
      }}
    </button>
    <p
      :class="{ 'meeting-item-card__text--done': taskItem?.status === 'done' }"
    >
      {{ text }}
    </p>
    <div v-if="editable" class="meeting-item-card__actions">
      <button
        type="button"
        :aria-label="t('common.edit')"
        @click="emit('edit', item.id)"
      >
        edit
      </button>
      <button
        type="button"
        :aria-label="t('common.delete')"
        @click="emit('delete', item.id)"
      >
        delete
      </button>
    </div>
  </article>
</template>

<style scoped>
.meeting-item-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--color-outline-variant);
  border-radius: 12px;
}
.meeting-item-card p {
  margin: 0;
  overflow-wrap: anywhere;
}
.meeting-item-card__toggle {
  min-width: 44px;
  min-height: 44px;
}
.meeting-item-card__text--done {
  text-decoration: line-through;
}
.meeting-item-card__actions {
  display: flex;
  gap: 4px;
}
</style>
