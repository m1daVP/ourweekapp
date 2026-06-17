<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { Participant } from '@/features/participants/types';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import { createAvatarStyle } from '@/features/meeting/composables/useMeetingSession';

const props = defineProps<{
  canAddGuestParticipant: boolean;
  canEditMeeting: boolean;
  canSubmitGuestDrawer: boolean;
  checkedInParticipantIds: string[];
  currentStepNumber: number;
  drawerFamilyMembers: Participant[];
  drawerSelectedParticipantId: string;
  formError: string;
  guestName: string;
  isGuestDrawerOpen: boolean;
  participants: Participant[];
  progressPercent: string;
  statusMessage: string;
  totalSteps: number;
}>();

const emit = defineEmits<{
  'add-selected-drawer-participant': [];
  'clear-drawer-participant-selection': [];
  'close-guest-drawer': [];
  exit: [];
  'open-guest-drawer': [];
  'open-menu': [];
  'select-drawer-participant': [participantId: string];
  start: [];
  'toggle-participant': [participantId: string];
  'update:guestName': [value: string];
}>();

const { t } = useI18n();

function participantIsCheckedIn(participantId: string) {
  return props.checkedInParticipantIds.includes(participantId);
}

function updateGuestName(event: Event) {
  emit('update:guestName', (event.target as HTMLInputElement).value);
  emit('clear-drawer-participant-selection');
}
</script>

<template>
  <header class="ritual-check-in__top-bar">
    <button
      class="ritual-check-in__icon material-symbols-outlined"
      type="button"
      :aria-label="t('meeting.closeMeeting')"
      @click="emit('exit')"
    >
      close
    </button>
    <h1>{{ t('meeting.ritualTitle') }}</h1>
    <button
      class="ritual-check-in__icon material-symbols-outlined"
      type="button"
      :aria-label="t('meeting.menu.open')"
      @click="emit('open-menu')"
    >
      more_vert
    </button>
  </header>

  <main class="ritual-check-in__content">
    <div
      class="ritual-progress"
      :aria-label="
        t('meeting.stepOf', {
          current: currentStepNumber,
          total: totalSteps,
        })
      "
    >
      <span>
        {{
          t('meeting.stepOf', {
            current: currentStepNumber,
            total: totalSteps,
          })
        }}
      </span>
      <div class="ritual-progress__track">
        <div class="ritual-progress__bar" :style="{ width: progressPercent }" />
      </div>
    </div>

    <header class="ritual-check-in__hero">
      <h2>{{ t('meeting.checkInTitle') }}</h2>
      <p>{{ t('meeting.checkInIntro') }}</p>
    </header>

    <div class="ritual-member-grid">
      <button
        v-for="participant in participants"
        :key="participant.id"
        type="button"
        :class="[
          'ritual-member-card',
          { 'is-selected': participantIsCheckedIn(participant.id) },
        ]"
        :aria-pressed="participantIsCheckedIn(participant.id)"
        @click="emit('toggle-participant', participant.id)"
      >
        <span
          v-if="participantIsCheckedIn(participant.id)"
          class="ritual-member-card__check material-symbols-outlined"
          aria-hidden="true"
        >
          check_circle
        </span>
        <span
          class="ritual-member-card__avatar"
          :style="createAvatarStyle(participant)"
        >
          {{ participant.initials }}
        </span>
        <span class="ritual-member-card__name">
          {{ participant.name }}
        </span>
      </button>

      <button
        type="button"
        class="ritual-member-card ritual-member-card--add"
        :disabled="!canAddGuestParticipant || !canEditMeeting"
        @click="emit('open-guest-drawer')"
      >
        <span
          class="ritual-member-card__add-icon material-symbols-outlined"
          aria-hidden="true"
        >
          add
        </span>
        <span class="ritual-member-card__name">
          {{ t('meeting.addGuest') }}
        </span>
      </button>
    </div>

    <BaseBottomSheet
      :open="isGuestDrawerOpen"
      :title="t('meeting.addToSession')"
      @close="emit('close-guest-drawer')"
    >
      <div class="ritual-guest-drawer">
        <section
          class="ritual-guest-drawer__section"
          aria-labelledby="existing-family-title"
        >
          <h3 id="existing-family-title" class="sr-only">
            {{ t('meeting.chooseFromFamily') }}
          </h3>
          <div v-if="drawerFamilyMembers.length" class="ritual-guest-list">
            <button
              v-for="participant in drawerFamilyMembers"
              :key="participant.id"
              type="button"
              :class="[
                'ritual-guest-list__item',
                {
                  'is-selected': participantIsCheckedIn(participant.id),
                  'is-pending': drawerSelectedParticipantId === participant.id,
                },
              ]"
              :disabled="participantIsCheckedIn(participant.id)"
              @click="emit('select-drawer-participant', participant.id)"
            >
              <span
                class="ritual-guest-list__avatar"
                :style="createAvatarStyle(participant)"
              >
                {{ participant.initials }}
              </span>
              <span>{{ participant.name }}</span>
            </button>
          </div>
          <p v-else class="ritual-guest-drawer__empty">
            {{ t('meeting.everyoneAlreadyHere') }}
          </p>
        </section>

        <section
          class="ritual-guest-drawer__section"
          aria-labelledby="guest-name-title"
        >
          <h3 id="guest-name-title">{{ t('meeting.newGuest') }}</h3>
          <form
            class="ritual-guest-form"
            @submit.prevent="emit('add-selected-drawer-participant')"
          >
            <label class="sr-only" for="guest-name">
              {{ t('meeting.guestName') }}
            </label>
            <input
              id="guest-name"
              :value="guestName"
              type="text"
              autocomplete="off"
              :placeholder="t('meeting.guestNamePlaceholder')"
              @input="updateGuestName"
            />
            <button
              class="meeting-primary"
              type="submit"
              :disabled="!canSubmitGuestDrawer"
            >
              {{ t('meeting.addToRitual') }}
            </button>
          </form>
        </section>
      </div>
    </BaseBottomSheet>

    <p v-if="formError" class="meeting-error" role="alert">
      {{ formError }}
    </p>
    <p v-if="statusMessage" class="meeting-status" role="status">
      {{ statusMessage }}
    </p>
  </main>

  <footer class="ritual-check-in__actions">
    <button
      type="button"
      class="ritual-action ritual-action--back"
      @click="emit('exit')"
    >
      {{ t('common.back') }}
    </button>
    <button
      type="button"
      class="ritual-action ritual-action--start"
      :disabled="!checkedInParticipantIds.length || !canEditMeeting"
      @click="emit('start')"
    >
      {{ t('meeting.startRitual') }}
    </button>
  </footer>
