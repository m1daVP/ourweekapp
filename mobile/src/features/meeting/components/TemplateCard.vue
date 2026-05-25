<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  getMeetingSectionTitle,
  getMeetingTemplateDescription,
  getMeetingTemplateName,
} from '@/features/meeting/meetingTemplates';
import type { MeetingTemplate } from '@/features/meeting/types';
import PremiumBadge from '@/shared/components/PremiumBadge.vue';

defineProps<{
  template: MeetingTemplate;
  locked: boolean;
}>();

const emit = defineEmits<{
  select: [template: MeetingTemplate];
}>();

const { t } = useI18n();
</script>

<template>
  <article :class="['template-card', { 'is-locked': locked }]">
    <div class="template-card__header">
      <div>
        <h2>{{ getMeetingTemplateName(template.id, template.name) }}</h2>
        <p>
          {{ getMeetingTemplateDescription(template.id, template.description) }}
        </p>
      </div>
      <PremiumBadge v-if="template.access === 'premium'" />
    </div>

    <ul
      class="template-card__sections"
      :aria-label="t('templatePage.sectionsLabel')"
    >
      <li v-for="section in template.sections" :key="section.id">
        {{ getMeetingSectionTitle(section.id, section.title) }}
      </li>
    </ul>

    <button
      type="button"
      :class="['template-card__button', { 'meeting-primary': !locked }]"
      @click="emit('select', template)"
    >
      {{
        locked ? t('templatePage.upgradeToUse') : t('templatePage.startMeeting')
      }}
    </button>
  </article>
</template>
