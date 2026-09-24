<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Participant } from '@/features/participants/types';
import ParticipantAvatar from '@/features/participants/components/ParticipantAvatar.vue';
import DatePickerField from '@/shared/components/DatePickerField.vue';

export type TaskFormFieldsValue = {
  title: string;
  description: string;
  responsibilityChoice: string;
  dueDate: string;
};

type ResponsibilityOption = {
  value: string;
  label: string;
  icon?: string;
  participant?: Participant;
};

const props = withDefaults(
  defineProps<{
    modelValue: TaskFormFieldsValue;
    participants: Participant[];
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const emit = defineEmits<{
  'update:modelValue': [value: TaskFormFieldsValue];
}>();

const { t } = useI18n();
const areDetailsOpen = ref(false);
const responsibilityOptions = computed<ResponsibilityOption[]>(() => [
  {
    value: 'needsDiscussion',
    label: t('meeting.needsDiscussion'),
    icon: 'person_off',
  },
  { value: 'shared', label: t('meeting.shared'), icon: 'group' },
  ...props.participants
    .filter((participant) => participant.isActive)
    .map((participant) => ({
      value: participant.id,
      label: participant.name,
      participant,
    })),
]);

function updateField<K extends keyof TaskFormFieldsValue>(
  key: K,
  value: TaskFormFieldsValue[K]
) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}
</script>

<template>
  <div class="task-form-fields">
    <label class="task-form-fields__label" for="task-form-title">
      {{ t('meeting.taskTitle') }}
    </label>
    <textarea
      id="task-form-title"
      :value="modelValue.title"
      class="task-form-fields__primary"
      rows="3"
      :disabled="disabled"
      @input="
        updateField('title', ($event.target as HTMLTextAreaElement).value)
      "
    />

    <section
      class="task-form-fields__details-shell"
      :class="{ 'is-open': areDetailsOpen }"
    >
      <button
        class="task-form-fields__details-toggle"
        type="button"
        :aria-expanded="areDetailsOpen"
        aria-controls="task-form-details"
        :disabled="disabled"
        @click="areDetailsOpen = !areDetailsOpen"
      >
        <span
          class="task-form-fields__plus material-symbols-outlined"
          aria-hidden="true"
          >add</span
        >
        <span>{{ t('meeting.optionalDetail') }}</span>
        <span
          class="task-form-fields__chevron material-symbols-outlined"
          aria-hidden="true"
        >
          {{ areDetailsOpen ? 'expand_less' : 'expand_more' }}
        </span>
      </button>
      <div
        v-if="areDetailsOpen"
        id="task-form-details"
        class="task-form-fields__details-content"
      >
        <label>
          <span class="task-form-fields__detail-label-row">
            <span>{{ t('meeting.optionalDetail') }}</span>
            <span>{{ t('common.optional') }}</span>
          </span>
          <textarea
            :value="modelValue.description"
            rows="2"
            :disabled="disabled"
            @input="
              updateField(
                'description',
                ($event.target as HTMLTextAreaElement).value
              )
            "
          />
        </label>

        <section class="task-form-fields__detail-section">
          <span>{{ t('meeting.responsible') }}</span>
          <div
            class="task-form-fields__responsibility-rail"
            role="list"
            :aria-label="t('meeting.responsible')"
          >
            <button
              v-for="option in responsibilityOptions"
              :key="option.value"
              class="task-form-fields__responsibility-card"
              :class="{
                'is-selected': modelValue.responsibilityChoice === option.value,
              }"
              type="button"
              role="listitem"
              :aria-pressed="modelValue.responsibilityChoice === option.value"
              :disabled="disabled"
              @click="updateField('responsibilityChoice', option.value)"
            >
              <ParticipantAvatar
                v-if="option.participant"
                :participant="option.participant"
                size="small"
                decorative
              />
              <span
                v-else
                class="task-form-fields__choice-icon material-symbols-outlined"
                aria-hidden="true"
                >{{ option.icon }}</span
              >
              <span>{{ option.label }}</span>
            </button>
          </div>
        </section>

        <section class="task-form-fields__detail-section">
          <span>{{ t('meeting.dueDate') }}</span>
          <DatePickerField
            :model-value="modelValue.dueDate"
            :label="t('meeting.dueDate')"
            presentation="summary"
            :action-label="t('common.edit')"
            :disabled="disabled"
            @update:model-value="updateField('dueDate', $event)"
          />
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.task-form-fields {
  display: grid;
  gap: 16px;
  padding-top: 2px;
}
.task-form-fields__label,
.task-form-fields__detail-section {
  color: var(--color-on-surface);
  font-weight: 700;
}
.task-form-fields__primary,
.task-form-fields__details-content textarea {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 20px;
  background: var(--color-surface-low);
  padding: 16px;
  color: var(--color-on-surface);
  font: inherit;
  line-height: 1.5;
  resize: vertical;
}
.task-form-fields__primary {
  min-height: 108px;
}
.task-form-fields__details-shell {
  overflow: hidden;
  border: 1px solid var(--color-outline-variant);
  border-radius: 32px;
  background: #f8f7f2;
}
.task-form-fields__details-toggle {
  display: grid;
  width: 100%;
  min-height: 56px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 10px 14px 10px 18px;
  color: var(--color-primary);
  font: inherit;
  font-weight: 700;
  text-align: left;
}
.task-form-fields__plus,
.task-form-fields__choice-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 50%;
  background: #e9ece5;
  color: var(--color-primary);
}
.task-form-fields__chevron {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface-lowest);
  color: var(--color-primary);
  font-size: 1.5rem;
}
.task-form-fields__details-content {
  display: grid;
  gap: 18px;
  padding: 4px 16px 16px;
}
.task-form-fields__detail-label-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.task-form-fields__detail-label-row > span:last-child {
  color: var(--color-on-surface-variant);
  font-weight: 600;
  text-transform: none;
}
.task-form-fields__details-content textarea {
  min-height: 88px;
  border-color: var(--color-outline-variant);
  background: var(--color-surface-lowest);
}
.task-form-fields__detail-section {
  display: grid;
  gap: 8px;
  font-size: var(--font-size-label-lg);
}
.task-form-fields__responsibility-rail {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 2px 2px 6px;
  scrollbar-width: thin;
}
.task-form-fields__responsibility-card {
  display: grid;
  min-width: 108px;
  min-height: 98px;
  flex: 0 0 108px;
  gap: 8px;
  place-items: center;
  border: 1px solid var(--color-outline-variant);
  border-radius: 16px;
  background: var(--color-surface-lowest);
  padding: 10px;
  color: var(--color-on-surface);
  font-size: 0.82rem;
  font-weight: 700;
  text-align: center;
}
.task-form-fields__responsibility-card.is-selected {
  border: 2px solid var(--color-primary);
  background: color-mix(
    in srgb,
    var(--color-primary) 9%,
    var(--color-surface-lowest)
  );
  box-shadow: inset 0 0 0 1px
    color-mix(in srgb, var(--color-primary) 18%, transparent);
}
.task-form-fields__responsibility-card.is-selected
  .task-form-fields__choice-icon {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
</style>
