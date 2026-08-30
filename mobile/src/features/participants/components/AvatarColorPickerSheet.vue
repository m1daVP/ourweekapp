<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import iro from '@jaames/iro';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import { normalizeOpaqueHexColor } from '@/features/participants/utils/avatarColor';

const props = defineProps<{
  color: string;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [color: string];
}>();

const { t } = useI18n();
const pickerElement = ref<HTMLElement | null>(null);
const draftColor = ref(props.color);
const hexError = ref('');
const pickerLoadError = ref('');
let picker: ReturnType<typeof iro.ColorPicker> | null = null;

function resetDraftColor() {
  draftColor.value = normalizeOpaqueHexColor(props.color) ?? '#496a8f';
  hexError.value = '';
  pickerLoadError.value = '';
}

function destroyPicker() {
  picker = null;
  pickerElement.value?.replaceChildren();
}

async function createPicker() {
  await nextTick();

  if (!props.open || !pickerElement.value) {
    return;
  }

  destroyPicker();

  try {
    picker = iro.ColorPicker(pickerElement.value, {
      borderWidth: 0,
      color: draftColor.value,
      handleRadius: 10,
      layout: [
        {
          component: iro.ui.Wheel,
        },
        {
          component: iro.ui.Slider,
          options: {
            sliderSize: 24,
            sliderType: 'value',
          },
        },
      ],
      margin: 18,
      padding: 8,
      width: 280,
    });

    picker.on('color:change', (color: { hexString: string }) => {
      draftColor.value = color.hexString.toLocaleLowerCase();
      hexError.value = '';
    });
  } catch {
    pickerLoadError.value = t('settings.customAvatarColorUnavailable');
  }
}

function syncPickerColor(value: string) {
  const normalizedColor = normalizeOpaqueHexColor(value);

  if (!normalizedColor || !picker) {
    return;
  }

  if (picker.color.hexString.toLocaleLowerCase() !== normalizedColor) {
    picker.color.hexString = normalizedColor;
  }
}

function handleHexInput() {
  hexError.value = '';
  syncPickerColor(draftColor.value);
}

function closeSheet() {
  emit('close');
}

function confirmSelection() {
  const normalizedColor = normalizeOpaqueHexColor(draftColor.value);

  if (!normalizedColor) {
    hexError.value = t('settings.customAvatarColorInvalid');
    return;
  }

  emit('select', normalizedColor);
  emit('close');
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      destroyPicker();
      return;
    }

    resetDraftColor();
    void createPicker();
  },
  { immediate: true }
);

onBeforeUnmount(destroyPicker);
</script>

<template>
  <BaseBottomSheet
    :open="open"
    :title="t('settings.customAvatarColorTitle')"
    @close="closeSheet"
  >
    <section class="avatar-color-picker">
      <div
        class="avatar-color-picker__preview"
        :style="{ backgroundColor: draftColor }"
      >
        <span aria-hidden="true">Aa</span>
      </div>

      <div
        v-if="!pickerLoadError"
        ref="pickerElement"
        class="avatar-color-picker__control"
        :aria-label="t('settings.customAvatarColorTitle')"
      />

      <p v-else class="meeting-error" role="alert">
        {{ pickerLoadError }}
      </p>

      <label class="avatar-color-picker__hex">
        <span>{{ t('settings.color') }}</span>
        <input
          v-model="draftColor"
          autocomplete="off"
          inputmode="text"
          maxlength="7"
          pattern="#[0-9A-Fa-f]{6}"
          spellcheck="false"
          type="text"
          :aria-describedby="hexError ? 'avatar-color-picker-error' : undefined"
          :aria-invalid="Boolean(hexError)"
          @input="handleHexInput"
        />
      </label>

      <p
        v-if="hexError"
        id="avatar-color-picker-error"
        class="meeting-error"
        role="alert"
      >
        {{ hexError }}
      </p>

      <div class="avatar-color-picker__actions">
        <button
          class="meeting-primary"
          data-test="avatar-color-select"
          type="button"
          @click="confirmSelection"
        >
          {{ t('settings.customAvatarColorSelect') }}
        </button>
        <button
          class="secondary-button"
          data-test="avatar-color-cancel"
          type="button"
          @click="closeSheet"
        >
          {{ t('common.cancel') }}
        </button>
      </div>
    </section>
  </BaseBottomSheet>
</template>

<style scoped>
.avatar-color-picker {
  display: grid;
  gap: var(--space-4);
  padding: 0 var(--space-4) var(--space-4);
}

.avatar-color-picker__preview {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border: 3px solid var(--color-surface-lowest);
  border-radius: var(--radius-pill);
  box-shadow: 0 2px 8px rgb(26 28 26 / 18%);
  color: var(--color-on-primary);
  font-weight: 800;
}

.avatar-color-picker__control {
  display: grid;
  justify-content: center;
  min-height: 318px;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-surface-low);
}

.avatar-color-picker__hex {
  display: grid;
  gap: var(--space-2);
  color: var(--color-on-surface);
  font-weight: 700;
}

.avatar-color-picker__hex input {
  min-height: var(--touch-target-min);
  padding: 0 var(--space-3);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  background: var(--color-surface-lowest);
  color: var(--color-on-surface);
  font: inherit;
  text-transform: uppercase;
}

.avatar-color-picker__actions {
  display: grid;
  gap: var(--space-2);
}

.avatar-color-picker__actions button {
  min-height: var(--touch-target-min);
}
</style>
