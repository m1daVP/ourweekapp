<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MeetingComposerDraftScope } from '@/features/meeting/meetingComposerDrafts';
import type { Participant } from '@/features/participants/types';
import ParticipantAvatar from '@/features/participants/components/ParticipantAvatar.vue';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import DatePickerField from '@/shared/components/DatePickerField.vue';
import { useMeetingComposer } from '@/features/meeting/composables/useMeetingComposer';

type TaskResponsibilityOption = {
  value: string;
  label: string;
  icon?: string;
  participant?: Participant;
};

type EditableTaskFields = {
  title: string;
  description: string;
  responsibilityChoice: string;
  dueDate: string;
};

type EditableTextFields = {
  text: string;
};

type EditableMeetingItem =
  | { type: 'task'; fields: EditableTaskFields }
  | { type: 'note' | 'agreement'; fields: EditableTextFields };

const props = defineProps<{
  open: boolean;
  scope: MeetingComposerDraftScope;
  participants: Participant[];
  editItem?: EditableMeetingItem;
  submitEditedItem?: (item: EditableMeetingItem) => void | Promise<void>;
  submitItem: (payload: {
    type: MeetingComposerDraftScope['type'];
    fields: Record<string, string | string[] | undefined>;
  }) => Promise<{ ok: true; itemId: string } | { ok: false; message: string }>;
}>();

const emit = defineEmits<{
  'after-close': [];
  close: [];
  saved: [itemId: string];
}>();

const { t } = useI18n();
const composer = useMeetingComposer({ scope: props.scope });
const hasOptionalTaskFields = ref(false);
const isEditingItem = computed(() => Boolean(props.editItem));

const title = computed(() =>
  isEditingItem.value
    ? props.scope.type === 'task'
      ? t('meeting.editTask')
      : props.scope.type === 'agreement'
        ? t('meeting.editAgreement')
        : t('meeting.editNote')
    : props.scope.type === 'task'
      ? t('meeting.addTask')
      : props.scope.type === 'agreement'
        ? t('meeting.addAgreement')
        : t('meeting.addNote')
);

const fieldLabel = computed(() =>
  props.scope.type === 'task'
    ? t('meeting.taskTitle')
    : props.scope.type === 'agreement'
      ? t('meeting.decisionOrAgreement')
      : t('meeting.note')
);

const primaryField = computed({
  get: () =>
    String(
      props.scope.type === 'task'
        ? (composer.fields.value.title ?? '')
        : (composer.fields.value.text ?? '')
    ),
  set: (value: string) =>
    composer.updateFields({
      ...composer.fields.value,
      [props.scope.type === 'task' ? 'title' : 'text']: value,
    }),
});

