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
        class="meeting-item-card__action material-symbols-outlined"
        type="button"
        :aria-label="t('common.edit')"
        @click="emit('edit', item.id)"
      >
        edit
      </button>
      <button
        class="meeting-item-card__action meeting-item-card__action--delete material-symbols-outlined"
        type="button"
        :aria-label="t('common.delete')"
        @click="emit('delete', item.id)"
      >
        delete_outline
      </button>
    </div>
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
.meeting-item-card__actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  justify-content: flex-end;
}
.meeting-item-card__action {
  display: grid;
  width: 34px;
  min-width: 34px;
  height: 34px;
  min-height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  padding: 0;
  color: var(--color-primary);
  font-size: 1.05rem;
}
.meeting-item-card__action:active {
  background: var(--color-surface-low);
}
.meeting-item-card__action--delete {
  color: var(--color-error);
}
</style>
