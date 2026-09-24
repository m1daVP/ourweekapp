<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  getMeetingSectionTitle,
  getMeetingTemplateDescription,
  getMeetingTemplateName,
} from '@/features/meeting/meetingTemplates';
import type { MeetingTemplate } from '@/features/meeting/types';

defineProps<{
  template: MeetingTemplate;
  locked: boolean;
  selected: boolean;
}>();

const emit = defineEmits<{
  select: [template: MeetingTemplate];
}>();

const { t } = useI18n();

const templateIconMap: Record<string, string> = {
  'weekly-family-check-in': 'family_restroom',
  'couple-reset': 'favorite',
  'family-with-kids': 'child_care',
  'money-check-in': 'account_balance_wallet',
  'conflict-cleanup': 'cleaning_services',
  'busy-week-planning': 'event_available',
};

const templateToneMap: Record<string, string> = {
  'weekly-family-check-in': 'sage',
  'couple-reset': 'honey',
  'family-with-kids': 'rose',
  'money-check-in': 'mint',
  'conflict-cleanup': 'coral',
  'busy-week-planning': 'lavender',
};

function getTemplateIcon(template: MeetingTemplate) {
  return templateIconMap[template.id] ?? 'forum';
}

function getTemplateTone(template: MeetingTemplate) {
  return templateToneMap[template.id] ?? 'sage';
}

function getTemplateDescription(template: MeetingTemplate) {
  return getMeetingTemplateDescription(template.id, template.description);
}
</script>

<template>
  <button
    type="button"
    :class="[
      'template-card',
      `template-card--${getTemplateTone(template)}`,
      {
        'is-selected': selected,
        'is-locked': locked,
      },
    ]"
    :aria-pressed="selected"
    @click="emit('select', template)"
  >
    <span
      :class="[
        'template-card__status',
        'material-symbols-outlined',
        'filled',
        { 'is-visible': selected && !locked },
      ]"
      aria-hidden="true"
    >
      check_circle
    </span>
    <span
      :class="[
        'template-card__status',
        'template-card__status--locked',
        'material-symbols-outlined',
        { 'is-visible': locked },
      ]"
      aria-hidden="true"
    >
      lock
    </span>

    <div class="template-card__main">
      <span class="template-card__icon" aria-hidden="true">
        <span class="material-symbols-outlined">
          {{ getTemplateIcon(template) }}
        </span>
      </span>

      <div class="template-card__copy">
        <div class="template-card__title-row">
          <h2>{{ getMeetingTemplateName(template.id, template.name) }}</h2>
          <span v-if="template.access === 'free'" class="template-card__badge">
            {{ t('common.free') }}
          </span>
        </div>

        <p>
          {{ getTemplateDescription(template) }}
        </p>
      </div>
    </div>

    <div
      :class="['template-card__sections-frame', { 'is-visible': selected }]"
      :aria-hidden="!selected"
    >
      <ul
        class="template-card__sections"
        :aria-label="t('templatePage.sectionsLabel')"
      >
        <li v-for="section in template.sections.slice(0, 3)" :key="section.id">
          {{ getMeetingSectionTitle(section.id, section.title) }}
        </li>
      </ul>
    </div>
  </button>
</template>
