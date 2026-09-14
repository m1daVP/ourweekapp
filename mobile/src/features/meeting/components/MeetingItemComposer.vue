<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MeetingComposerDraftScope } from '@/features/meeting/meetingComposerDrafts';
import type { Participant } from '@/features/participants/types';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import { useMeetingComposer } from '@/features/meeting/composables/useMeetingComposer';

const props = defineProps<{
  open: boolean;
  scope: MeetingComposerDraftScope;
  participants: Participant[];
  submitItem: (payload: {
    type: MeetingComposerDraftScope['type'];
    fields: Record<string, string | string[] | undefined>;
  }) => Promise<{ ok: true; itemId: string } | { ok: false; message: string }>;
}>();

const emit = defineEmits<{
  close: [];
  saved: [itemId: string];
}>();

const { t } = useI18n();
const composer = useMeetingComposer({ scope: props.scope });
const hasOptionalTaskFields = ref(false);

const title = computed(() =>
  props.scope.type === 'task'
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

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) composer.load();
  }
);

function close() {
  composer.flush();
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
  <BaseBottomSheet :open="open" :title="title" @close="close">
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
        <button
          class="meeting-item-composer__optional-toggle"
          type="button"
          :aria-expanded="hasOptionalTaskFields"
          @click="hasOptionalTaskFields = !hasOptionalTaskFields"
        >
          {{ t('meeting.optionalDetail') }}
        </button>
        <div
          v-if="hasOptionalTaskFields"
          class="meeting-item-composer__optional-fields"
        >
          <label for="meeting-composer-description">{{
            t('meeting.optionalDetail')
          }}</label>
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
          <label for="meeting-composer-responsibility">{{
            t('meeting.responsible')
          }}</label>
          <select
            id="meeting-composer-responsibility"
            :value="
              composer.fields.value.responsibilityChoice ?? 'needsDiscussion'
            "
            @change="
              updateTaskField(
                'responsibilityChoice',
                ($event.target as HTMLSelectElement).value
              )
            "
          >
            <option value="needsDiscussion">
              {{ t('meeting.unassigned') }}
            </option>
            <option value="shared">{{ t('meeting.shared') }}</option>
            <option
              v-for="participant in participants"
              :key="participant.id"
              :value="participant.id"
            >
              {{ participant.name }}
            </option>
          </select>
          <label for="meeting-composer-due-date">{{
            t('meeting.dueDate')
          }}</label>
          <input
            id="meeting-composer-due-date"
            type="date"
            :value="composer.fields.value.dueDate ?? ''"
            @input="
              updateTaskField(
                'dueDate',
                ($event.target as HTMLInputElement).value
              )
            "
          />
        </div>
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
        <button type="button" @click="close">{{ t('common.cancel') }}</button>
        <button
          class="meeting-primary"
          type="submit"
          :disabled="composer.isSubmitting.value"
        >
          {{ title }}
        </button>
      </div>
    </form>
  </BaseBottomSheet>
</template>

<style scoped>
.meeting-item-composer {
  display: grid;
  gap: 12px;
  padding: 16px;
}
.meeting-item-composer__label,
.meeting-item-composer__optional-fields label {
  font-weight: 700;
}
.meeting-item-composer__field,
.meeting-item-composer__optional-fields textarea,
.meeting-item-composer__optional-fields input,
.meeting-item-composer__optional-fields select {
  width: 100%;
  min-height: 44px;
}
.meeting-item-composer__optional-fields {
  display: grid;
  gap: 8px;
}
.meeting-item-composer__optional-toggle {
  justify-self: start;
}
.meeting-item-composer__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
