<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SavedMeetingItemGroup } from '@/features/meeting/savedMeetingSummary';

const props = defineProps<{
  group: SavedMeetingItemGroup;
}>();

const { t } = useI18n();

const labelKey = computed(
  () =>
    ({
      notes: 'meeting.notes',
      tasks: 'meeting.tasks',
      agreements: 'meeting.agreements',
    })[props.group.kind]
);
</script>

<template>
  <section class="saved-meeting-item-group">
    <h3>{{ t(labelKey) }}</h3>
    <ul class="saved-meeting-item-group__list">
      <li
        v-for="row in group.rows"
        :key="row.id"
        class="saved-meeting-item-row"
      >
        <div
          v-if="row.leadingMeta || row.trailingMeta"
          class="saved-meeting-item-row__meta"
        >
          <span v-if="row.leadingMeta">{{ row.leadingMeta }}</span>
          <time v-if="row.trailingMeta">{{ row.trailingMeta }}</time>
        </div>
        <div class="saved-meeting-item-row__content">
          <div>
            <p>{{ row.title }}</p>
            <small v-if="row.detail">{{ row.detail }}</small>
          </div>
          <span v-if="row.badge" class="saved-meeting-item-row__badge">
            {{ row.badge }}
          </span>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.saved-meeting-item-group {
  display: grid;
  gap: 8px;
}

.saved-meeting-item-group h3 {
  margin: 0;
  color: var(--color-outline);
  font-size: var(--font-size-label-sm);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.saved-meeting-item-group__list {
  overflow: hidden;
  margin: 0;
  border: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 52%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-lowest) 90%, transparent);
  padding: 0 14px;
  list-style: none;
}

.saved-meeting-item-row {
  display: grid;
  gap: 5px;
  padding: 12px 0;
}

.saved-meeting-item-row + .saved-meeting-item-row {
  border-top: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 42%, transparent);
}

.saved-meeting-item-row__meta,
.saved-meeting-item-row__content {
  display: flex;
  min-width: 0;
  justify-content: space-between;
  gap: 12px;
}

.saved-meeting-item-row__meta {
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-sm);
  line-height: 1.35;
}

.saved-meeting-item-row__meta time {
  flex: none;
  color: var(--color-outline);
}

.saved-meeting-item-row__content {
  align-items: start;
}

.saved-meeting-item-row__content > div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.saved-meeting-item-row p,
.saved-meeting-item-row small {
  overflow-wrap: anywhere;
}

.saved-meeting-item-row p {
  margin: 0;
  color: var(--color-on-surface);
  font-size: var(--font-size-body-md);
  line-height: 1.45;
}

.saved-meeting-item-row small {
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-sm);
  line-height: 1.4;
}

.saved-meeting-item-row__badge {
  flex: none;
  max-width: 55%;
  border: 1px solid color-mix(in srgb, var(--color-tertiary) 26%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-tertiary-fixed) 38%, white);
  padding: 5px 9px;
  color: var(--color-tertiary);
  font-size: var(--font-size-label-sm);
  line-height: 1.25;
  text-align: center;
}

@media (max-width: 360px) {
  .saved-meeting-item-row__content {
    flex-direction: column;
  }

  .saved-meeting-item-row__badge {
    max-width: 100%;
  }
}
</style>
