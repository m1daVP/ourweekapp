<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MeetingExportFormat } from '@/features/export/services/exportService';
import UpgradePrompt from '@/shared/components/UpgradePrompt.vue';

defineProps<{
  available: boolean;
  format: MeetingExportFormat;
  exporting: boolean;
}>();

const emit = defineEmits<{
  'update:format': [format: MeetingExportFormat];
  copy: [];
  share: [];
  pdf: [];
}>();

const { t } = useI18n();
const titleId = `saved-meeting-export-${useId()}`;
const formatOptions = computed<
  Array<{
    value: MeetingExportFormat;
    label: string;
    help: string;
  }>
>(() => [
  {
    value: 'text',
    label: t('meeting.plainText'),
    help: t('meeting.plainTextHelp'),
  },
  {
    value: 'markdown',
    label: t('common.markdown'),
    help: t('meeting.markdownHelp'),
  },
]);

function selectFormat(format: MeetingExportFormat) {
  emit('update:format', format);
}
</script>

<template>
  <section
    :class="['saved-meeting-export-card', { 'is-locked': !available }]"
    :aria-labelledby="titleId"
  >
    <template v-if="available">
      <div class="saved-meeting-export-card__copy">
        <span class="material-symbols-outlined" aria-hidden="true">
          ios_share
        </span>
        <div>
          <h2 :id="titleId">{{ t('meeting.exportMeeting') }}</h2>
          <p>{{ t('meeting.exportHelp') }}</p>
        </div>
      </div>

      <fieldset class="saved-meeting-export-card__formats">
        <legend>{{ t('meeting.format') }}</legend>
        <label
          v-for="option in formatOptions"
          :key="option.value"
          :class="{ 'is-selected': format === option.value }"
        >
          <input
            :checked="format === option.value"
            type="radio"
            name="saved-meeting-export-format"
            :value="option.value"
            @change="selectFormat(option.value)"
          />
          <span>
            <strong>{{ option.label }}</strong>
            <small>{{ option.help }}</small>
          </span>
        </label>
      </fieldset>

      <div class="saved-meeting-export-card__actions">
        <button
          data-testid="saved-export-copy"
          class="meeting-primary"
          type="button"
          :disabled="exporting"
          @click="emit('copy')"
        >
          {{ t('common.copy') }}
        </button>
        <button type="button" :disabled="exporting" @click="emit('share')">
          {{ t('common.shareOrSave') }}
        </button>
        <button type="button" :disabled="exporting" @click="emit('pdf')">
          {{ t('common.pdf') }}
        </button>
      </div>
    </template>

    <UpgradePrompt
      v-else
      feature="export"
      :title="t('meeting.exportPremiumTitle')"
      :message="t('meeting.exportPremiumMessage')"
    />
  </section>
</template>

<style scoped>
.saved-meeting-export-card {
  display: grid;
  gap: 18px;
  border: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 42%, transparent);
  border-radius: 24px;
  background: var(--color-surface-lowest);
  box-shadow: var(--shadow-card);
  padding: 18px;
}

.saved-meeting-export-card.is-locked {
  overflow: hidden;
  padding: 0;
}

.saved-meeting-export-card__copy {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: start;
}

.saved-meeting-export-card__copy > .material-symbols-outlined {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
}

.saved-meeting-export-card h2,
.saved-meeting-export-card p {
  margin: 0;
}

.saved-meeting-export-card h2 {
  color: var(--color-on-surface);
  font-family: var(--font-display);
  font-size: var(--font-size-headline-md);
}

.saved-meeting-export-card p {
  margin-top: 5px;
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-lg);
  line-height: 1.4;
}

.saved-meeting-export-card__formats {
  display: grid;
  gap: 8px;
  margin: 0;
  border: 0;
  padding: 0;
}

.saved-meeting-export-card__formats legend {
  margin-bottom: 4px;
  color: var(--color-outline);
  font-size: var(--font-size-label-sm);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.saved-meeting-export-card__formats label {
  display: grid;
  grid-template-columns: auto 1fr;
  min-height: 56px;
  align-items: start;
  gap: 12px;
  border: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 42%, transparent);
  border-radius: var(--radius-md);
  padding: 12px;
}

.saved-meeting-export-card__formats label.is-selected {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-fixed) 44%, white);
}

.saved-meeting-export-card__formats input {
  margin-top: 3px;
}

.saved-meeting-export-card__formats span {
  display: grid;
  gap: 3px;
}

.saved-meeting-export-card__formats small {
  color: var(--color-on-surface-variant);
  line-height: 1.35;
}

.saved-meeting-export-card__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.saved-meeting-export-card__actions button {
  min-height: var(--touch-target-min);
}

.saved-meeting-export-card__actions button:first-child {
  grid-column: 1 / -1;
}

.saved-meeting-export-card :deep(.upgrade-prompt) {
  min-height: 100%;
  padding: 20px;
}

@media (max-width: 360px) {
  .saved-meeting-export-card__actions {
    grid-template-columns: 1fr;
  }

  .saved-meeting-export-card__actions button:first-child {
    grid-column: auto;
  }
}
</style>
