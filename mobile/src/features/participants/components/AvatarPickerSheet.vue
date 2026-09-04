<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  avatarCatalog,
  avatarGroups,
  type AvatarType,
} from '@/features/participants/avatarCatalog';
import { participantColors } from '@/app/stores/participants';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';

const props = defineProps<{
  open: boolean;
  avatarType: AvatarType | null;
  avatarColor: string;
}>();

const emit = defineEmits<{
  close: [];
  selectAvatar: [avatarType: AvatarType];
  selectColor: [color: string];
  selectCustomColor: [];
}>();

const { t } = useI18n();
const groups = computed(() =>
  avatarGroups.map((groupId) => ({
    id: groupId,
    avatars: avatarCatalog.filter((avatar) => avatar.groupId === groupId),
  }))
);

function selectAvatar(avatarType: AvatarType) {
  emit('selectAvatar', avatarType);
  emit('close');
}

function selectColor(color: string) {
  emit('selectColor', color);
  emit('close');
}
</script>

<template>
  <BaseBottomSheet :open="open" :title="t('settings.avatar')" @close="emit('close')">
    <section class="avatar-picker">
      <section>
        <h3>{{ t('settings.avatarColors') }}</h3>
        <div class="avatar-picker__colors">
          <button
            v-for="color in participantColors"
            :key="color"
            type="button"
            :aria-label="t('settings.selectedAvatarColor', { color: color.toUpperCase() })"
            :aria-pressed="avatarType === null && avatarColor === color"
            @click="selectColor(color)"
          >
            <span :style="{ backgroundColor: color }" />
          </button>
          <button
            class="avatar-picker__custom-color"
            type="button"
            @click="emit('selectCustomColor')"
          >
            {{ t('settings.customAvatarColor') }}
          </button>
        </div>
      </section>

      <section>
        <h3>{{ t('settings.avatarSet') }}</h3>
        <div v-for="group in groups" :key="group.id" class="avatar-picker__group">
          <h4>{{ t(`settings.${group.id}`) }}</h4>
          <div class="avatar-picker__grid">
            <button
              v-for="avatar in group.avatars"
              :key="avatar.id"
              type="button"
              :data-avatar-id="avatar.id"
              :aria-label="t('settings.selectAvatar')"
              :aria-pressed="avatarType === avatar.id"
              @click="selectAvatar(avatar.id)"
            >
              <img v-if="avatar.asset" :src="avatar.asset" alt="" />
              <span v-else aria-hidden="true">?</span>
            </button>
          </div>
        </div>
      </section>
    </section>
  </BaseBottomSheet>
</template>

<style scoped>
.avatar-picker { display: grid; gap: var(--space-5); padding: 0 var(--space-4) var(--space-4); }
.avatar-picker h3, .avatar-picker h4 { margin: 0 0 var(--space-2); }
.avatar-picker__colors, .avatar-picker__grid { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.avatar-picker button { display: grid; width: 48px; height: 48px; place-items: center; border: 2px solid transparent; border-radius: 50%; background: var(--color-surface-low); }
.avatar-picker button[aria-pressed='true'] { border-color: var(--color-primary); }
.avatar-picker__colors span { width: 32px; height: 32px; border-radius: 50%; }
.avatar-picker button img { width: 100%; height: 100%; object-fit: contain; }
.avatar-picker__custom-color { width: auto !important; padding: 0 var(--space-3); border-radius: var(--radius-pill) !important; }
.avatar-picker__group + .avatar-picker__group { margin-top: var(--space-3); }
</style>
