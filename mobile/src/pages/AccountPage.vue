<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '@/app/stores/auth';
import { useUserAccessStore } from '@/app/stores/userAccess';
import type { PlanType } from '@/features/access/types';
import PremiumBadge from '@/shared/components/PremiumBadge.vue';
import { appConfig } from '@/shared/config/env';

const authStore = useAuthStore();
const accessStore = useUserAccessStore();
const displayName = ref(authStore.user?.displayName ?? '');
const statusMessage = ref('');
const formError = ref('');
const subscriptionMessage = ref('');

const user = computed(() => authStore.user);
const isMockAuth = computed(() => appConfig.apiMode === 'mock');
const canUseMockPlanSwitch = computed(
  () => appConfig.appEnvironment !== 'production'
);
const currentPlanLabel = computed(() =>
  accessStore.planType === 'premium' ? 'Premium' : 'Free'
);

function formatDate(value?: string) {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function saveProfile() {
  statusMessage.value = '';
  formError.value = '';

  if (!displayName.value.trim()) {
    formError.value = 'Add a display name.';
    return;
  }

  if (!authStore.updateProfile(displayName.value)) {
    formError.value = 'Could not update the account.';
    return;
  }

  statusMessage.value = 'Account updated on this device.';
}

function setMockPlan(plan: PlanType) {
  if (!canUseMockPlanSwitch.value) {
    return;
  }

  authStore.setMockSubscriptionPlan(plan);
  subscriptionMessage.value = `${plan === 'premium' ? 'Premium' : 'Free'} is active in mock mode on this device.`;
}
</script>

<template>
  <section v-if="user" class="page-stack account-page">
    <div>
      <p class="page-kicker">Account</p>
      <h1>Account settings</h1>
      <p class="page-copy">
        Manage the frontend account model used for sync, premium access, and
        future family workspace features.
      </p>
    </div>

    <section class="content-panel account-summary">
      <div>
        <span class="account-label">Signed in as</span>
        <strong>{{ user.email }}</strong>
      </div>
      <div>
        <span class="account-label">Plan</span>
        <strong>{{ currentPlanLabel }}</strong>
      </div>
      <div>
        <span class="account-label">Created</span>
        <strong>{{ formatDate(user.createdAt) }}</strong>
      </div>
    </section>

    <section class="content-panel settings-panel subscription-status-panel">
      <div>
        <PremiumBadge v-if="accessStore.isPremium" />
        <h2>Subscription</h2>
        <p>
          Current plan: {{ currentPlanLabel }}. Payments and subscription
          renewal are not connected yet.
        </p>
      </div>

      <dl class="subscription-status-list">
        <div>
          <dt>Renewal</dt>
          <dd>Not available until real mobile billing is added.</dd>
        </div>
        <div>
          <dt>Manage subscription</dt>
          <dd>Placeholder only. No payment provider is connected.</dd>
        </div>
      </dl>

      <RouterLink
        class="secondary-button link-button"
        :to="{ name: 'upgrade' }"
      >
        View Premium
      </RouterLink>

      <div v-if="canUseMockPlanSwitch" class="segmented-control">
        <button
          type="button"
          :class="[
            'segmented-control__button',
            { 'is-active': accessStore.planType === 'free' },
          ]"
          @click="setMockPlan('free')"
        >
          Free
        </button>
        <button
          type="button"
          :class="[
            'segmented-control__button',
            { 'is-active': accessStore.planType === 'premium' },
          ]"
          @click="setMockPlan('premium')"
        >
          Premium
        </button>
      </div>

      <p v-if="subscriptionMessage" class="meeting-status" role="status">
        {{ subscriptionMessage }}
      </p>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>Profile</h2>
        <p>Only display name editing is local in this MVP.</p>
      </div>
      <form class="auth-form" @submit.prevent="saveProfile">
        <label>
          <span>Display name</span>
          <input v-model="displayName" type="text" autocomplete="name" />
        </label>
        <p v-if="formError" class="meeting-error" role="alert">
          {{ formError }}
        </p>
        <p v-if="statusMessage" class="meeting-status" role="status">
          {{ statusMessage }}
        </p>
        <button class="meeting-primary" type="submit">Save account</button>
      </form>
    </section>

    <section class="content-panel settings-panel">
      <h2>Session</h2>
      <p v-if="isMockAuth">
        Mock auth is active. The access token is a placeholder and no real
        password is stored locally.
      </p>
      <p v-else>
        Signed-in requests should use the stored access token through the API
        layer.
      </p>
      <RouterLink class="secondary-button link-button" :to="{ name: 'logout' }">
        Log out
      </RouterLink>
    </section>
  </section>
</template>
