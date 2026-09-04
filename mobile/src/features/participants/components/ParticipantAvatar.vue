<script setup lang="ts">
import { computed } from 'vue';
import type { Participant } from '@/features/participants/types';
import { getAvatarAsset } from '@/features/participants/avatarCatalog';

const props = withDefaults(
  defineProps<{
    participant: Pick<
      Participant,
      'name' | 'initials' | 'avatarColor' | 'avatarType'
    >;
    size?: 'small' | 'medium' | 'large';
    decorative?: boolean;
  }>(),
  {
    size: 'medium',
    decorative: false,
  }
);

const asset = computed(() => getAvatarAsset(props.participant.avatarType));
const className = computed(() => `participant-avatar--${props.size}`);
</script>

<template>
  <span
    v-if="asset"
    :class="['participant-avatar', className]"
    :aria-hidden="decorative || undefined"
  >
    <img
      class="participant-avatar__image"
      :src="asset"
      :alt="decorative ? '' : participant.name"
    />
  </span>
  <span
    v-else
    :class="['participant-avatar', className]"
    :style="{ backgroundColor: participant.avatarColor }"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : participant.name"
    :aria-hidden="decorative || undefined"
  >
    {{ participant.initials }}
  </span>
</template>

<style scoped>
.participant-avatar {
  display: inline-grid;
  flex: 0 0 auto;
  overflow: hidden;
  place-items: center;
  border-radius: 50%;
  color: var(--color-on-primary);
  font-weight: 800;
  line-height: 1;
}

.participant-avatar--small {
  width: 28px;
  height: 28px;
  font-size: 0.72rem;
}

.participant-avatar--medium {
  width: 40px;
  height: 40px;
  font-size: 0.85rem;
}

.participant-avatar--large {
  width: 48px;
  height: 48px;
  font-size: 1rem;
}

.participant-avatar__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
