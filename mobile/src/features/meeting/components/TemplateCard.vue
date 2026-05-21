<script setup lang="ts">
import type { MeetingTemplate } from '@/features/meeting/types';
import PremiumBadge from '@/shared/components/PremiumBadge.vue';

defineProps<{
  template: MeetingTemplate;
  locked: boolean;
}>();

const emit = defineEmits<{
  select: [template: MeetingTemplate];
}>();
</script>

<template>
  <article :class="['template-card', { 'is-locked': locked }]">
    <div class="template-card__header">
      <div>
        <h2>{{ template.name }}</h2>
        <p>{{ template.description }}</p>
      </div>
      <PremiumBadge v-if="template.access === 'premium'" />
    </div>

    <ul class="template-card__sections" aria-label="Meeting sections">
      <li v-for="section in template.sections" :key="section.id">
        {{ section.title }}
      </li>
    </ul>

    <button
      type="button"
      :class="['template-card__button', { 'meeting-primary': !locked }]"
      @click="emit('select', template)"
    >
      {{ locked ? 'Upgrade to use' : 'Start meeting' }}
    </button>
  </article>
</template>
