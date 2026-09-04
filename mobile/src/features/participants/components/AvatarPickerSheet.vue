<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import iro from '@jaames/iro';
import {
  avatarCatalog,
  avatarGroups,
  type AvatarType,
} from '@/features/participants/avatarCatalog';
import { participantColors } from '@/app/stores/participants';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import { normalizeOpaqueHexColor } from '@/features/participants/utils/avatarColor';

const props = defineProps<{
  open: boolean;
  avatarType: AvatarType | null;
  avatarColor: string;
}>();

const emit = defineEmits<{
  close: [];
  selectAvatar: [avatarType: AvatarType];
  selectColor: [color: string];
}>();

const { t } = useI18n();
const groups = computed(() =>
  avatarGroups.map((groupId) => ({
    id: groupId,
    avatars: avatarCatalog.filter((avatar) => avatar.groupId === groupId),
  }))
);
const showCustomColor = ref(false);
const pickerElement = ref<HTMLElement | null>(null);
const draftColor = ref(props.avatarColor);
const draftAvatarType = ref<AvatarType | null>(props.avatarType);
const draftMode = ref<'avatar' | 'color'>(
  props.avatarType ? 'avatar' : 'color'
);
const hexError = ref('');
let picker: ReturnType<typeof iro.ColorPicker> | null = null;

function destroyPicker() {
  picker = null;
  pickerElement.value?.replaceChildren();
}

async function toggleCustomColor() {
  if (showCustomColor.value) {
    showCustomColor.value = false;
    destroyPicker();
    return;
  }

  showCustomColor.value = true;
  draftColor.value = normalizeOpaqueHexColor(props.avatarColor) ?? '#496a8f';
  hexError.value = '';
  await nextTick();
  destroyPicker();
  if (!pickerElement.value) return;
  picker = iro.ColorPicker(pickerElement.value, {
    color: draftColor.value,
    width: 260,
    layout: [
      { component: iro.ui.Wheel },
      { component: iro.ui.Slider, options: { sliderSize: 24, sliderType: 'value' } },
    ],
  });
  picker.on('color:change', (color: { hexString: string }) => {
    draftColor.value = color.hexString.toLocaleLowerCase();
    draftMode.value = 'color';
    hexError.value = '';
  });
}

function updateCustomColorDraft() {
  draftMode.value = 'color';
  hexError.value = '';
}

function selectAvatar(avatarType: AvatarType) {
  draftAvatarType.value = avatarType;
  draftMode.value = 'avatar';
}

function selectColor(color: string) {
  draftColor.value = color;
  draftMode.value = 'color';
}

function confirmSelection() {
  if (draftMode.value === 'avatar' && draftAvatarType.value) {
    emit('selectAvatar', draftAvatarType.value);
  } else {
    const color = normalizeOpaqueHexColor(draftColor.value);
    if (!color) {
      hexError.value = t('settings.customAvatarColorInvalid');
      return;
    }
    emit('selectColor', color);
  }
  emit('close');
}

watch(() => props.open, (open) => {
  if (open) {
    draftColor.value = props.avatarColor;
    draftAvatarType.value = props.avatarType;
    draftMode.value = props.avatarType ? 'avatar' : 'color';
    return;
  }

  if (!open) {
    showCustomColor.value = false;
    destroyPicker();
  }
});

onBeforeUnmount(destroyPicker);
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
            :aria-pressed="draftMode === 'color' && draftColor === color"
            @click="selectColor(color)"
          >
            <span :style="{ backgroundColor: color }" />
          </button>
          <button
            class="avatar-picker__custom-color"
            type="button"
            :aria-pressed="showCustomColor"
            @click="toggleCustomColor"
          >
            {{ t('settings.customAvatarColor') }}
          </button>
        </div>
        <Transition name="custom-color">
          <div v-if="showCustomColor" class="avatar-picker__custom-panel">
            <div ref="pickerElement" class="avatar-picker__wheel" />
            <label>
              <span>{{ t('settings.color') }}</span>
              <input v-model="draftColor" maxlength="7" @input="updateCustomColorDraft" />
            </label>
            <p v-if="hexError" class="meeting-error" role="alert">{{ hexError }}</p>
          </div>
        </Transition>
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
              :aria-pressed="draftMode === 'avatar' && draftAvatarType === avatar.id"
              @click="selectAvatar(avatar.id)"
            >
              <img v-if="avatar.asset" :src="avatar.asset" alt="" />
              <span v-else aria-hidden="true">?</span>
            </button>
          </div>
        </div>
      </section>
      <button class="meeting-primary avatar-picker__confirm" type="button" @click="confirmSelection">
        {{ t('settings.selectAvatar') }}
      </button>
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
.avatar-picker__custom-panel { display: grid; gap: var(--space-2); margin-top: var(--space-3); }
.avatar-picker__wheel { min-height: 280px; overflow: hidden; border-radius: var(--radius-md); background: var(--color-surface-low); }
.avatar-picker__custom-panel label { display: grid; gap: var(--space-1); font-weight: 700; }
.avatar-picker__custom-panel input { min-height: 44px; padding: 0 var(--space-3); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-sm); background: var(--color-surface-lowest); color: var(--color-on-surface); font: inherit; text-transform: uppercase; }
.avatar-picker .avatar-picker__confirm {
  position: sticky;
  bottom: 0;
  width: 100%;
  min-height: 48px;
  display: flex;
  justify-content: center;
  background: var(--color-primary);
  border-color: var(--color-primary);
  border-radius: var(--radius-md);
  color: var(--color-on-primary);
}
.custom-color-enter-active, .custom-color-leave-active { overflow: hidden; transition: max-height 220ms ease, opacity 180ms ease, transform 220ms ease; }
.custom-color-enter-from, .custom-color-leave-to { max-height: 0; opacity: 0; transform: translateY(-8px); }
.custom-color-enter-to, .custom-color-leave-from { max-height: 420px; opacity: 1; transform: translateY(0); }
@media (prefers-reduced-motion: reduce) { .custom-color-enter-active, .custom-color-leave-active { transition: none; } }
:deep(.IroWheel), :deep(.IroSlider) {
  margin: 0 auto;
}
</style>
