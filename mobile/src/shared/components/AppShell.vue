<script setup lang="ts">
import { computed, nextTick, ref, watch, type CSSProperties } from 'vue';
import { useI18n } from 'vue-i18n';
import ParticipantAvatar from '@/features/participants/components/ParticipantAvatar.vue';
import type { Participant } from '@/features/participants/types';
import { useRoute } from 'vue-router';
import BottomNavigation from '@/shared/components/BottomNavigation.vue';
import smallLogoUrl from '@/assets/small-logo.svg';
import { useAuthStore } from '@/app/stores/auth';
import { useParticipantsStore } from '@/app/stores/participants';
import { useSubscriptionStore } from '@/app/stores/subscription';
import {
  clearStorageRecoveryMessages,
  readStorageSlice,
  storageRecoveryState,
} from '@/shared/services/storageService';
import { useToast } from '@/shared/composables/useToast';
import { useInAppNotification } from '@/shared/composables/useInAppNotification';
import { usePullToRefresh } from '@/shared/composables/usePullToRefresh';
import {
  PageRefreshError,
  isPullToRefreshRoute,
  refreshPageData,
} from '@/shared/services/pageRefreshService';

withDefaults(
  defineProps<{
    showNavigation?: boolean;
  }>(),
  {
    showNavigation: true,
  }
);

const route = useRoute();
const { t } = useI18n();
const mainElement = ref<HTMLElement | null>(null);
const authStore = useAuthStore();
const participantsStore = useParticipantsStore();
const subscriptionStore = useSubscriptionStore();
const { dismissToast, showToast, toastState } = useToast();
const { dismissInAppNotification, notificationState } = useInAppNotification();
const IN_APP_NOTIFICATION_DRAG_DISMISS_THRESHOLD = 20;
const inAppNotificationPointerStart = ref<{
  pointerId: number;
  x: number;
  y: number;
} | null>(null);
const inAppNotificationDragOffset = ref(0);
const isInAppNotificationDragging = ref(false);
const recoveryMessages = computed(() => storageRecoveryState.value.messages);
const activeParticipants = computed(() => participantsStore.activeParticipants);
type ParticipantLookup = Partial<Participant> & { email?: string };
const currentUserParticipant = computed(() => {
  const email = authStore.user?.email.trim().toLocaleLowerCase();

  if (!email) {
    return null;
  }

  const persistedParticipants =
    readStorageSlice<{ participants?: ParticipantLookup[] }>('participants', {
      participants: [],
    }).participants ?? [];

  const participant = [
    ...activeParticipants.value,
    ...persistedParticipants,
  ].find((candidate): candidate is Participant => {
    const candidateEmail = candidate.email?.trim().toLocaleLowerCase();

    return (
      candidateEmail === email &&
      !!candidate.name &&
      !!candidate.initials &&
      !!candidate.avatarColor
    );
  });

  return participant ?? null;
});
const isMeetingRoute = computed(() => route.name === 'meeting');
const pullToRefreshEnabled = computed(() => isPullToRefreshRoute(route.name));
const pageTitle = computed(() => {
  const routeName = String(route.name ?? '');

  const titles: Record<string, string> = {
    home: t('app.routeTitles.home'),
    meeting: t('app.routeTitles.meeting'),
    'meeting-templates': t('app.routeTitles.meetingTemplates'),
    tasks: t('app.routeTitles.tasks'),
    history: t('app.routeTitles.history'),
    settings: t('app.routeTitles.settings'),
    upgrade: t('app.routeTitles.upgrade'),
    'private-notes': t('app.routeTitles.privateNotes'),
    'calendar-sync': t('app.routeTitles.calendarSync'),
    'meeting-details': t('app.routeTitles.meetingDetails'),
    'meeting-summary': t('app.routeTitles.meetingSummary'),
  };

  return titles[routeName] ?? t('app.name');
});

async function handlePageRefresh() {
  if (!isPullToRefreshRoute(route.name)) {
    return;
  }

  try {
    await refreshPageData(route.name);
    await showToast(t('app.refresh.updated'));
  } catch (error) {
    const message =
      error instanceof PageRefreshError && error.reason === 'offline'
        ? t('sync.offline')
        : t('sync.failed');

    await showToast(message, { tone: 'error', durationMs: 3600 });
  }
}

const { phase: pullPhase, pullDistance } = usePullToRefresh({
  container: mainElement,
  enabled: pullToRefreshEnabled,
  onRefresh: handlePageRefresh,
});

const pullStatusText = computed(() => {
  if (pullPhase.value === 'ready') {
    return t('app.refresh.release');
  }

  if (pullPhase.value === 'refreshing') {
    return t('app.refresh.updating');
  }

  return t('app.refresh.pull');
});

const pullIndicatorStyle = computed(
  () => ({ '--pull-distance': `${pullDistance.value}px` }) as CSSProperties
);
const inAppNotificationDragStyle = computed(
  () =>
    ({
      '--in-app-notification-drag-offset': `${inAppNotificationDragOffset.value}px`,
    }) as CSSProperties
);

function handleToastAction(action: () => void) {
  action();
  dismissToast();
}

function handleInAppNotificationPointerDown(event: PointerEvent) {
  const notification = event.currentTarget;

  inAppNotificationPointerStart.value = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  };
  inAppNotificationDragOffset.value = 0;
  isInAppNotificationDragging.value = true;

  if (
    notification instanceof HTMLElement &&
    typeof notification.setPointerCapture === 'function'
  ) {
    notification.setPointerCapture(event.pointerId);
  }
}

