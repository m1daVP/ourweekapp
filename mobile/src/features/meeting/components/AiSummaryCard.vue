<script lang="ts">
import type { Meeting } from '../types';
import type { AiRecapRecovery } from '../aiSummaryService';

export type AiSummaryCardState = 'empty' | 'loading' | 'available' | 'error';

export interface AiSummaryCardProps {
  meeting: Meeting | null;
  state: AiSummaryCardState;
  canGenerate: boolean;
  canRegenerate: boolean;
  generating: boolean;
  recovery: AiRecapRecovery | null;
  errorMessage: string;
  emptyMessage: string;
  loadingMessage: string;
  title: string;
  disclaimer: string;
  generateLabel: string;
}
</script>

<script setup lang="ts">
import { computed, useId } from 'vue';
import AiRecapRecoveryPanel from './AiRecapRecoveryPanel.vue';
import MeetingFollowThrough from './MeetingFollowThrough.vue';
import RecapAllowanceStatus from './RecapAllowanceStatus.vue';

const props = defineProps<AiSummaryCardProps>();

const emit = defineEmits<{
  generate: [];
  regenerate: [];
  retry: [];
}>();

const titleId = useId();
const hasSavedSummary = computed(() => Boolean(props.meeting?.aiSummary));
const showsSavedSummary = computed(
  () =>
    props.state === 'available' ||
    (props.state === 'error' && hasSavedSummary.value)
);
</script>

<template>
  <section
    class="ai-summary-card meeting-summary-ai-card ai-summary-panel"
    :aria-labelledby="titleId"
  >
    <header class="ai-summary-card__header">
      <span class="ai-summary-card__icon" aria-hidden="true">
        <span class="material-symbols-outlined">auto_awesome</span>
      </span>
      <h2 :id="titleId">{{ title }}</h2>
    </header>

    <div class="ai-summary-card__content">
      <p v-if="state === 'empty'">{{ emptyMessage }}</p>
      <p v-else-if="state === 'loading'">{{ loadingMessage }}</p>
      <template v-else-if="showsSavedSummary">
        <AiRecapRecoveryPanel
          v-if="recovery"
          :recovery="recovery"
          @retry="emit('retry')"
        />
        <MeetingFollowThrough
          v-if="meeting?.aiSummary"
          :meeting="meeting"
          :can-regenerate="canRegenerate"
          :generating="generating"
          @regenerate="emit('regenerate')"
        />
        <slot name="legacy" />
        <p class="ai-summary-card__disclaimer">{{ disclaimer }}</p>
      </template>
      <template v-else>
        <AiRecapRecoveryPanel
          v-if="recovery"
          :recovery="recovery"
          @retry="emit('retry')"
        />
        <p v-else-if="state === 'error'">{{ errorMessage }}</p>
      </template>
    </div>

    <div class="ai-summary-card__allowance">
      <RecapAllowanceStatus />
    </div>

    <button
      v-if="state === 'empty' && canGenerate"
      data-testid="generate-meeting-recap"
      class="ai-summary-card__action meeting-summary-ai-card__button"
      type="button"
      :disabled="generating"
      @click="emit('generate')"
    >
      <span class="material-symbols-outlined" aria-hidden="true">
        auto_awesome
      </span>
      {{ generateLabel }}
    </button>
  </section>
</template>