</template>

<style scoped>
/* :global(.app-shell:has(.meeting-page--check-in)) {
  background: #faf9f5;
}

:global(.app-shell:has(.meeting-page--check-in) .app-main) {
  padding: 0;
  background: #faf9f5;
}

:global(.meeting-page--check-in) {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 0;
  background: #faf9f5;
  color: #1a1c1a;
} */

.ritual-check-in__top-bar {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  min-height: calc(64px + env(safe-area-inset-top));
  align-items: center;
  gap: 12px;
  /* padding: env(safe-area-inset-top) var(--edge-margin) 0; */
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
}

.ritual-check-in__top-bar h1 {
  margin: 0;
  overflow: hidden;
  color: var(--color-primary);
  font-family: var(--font-display);
  font-size: var(--font-size-display);
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ritual-check-in__icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-primary);
  font-size: 1.5rem;
}

.ritual-check-in__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 32px;
  /* padding: 28px var(--edge-margin) 0; */
}

.ritual-progress {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 28px;
  align-items: center;
}

.ritual-progress span {
  color: var(--color-outline);
  font-size: var(--font-size-label-sm);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ritual-progress__track {
  height: 10px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-outline-variant) 42%, white);
}

.ritual-progress__bar {
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
}

.ritual-check-in__hero {
  display: grid;
  gap: 10px;
}

.ritual-check-in__hero h2 {
  margin: 0;
  color: #0f1110;
  font-family: var(--font-display);
  font-size: var(--font-size-display);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.04;
}

.ritual-check-in__hero p {
  max-width: 14.5em;
  color: #30362f;
  font-size: var(--font-size-headline-lg);
  line-height: 1.55;
}

.ritual-member-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px 28px;
}

.ritual-member-card {
  position: relative;
  display: grid;
  aspect-ratio: 1;
  min-height: 0;
  place-items: center;
  align-content: center;
  gap: 18px;
  border: 1.5px solid transparent;
  border-radius: 0;
  background: var(--color-surface-container);
  padding: 20px 14px;
  color: #30362f;
  text-align: center;
  box-shadow: none;
}

.ritual-member-card.is-selected {
  border-color: var(--color-primary);
  background: var(--color-surface-lowest);
  box-shadow: 0 12px 32px rgba(47, 42, 38, 0.05);
}