function resetInAppNotificationDrag() {
  inAppNotificationPointerStart.value = null;
  inAppNotificationDragOffset.value = 0;
  isInAppNotificationDragging.value = false;
}

function isActiveInAppNotificationPointer(event: PointerEvent) {
  return inAppNotificationPointerStart.value?.pointerId === event.pointerId;
}

function handleInAppNotificationPointerMove(event: PointerEvent) {
  if (!isActiveInAppNotificationPointer(event)) {
    return;
  }

  const start = inAppNotificationPointerStart.value;
  if (!start) {
    return;
  }

  const verticalOffset = event.clientY - start.y;
  const horizontalDistance = Math.abs(event.clientX - start.x);
  const canDragUpward =
    verticalOffset < 0 && Math.abs(verticalOffset) > horizontalDistance;

  inAppNotificationDragOffset.value = canDragUpward ? verticalOffset : 0;

  if (
    -inAppNotificationDragOffset.value >=
    IN_APP_NOTIFICATION_DRAG_DISMISS_THRESHOLD
  ) {
    resetInAppNotificationDrag();
    dismissInAppNotification();
  }
}

function handleInAppNotificationPointerUp(event: PointerEvent) {
  if (!isActiveInAppNotificationPointer(event)) {
    return;
  }

  resetInAppNotificationDrag();
}

function handleInAppNotificationPointerCancel(event: PointerEvent) {
  if (isActiveInAppNotificationPointer(event)) {
    resetInAppNotificationDrag();
  }
}

watch(
  () => route.fullPath,
  async () => {
    await nextTick();
    mainElement.value?.scrollTo({ top: 0, left: 0 });
  }
);
</script>

<template>
  <div
    :class="[
      'app-shell',
      {
        'app-shell--with-navigation': showNavigation,
        'app-shell--meeting': isMeetingRoute,
      },
    ]"
  >
    <header v-if="showNavigation" class="app-top-bar">
      <span class="app-top-bar__icon">
        <img :src="smallLogoUrl" alt="" aria-hidden="true" />
      </span>
      <h1>{{ pageTitle }}</h1>
      <RouterLink
        :class="[
          'app-top-bar__avatar',
          {
            'app-top-bar__avatar--premium':
              subscriptionStore.hasPremiumEntitlement,
          },
        ]"
        :to="{ name: 'settings' }"
        :aria-label="t('app.openSettings')"
      >
        <ParticipantAvatar
          v-if="currentUserParticipant"
          :participant="currentUserParticipant"
          decorative
        />
        <span v-else>WU</span>
      </RouterLink>
    </header>
    <main ref="mainElement" class="app-main">
      <div
        v-if="pullToRefreshEnabled"
        :class="['pull-to-refresh', `pull-to-refresh--${pullPhase}`]"
        :style="pullIndicatorStyle"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        @pointerdown="handleInAppNotificationPointerDown"
        @pointerup="handleInAppNotificationPointerUp"
      >
        <div class="pull-to-refresh__content">
          <span
            :class="[
              'material-symbols-outlined',
              { 'pull-to-refresh__spinner': pullPhase === 'refreshing' },
            ]"
            aria-hidden="true"
          >
            refresh
          </span>
          <span v-if="pullPhase !== 'idle'">{{ pullStatusText }}</span>
        </div>
      </div>
      <aside
        v-if="recoveryMessages.length"
        class="storage-recovery-notice"
        aria-live="polite"
      >
        <div>
          <strong>{{ t('app.storageAttention') }}</strong>
          <p>
            {{ recoveryMessages[0] }}
          </p>
        </div>
        <button type="button" @click="clearStorageRecoveryMessages">
          {{ t('app.dismiss') }}
        </button>
      </aside>
      <slot />
    </main>
    <Transition name="app-toast">
      <div
        v-if="toastState"
        :key="toastState.id"
        :class="['app-toast', `app-toast--${toastState.tone}`]"
        role="status"
        aria-live="polite"
      >
        <span class="app-toast__content">
          <span
            v-if="toastState.loading"
            class="app-toast__spinner"
            aria-hidden="true"
          />
          <span>{{ toastState.message }}</span>
        </span>
        <button
          v-if="toastState.action"
          type="button"
          class="app-toast__action material-symbols-outlined"
          :aria-label="toastState.action.label"
          @click="handleToastAction(toastState.action.onClick)"
        >
          undo
        </button>
        <button
          v-else-if="!toastState.persistent"
          type="button"
          class="app-toast__dismiss material-symbols-outlined"
          :aria-label="t('app.dismiss')"
          @click="dismissToast"
        >
          close
        </button>
      </div>
    </Transition>
    <Transition name="in-app-notification">
      <aside
        v-if="notificationState"
        :key="notificationState.id"
        :class="[
          'in-app-notification',
          `in-app-notification--${notificationState.tone}`,
          {
            'in-app-notification--dragging': isInAppNotificationDragging,
          },
        ]"
        :style="inAppNotificationDragStyle"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        @pointerdown="handleInAppNotificationPointerDown"
        @pointermove="handleInAppNotificationPointerMove"
        @pointerup="handleInAppNotificationPointerUp"
        @pointercancel="handleInAppNotificationPointerCancel"
        @lostpointercapture="handleInAppNotificationPointerCancel"
      >
        <span class="material-symbols-outlined" aria-hidden="true">
          {{ notificationState.tone === 'error' ? 'error' : 'check_circle' }}
        </span>
        <span class="in-app-notification__message">
          {{ notificationState.message }}
        </span>
      </aside>
    </Transition>
    <BottomNavigation v-if="showNavigation" />
  </div>
</template>
