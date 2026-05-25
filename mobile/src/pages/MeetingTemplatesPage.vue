<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import TemplateCard from '@/features/meeting/components/TemplateCard.vue';
import { meetingTemplates } from '@/features/meeting/meetingTemplates';
import { getMeetingTemplateName } from '@/features/meeting/meetingTemplates';
import type { MeetingTemplate } from '@/features/meeting/types';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';

const router = useRouter();
const { t } = useI18n();
const meetingsStore = useMeetingsStore();
const participantsStore = useParticipantsStore();
const tasksStore = useTasksStore();
const { canUseFeature } = useFeatureAccess();
const { can } = useWorkspacePermissions();

const formError = ref('');
const canCreateMeeting = computed(() => can('createMeetings'));

const activeDraft = computed(
  () =>
    (meetingsStore.activeMeeting?.status !== 'completed'
      ? meetingsStore.activeMeeting
      : null) ??
    meetingsStore.meetings.find((meeting) => meeting.status !== 'completed') ??
    null
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

  if (!canCreateMeeting.value) {
    formError.value = t('meeting.roleCannotEditMeetings');
    return;
  }

  if (isTemplateLocked(template)) {
    router.push({
      name: 'upgrade',
      query: { lockedFeature: 'additionalTemplates' },
    });
    return;
  }

  participantsStore.ensureDefaultParticipants();
  meetingsStore.startNewMeetingFromTemplate(template.id);
  tasksStore.syncFromMeetings(meetingsStore.meetings);
  router.push({ name: 'meeting' });
}
</script>

<template>
  <section class="page-stack templates-page">
    <header>
      <p class="page-kicker">{{ t('templatePage.kicker') }}</p>
      <h1>{{ t('templatePage.title') }}</h1>
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
        @select="selectTemplate"
      />
    </div>
  </section>
</template>