.ritual-member-card__check {
  position: absolute;
  top: 28px;
  right: 24px;
  color: var(--color-primary);
  font-size: 1.8rem;
  font-variation-settings:
    'FILL' 0,
    'wght' 600,
    'GRAD' 0,
    'opsz' 24;
}

.ritual-member-card__avatar {
  display: grid;
  width: 74px;
  height: 74px;
  place-items: center;
  border: 4px solid color-mix(in srgb, var(--color-surface-lowest) 72%, #000);
  border-radius: var(--radius-pill);
  font-family: var(--font-display);
  font-size: var(--font-size-display);
  font-weight: 700;
  line-height: 1;
  box-shadow: inset 0 0 0 1px rgba(47, 42, 38, 0.08);
}

.ritual-member-card.is-selected .ritual-member-card__avatar {
  border-color: var(--color-primary);
}

.ritual-member-card:not(.is-selected) .ritual-member-card__avatar {
  filter: grayscale(1);
  opacity: 0.76;
}

.ritual-member-card__name {
  overflow-wrap: anywhere;
  color: #202520;
  font-size: var(--font-size-body-lg);
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.ritual-member-card:not(.is-selected) .ritual-member-card__name {
  color: #3f463f;
}

.ritual-member-card--add {
  border-color: var(--color-outline-variant);
  border-style: dashed;
  background: color-mix(in srgb, var(--color-surface-low) 42%, transparent);
}

.ritual-member-card--add .ritual-member-card__name {
  font-size: var(--font-size-body-md);
  font-weight: 600;
}

.ritual-member-card--add:disabled {
  opacity: 0.48;
}

.ritual-member-card__add-icon {
  display: grid;
  width: 66px;
  height: 66px;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--color-surface-highest);
  color: #30362f;
  font-size: 2rem;
}

.ritual-guest-drawer {
  display: grid;
  gap: 24px;
}

.ritual-guest-drawer__section {
  display: grid;
  gap: 12px;
}

.ritual-guest-drawer__section h3 {
  margin: 0;
  color: #101210;
  font-family: var(--font-display);
  font-size: var(--font-size-headline-md);
  line-height: 1.24;
}

.ritual-guest-list {
  display: flex;
  gap: 18px;
  overflow-x: auto;
  padding: 0 2px 4px;
  scrollbar-width: none;
}

.ritual-guest-list::-webkit-scrollbar {
  display: none;
}

.ritual-guest-list__item {
  display: grid;
  min-width: 52px;
  justify-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-on-surface);
  font-size: var(--font-size-label-sm);
  line-height: 1.2;
  text-align: center;
  box-shadow: none;
}

.ritual-guest-list__item.is-selected {
  opacity: 0.75;
}

.ritual-guest-list__item.is-pending .ritual-guest-list__avatar {
  outline: 3px solid var(--color-primary-fixed);
  outline-offset: 2px;
}

.ritual-guest-list__avatar {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 2px solid color-mix(in srgb, var(--color-surface-lowest) 78%, white);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-label-lg);
  font-weight: 900;
  box-shadow: 0 4px 14px rgba(47, 42, 38, 0.1);
}

.ritual-guest-form {
  display: grid;
  gap: 22px;
}

.ritual-guest-form input {
  min-height: 56px;
  border: 0;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-surface-low) 58%, white);
  padding: 0 18px;
  box-shadow: none;
}

.ritual-guest-form button {
  width: 100%;
  min-height: 56px;
  box-shadow: 0 10px 22px rgba(47, 74, 52, 0.2);
}

.ritual-guest-drawer__empty {
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-lg);
}

.ritual-check-in__actions {
  display: flex;
  gap: 28px;
  margin-top: auto;
  /* padding: 34px var(--edge-margin) calc(16px + env(safe-area-inset-bottom)); */
  background: #faf9f5;
}

.ritual-action {
  min-height: 64px;
  border-radius: var(--radius-pill);
  padding: 0 22px;
  font-size: var(--font-size-body-lg);
  font-weight: 800;
  letter-spacing: 0.01em;
}

.ritual-action--back {
  flex: 1;
  border: 1px solid var(--color-outline-variant);
  background: color-mix(in srgb, var(--color-surface-lowest) 68%, #faf9f5);
  color: #30362f;
  box-shadow: none;
}

.ritual-action--start {
  flex: 2;
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: 0 10px 22px rgba(47, 42, 38, 0.16);
}

.ritual-action--start:disabled {
  opacity: 0.52;
}
</style>