const taskResponsibilityOptions = computed<TaskResponsibilityOption[]>(() => [
  {
    value: 'needsDiscussion',
    label: t('meeting.unassigned'),
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

const taskResponsibilityChoice = computed({
  get: () =>
    String(composer.fields.value.responsibilityChoice ?? 'needsDiscussion'),
  set: (value: string) => updateTaskField('responsibilityChoice', value),
});

const taskDueDate = computed({
  get: () => String(composer.fields.value.dueDate ?? ''),
  set: (value: string) => updateTaskField('dueDate', value),
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;

    if (props.editItem) {
      composer.updateFields({ ...props.editItem.fields });
      return;
    }

    composer.load();
  },
  { immediate: true }
);

function close() {
  if (!isEditingItem.value) composer.flush();
  emit('close');
}

function updateTaskField(
  key: 'description' | 'dueDate' | 'responsibilityChoice',
  value: string
) {
  composer.updateFields({ ...composer.fields.value, [key]: value });
}

async function submit() {
  if (!primaryField.value.trim()) {
    composer.errorMessage.value = t('meetingStore.addShortNote');
    return;
  }

  if (isEditingItem.value && props.editItem && props.submitEditedItem) {
    const item =
      props.editItem.type === 'task'
        ? {
            type: 'task' as const,
            fields: {
              title: primaryField.value,
              description: String(composer.fields.value.description ?? ''),
              responsibilityChoice: taskResponsibilityChoice.value,
              dueDate: taskDueDate.value,
            },
          }
        : {
            type: props.editItem.type,
            fields: { text: primaryField.value },
          };

    await props.submitEditedItem(item);
    emit('close');
    return;
  }

  const result = await composer.submit((fields) =>
    props.submitItem({ type: props.scope.type, fields })
  );

  if (result && result.ok) {
    emit('saved', result.itemId);
    emit('close');
  }
}
</script>

<template>
  <BaseBottomSheet
    :open="open"
    :title="title"
    @after-close="emit('after-close')"
    @close="close"
  >
    <form class="meeting-item-composer" @submit.prevent="submit">
      <label
        class="meeting-item-composer__label"
        for="meeting-composer-primary"
      >
        {{ fieldLabel }}
      </label>
      <textarea
        id="meeting-composer-primary"
        v-model="primaryField"
        class="meeting-item-composer__field"
        rows="3"
        :aria-describedby="
          composer.errorMessage.value ? 'meeting-composer-error' : undefined
        "
      />

      <template v-if="scope.type === 'task'">
        <section
          :class="[
            'meeting-item-composer__details-shell',
            { 'is-open': hasOptionalTaskFields },
          ]"
        >
          <button
            class="meeting-item-composer__details-toggle"
            type="button"
            :aria-expanded="hasOptionalTaskFields"
            aria-controls="meeting-composer-task-details"
            @click="hasOptionalTaskFields = !hasOptionalTaskFields"
          >
            <span
              class="meeting-item-composer__details-plus material-symbols-outlined"
              aria-hidden="true"
              >add</span
            >
            <span class="meeting-item-composer__details-title">{{
              t('meeting.optionalDetail')
            }}</span>
            <span
              class="meeting-item-composer__details-chevron material-symbols-outlined"
              aria-hidden="true"
            >
              {{ hasOptionalTaskFields ? 'expand_less' : 'expand_more' }}
            </span>
          </button>
          <div
            id="meeting-composer-task-details"
            :class="[
              'meeting-item-composer__task-details',
              { 'is-open': hasOptionalTaskFields },
            ]"
            :inert="hasOptionalTaskFields ? undefined : true"
            :aria-hidden="!hasOptionalTaskFields"
          >
            <div class="meeting-item-composer__task-details-reveal-inner">
              <div class="meeting-item-composer__task-details-inner">
                <div class="meeting-item-composer__detail-section">
                  <div class="meeting-item-composer__detail-label-row">
                    <label for="meeting-composer-description">{{
                      t('meeting.optionalDetail')
                    }}</label>
                    <span>{{ t('common.optional') }}</span>
                  </div>
                  <textarea
                    id="meeting-composer-description"
                    :value="composer.fields.value.description ?? ''"
                    rows="2"
                    @input="
                      updateTaskField(
                        'description',
                        ($event.target as HTMLTextAreaElement).value
                      )
                    "
                  />
                </div>
                <div class="meeting-item-composer__detail-section">
                  <div class="meeting-item-composer__detail-label-row">
                    <span>{{ t('meeting.responsible') }}</span>
                  </div>
                  <div
                    class="meeting-item-composer__responsibility-rail"
                    role="list"
                    :aria-label="t('meeting.responsible')"
                  >
                    <button
                      v-for="option in taskResponsibilityOptions"
                      :key="option.value"
                      :class="[
                        'meeting-item-composer__responsibility-card',
                        {
                          'is-selected':
                            taskResponsibilityChoice === option.value,
                        },
                      ]"
                      :data-responsibility="option.value"
                      type="button"
                      role="listitem"
                      :aria-pressed="taskResponsibilityChoice === option.value"
                      @click="taskResponsibilityChoice = option.value"
                    >
                      <ParticipantAvatar
                        v-if="option.participant"
                        :participant="option.participant"
                        size="small"
                        decorative
                      />
                      <span
                        v-else
                        class="meeting-item-composer__choice-icon material-symbols-outlined"
                        aria-hidden="true"
                        >{{ option.icon ?? 'person' }}</span
                      >
                      <span>{{ option.label }}</span>
                    </button>
                  </div>
                </div>
                <div class="meeting-item-composer__detail-section">
                  <span class="meeting-item-composer__detail-heading">{{
                    t('meeting.dueDate')
                  }}</span>
                  <DatePickerField
                    id="meeting-composer-due-date"
                    v-model="taskDueDate"
                    :label="t('meeting.dueDate')"
                    presentation="summary"
                    :action-label="t('common.edit')"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>

      <p
        v-if="composer.errorMessage.value"
        id="meeting-composer-error"
        role="alert"
      >
        {{ composer.errorMessage.value }}
      </p>
      <p v-else-if="composer.saveState.value === 'saving'" aria-live="polite">
        {{ t('meeting.presentation.saving') }}
      </p>
      <p v-else-if="composer.saveState.value === 'saved'" aria-live="polite">
        {{ t('meeting.presentation.savedOnDevice') }}
      </p>

      <div class="meeting-item-composer__actions">
        <button
          class="meeting-primary"
          type="submit"
          :disabled="composer.isSubmitting.value"
        >
          {{ isEditingItem ? t('common.save') : title }}
          <span
            v-if="scope.type === 'task'"
            class="material-symbols-outlined"
            aria-hidden="true"
            >check</span
          >
        </button>
      </div>
    </form>
  </BaseBottomSheet>
</template>

