<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useTasksStore } from '@/app/stores/tasks';
import TemplateCard from '@/features/meeting/components/TemplateCard.vue';
import {
  DEFAULT_MEETING_TEMPLATE_ID,
  getMeetingTemplateName,
  meetingTemplates,
} from '@/features/meeting/meetingTemplates';
import type { MeetingTemplate } from '@/features/meeting/types';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';

const router = useRouter();
const { t } = useI18n();
const meetingsStore = useMeetingsStore();
const tasksStore = useTasksStore();
const { canUseFeature } = useFeatureAccess();
const { can } = useWorkspacePermissions();

const formError = ref('');
const selectedTemplateId = ref(DEFAULT_MEETING_TEMPLATE_ID);
const canCreateMeeting = computed(() => can('createMeetings'));

const activeDraft = computed(
  () =>
    (meetingsStore.activeMeeting?.status !== 'completed'
      ? meetingsStore.activeMeeting
      : null) ??
    meetingsStore.meetings.find((meeting) => meeting.status !== 'completed') ??
    null
);
const selectedTemplate = computed(
  () =>
    meetingTemplates.find(
      (template) => template.id === selectedTemplateId.value
    ) ?? meetingTemplates[0]
);
const selectedTemplateLocked = computed(
  () => !!selectedTemplate.value && isTemplateLocked(selectedTemplate.value)
);
const ctaLabel = computed(() =>
  selectedTemplateLocked.value
    ? t('templatePage.getPremium')
    : t('templatePage.startMeeting')
);

function isTemplateLocked(template: MeetingTemplate) {
  return template.access === 'premium' && !canUseFeature('additionalTemplates');
}

function resumeDraft() {
  if (!activeDraft.value) {
    return;
  }

  meetingsStore.resumeMeeting(activeDraft.value.id);
  router.push({ name: 'meeting' });
}

function selectTemplate(template: MeetingTemplate) {
  formError.value = '';
  selectedTemplateId.value = template.id;
}

function startSelectedTemplate() {
  formError.value = '';

  if (!canCreateMeeting.value) {
    formError.value = t('meeting.roleCannotEditMeetings');
    return;
  }

  if (!selectedTemplate.value || selectedTemplateLocked.value) {
    router.push({
      name: 'upgrade',
      query: { lockedFeature: 'additionalTemplates' },
    });
    return;
  }

  meetingsStore.startNewMeetingFromTemplate(selectedTemplate.value.id);
  tasksStore.syncFromMeetings(meetingsStore.meetings);
  router.push({ name: 'meeting' });
}
</script>

<template>
  <section class="page-stack templates-page templates-page--redesign">
    <header class="templates-hero">
      <p class="page-copy">{{ t('templatePage.intro') }}</p>
    </header>

    <section
      v-if="activeDraft && activeDraft.status !== 'completed'"
      class="content-panel template-draft-panel"
    >
      <div>
        <h2>{{ t('templatePage.continueDraft') }}</h2>
        <p>
          {{
            getMeetingTemplateName(activeDraft.templateId, activeDraft.title)
          }}
        </p>
      </div>
      <button type="button" class="meeting-primary" @click="resumeDraft">
        {{ t('common.resume') }}
      </button>
    </section>

    <p v-if="formError" class="meeting-error" role="alert">
      {{ formError }}
    </p>

    <div class="template-list">
      <TemplateCard
        v-for="template in meetingTemplates"
        :key="template.id"
        :template="template"
        :locked="isTemplateLocked(template)"
        :selected="selectedTemplateId === template.id"
        @select="selectTemplate"
      />
    </div>

    <div class="templates-cta">
      <button
        type="button"
        :class="[
          'meeting-primary',
          'templates-cta__button',
          { 'templates-cta__button--premium': selectedTemplateLocked },
        ]"
        @click="startSelectedTemplate"
      >
        <span>{{ ctaLabel }}</span>
        <span class="material-symbols-outlined" aria-hidden="true">
          {{ selectedTemplateLocked ? 'workspace_premium' : 'arrow_forward' }}
        </span>
      </button>
    </div>
  </section>
</template>
