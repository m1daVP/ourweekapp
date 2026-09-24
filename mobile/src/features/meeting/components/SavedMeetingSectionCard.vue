<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import SavedMeetingItemGroup from './SavedMeetingItemGroup.vue';
import type { SavedMeetingSectionViewModel } from '@/features/meeting/savedMeetingSummary';

defineProps<{
  section: SavedMeetingSectionViewModel;
  variant: 'regular' | 'final';
}>();

const { t } = useI18n();
</script>

<template>
  <article
    :class="[
      'saved-meeting-section-card',
      `saved-meeting-section-card--${variant}`,
    ]"
    :data-section-variant="variant"
  >
    <header class="saved-meeting-section-card__header">
      <div>
        <h2>{{ section.title }}</h2>
        <p>{{ section.prompt }}</p>
      </div>
      <span
        class="saved-meeting-section-card__status"
        :data-section-status="section.status"
      >
        {{ t(`meeting.savedSummary.${section.status}`) }}
      </span>
    </header>

    <div
      v-if="section.groups.length"
      class="saved-meeting-section-card__groups"
    >
      <SavedMeetingItemGroup
        v-for="group in section.groups"
        :key="group.kind"
        :group="group"
      />
    </div>
    <p v-else class="saved-meeting-section-card__empty">
      {{ t('meeting.savedSummary.sectionEmpty') }}
    </p>
  </article>
</template>

<style scoped>
.saved-meeting-section-card {
  display: grid;
  gap: 16px;
  border: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 42%, transparent);
  border-radius: 28px;
  background: var(--color-surface-lowest);
  box-shadow: var(--shadow-card);
  padding: 20px 18px;
}

.saved-meeting-section-card--final {
  gap: 18px;
  border-color: color-mix(
    in srgb,
    var(--color-primary) 24%,
    var(--color-outline-variant)
  );
  padding-block: 22px;
}

.saved-meeting-section-card__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 10px;
}

.saved-meeting-section-card__header > div {
  min-width: 0;
}

.saved-meeting-section-card h2 {
  margin: 0;
  color: var(--color-on-surface);
  font-family: var(--font-display);
  font-size: clamp(1.2rem, 5.5vw, 1.42rem);
  line-height: 1.15;
}

.saved-meeting-section-card__header p {
  margin: 5px 0 0;
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-lg);
  line-height: 1.35;
}

.saved-meeting-section-card__status {
  border-radius: var(--radius-pill);
  background: var(--color-surface-low);
  padding: 5px 10px;
  color: var(--color-outline);
  font-size: var(--font-size-label-sm);
  line-height: 1;
  white-space: nowrap;
}

.saved-meeting-section-card__status[data-section-status='filled'] {
  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent);
  background: color-mix(in srgb, var(--color-primary-fixed) 52%, white);
  color: var(--color-primary);
}

.saved-meeting-section-card__groups {
  display: grid;
  gap: 18px;
  border-top: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 36%, transparent);
  padding-top: 16px;
}

.saved-meeting-section-card__empty {
  margin: 0;
  border-top: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 36%, transparent);
  padding-top: 12px;
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-lg);
  font-style: italic;
  line-height: 1.4;
}

@media (max-width: 360px) {
  .saved-meeting-section-card {
    border-radius: 24px;
    padding-inline: 16px;
  }

  .saved-meeting-section-card__header {
    gap: 8px;
  }
}
</style>