<style scoped>
:deep(.base-bottom-sheet__panel) {
  gap: 0;
  border-radius: 30px 30px 0 0;
  padding: 18px 28px calc(24px + env(safe-area-inset-bottom));
}
:deep(.base-bottom-sheet__header) {
  position: relative;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--color-outline-variant);
  padding: 28px 0 18px;
}
:deep(.base-bottom-sheet__header::before) {
  position: absolute;
  top: 4px;
  left: 50%;
  width: 70px;
  height: 5px;
  border-radius: var(--radius-pill);
  background: var(--color-outline-variant);
  content: '';
  transform: translateX(-50%);
}
:deep(.base-bottom-sheet__header h2) {
  margin: 0;
  color: var(--color-on-surface);
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 7vw, 2.2rem);
  line-height: 1.05;
}
:deep(.base-bottom-sheet__header button) {
  min-height: 44px;
  border-color: var(--color-outline-variant);
  background: var(--color-surface-lowest);
  padding: 0 16px;
}
.meeting-item-composer {
  display: grid;
  gap: 16px;
  padding: 2px 0 0;
}
.meeting-item-composer__label,
.meeting-item-composer__detail-label-row label,
.meeting-item-composer__detail-heading {
  font-weight: 700;
}
.meeting-item-composer__field,
.meeting-item-composer__task-details textarea {
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
.meeting-item-composer__field {
  min-height: 108px;
}
.meeting-item-composer__details-shell {
  overflow: hidden;
  border: 1px solid var(--color-outline-variant);
  border-radius: 32px;
  background: #f8f7f2;
}
.meeting-item-composer__details-toggle {
  display: grid;
  width: 100%;
  min-height: 56px;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 10px 14px 10px 18px;
  color: var(--color-primary);
  text-align: left;
}
.meeting-item-composer__details-plus,
.meeting-item-composer__choice-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 50%;
  background: #e9ece5;
  color: var(--color-primary);
}
.meeting-item-composer__details-title {
  font-weight: 600;
}
.meeting-item-composer__details-status {
  border-radius: var(--radius-pill);
  background: color-mix(
    in srgb,
    var(--color-primary) 12%,
    var(--color-surface-lowest)
  );
  padding: 5px 8px;
  color: var(--color-primary);
  font-size: 0.76rem;
  font-weight: 700;
}
.meeting-item-composer__details-chevron {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface-lowest);
  color: var(--color-primary);
  font-size: 1.5rem;
}
.meeting-item-composer__task-details {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transform: translateY(-8px);
  transition:
    grid-template-rows 340ms cubic-bezier(0.22, 0.8, 0.3, 1),
    opacity 220ms ease,
    transform 340ms cubic-bezier(0.22, 0.8, 0.3, 1);
}
.meeting-item-composer__task-details.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
  transform: none;
}
.meeting-item-composer__task-details-inner {
  display: grid;
  gap: 18px;
  padding: 4px 16px 16px;
}
.meeting-item-composer__task-details-reveal-inner {
  min-height: 0;
  overflow: hidden;
}
.meeting-item-composer__detail-section {
  display: grid;
  gap: 8px;
}
.meeting-item-composer__detail-label-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-on-surface);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.meeting-item-composer__detail-label-row > span {
  color: var(--color-on-surface-variant);
  font-weight: 600;
  text-transform: none;
}
.meeting-item-composer__task-details textarea {
  min-height: 88px;
  border-color: var(--color-outline-variant);
  background: var(--color-surface-lowest);
}
.meeting-item-composer__responsibility-rail {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 2px 2px 6px;
  scrollbar-width: thin;
}
.meeting-item-composer__responsibility-card {
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
.meeting-item-composer__responsibility-card.is-selected {
  border: 2px solid var(--color-primary);
  background: color-mix(
    in srgb,
    var(--color-primary) 9%,
    var(--color-surface-lowest)
  );
  box-shadow: inset 0 0 0 1px
    color-mix(in srgb, var(--color-primary) 18%, transparent);
}
.meeting-item-composer__responsibility-card.is-selected
  .meeting-item-composer__choice-icon {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
.meeting-item-composer :deep(.reminder-picker-field__trigger) {
  display: grid;
  width: 100%;
  min-height: 68px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  border: 1px solid var(--color-outline-variant);
  border-radius: 16px;
  background: var(--color-surface-lowest);
  padding: 10px 12px;
  color: var(--color-on-surface);
  text-align: left;
}
.meeting-item-composer :deep(.reminder-picker-field__calendar-icon) {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 11px;
  background: color-mix(
    in srgb,
    var(--color-primary) 10%,
    var(--color-surface-lowest)
  );
  color: var(--color-primary);
}
.meeting-item-composer :deep(.reminder-picker-field__summary-label) {
  font-weight: 800;
}
.meeting-item-composer :deep(.reminder-picker-field__action) {
  border-radius: 9px;
  background: color-mix(
    in srgb,
    var(--color-primary) 10%,
    var(--color-surface-lowest)
  );
  padding: 7px 9px;
  color: var(--color-primary);
  font-size: 0.8rem;
  font-weight: 800;
}
.meeting-item-composer__actions {
  display: flex;
  gap: 12px;
  border-top: 1px solid var(--color-outline-variant);
  padding-top: 16px;
}
.meeting-item-composer__actions > button {
  flex: 1;
  width: 100%;
}
@media (prefers-reduced-motion: reduce) {
  .meeting-item-composer__task-details {
    transition-duration: 0.01ms;
  }
}
</style>
