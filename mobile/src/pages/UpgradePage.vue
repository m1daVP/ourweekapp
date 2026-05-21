<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import { useUserAccessStore } from '@/app/stores/userAccess';
import FeatureList from '@/features/subscription/components/FeatureList.vue';
import PlanCard from '@/features/subscription/components/PlanCard.vue';
import {
  planComparisonItems,
  premiumPlanOptions,
} from '@/features/subscription/subscriptionPlans';
import type { BillingCadence } from '@/features/subscription/types';
import PremiumBadge from '@/shared/components/PremiumBadge.vue';
import { appConfig } from '@/shared/config/env';

const router = useRouter();
const authStore = useAuthStore();
const accessStore = useUserAccessStore();
const selectedPlanId = ref<BillingCadence>('monthly');
const mockStatusMessage = ref('');

const currentPlanLabel = computed(() =>
  accessStore.planType === 'premium' ? 'Premium' : 'Free'
);
const canUseMockSwitch = computed(
  () => appConfig.appEnvironment !== 'production'
);

function selectPlan(planId: BillingCadence) {
  selectedPlanId.value = planId;
}

function setMockPlan() {
  if (!canUseMockSwitch.value) {
    return;
  }

  if (authStore.isAuthenticated) {
    authStore.setMockSubscriptionPlan('premium');
  } else {
    accessStore.setMockPlan('premium');
  }

  mockStatusMessage.value =
    'Premium is enabled in mock mode on this device only.';
}
</script>

<template>
  <section class="page-stack upgrade-page">
    <header>
      <p class="page-kicker">Premium</p>
      <h1>Upgrade Weekly Us</h1>
      <p class="page-copy">
        Premium is for households that want a longer memory, gentle follow-up,
        and clean summaries after each weekly check-in.
      </p>
    </header>

    <section class="content-panel upgrade-hero">
      <div>
        <PremiumBadge />
        <h2>Keep the weekly ritual easier to revisit</h2>
        <p>
          Unlock practical additions without changing Weekly Us into a task
          tracker or a budgeting app.
        </p>
      </div>
      <FeatureList :features="planComparisonItems[1].benefits" />
    </section>

    <section class="content-panel subscription-plans">
      <div>
        <h2>Plan placeholders</h2>
        <p>
          Prices and billing will be connected later through the proper mobile
          subscription flow.
        </p>
      </div>

      <div class="plan-card-grid" aria-label="Premium plan options">
        <PlanCard
          v-for="plan in premiumPlanOptions"
          :key="plan.id"
          :plan="plan"
          :selected="selectedPlanId === plan.id"
          @select="selectPlan"
        />
      </div>

      <button class="meeting-primary" type="button" disabled>
        Start Premium
      </button>
      <p class="subscription-note">
        Payments are not connected yet. Weekly Us does not collect payment
        details in this MVP.
      </p>
      <button
        v-if="canUseMockSwitch"
        class="secondary-button subscription-mock-button"
        type="button"
        @click="setMockPlan"
      >
        Enable mock Premium
      </button>
      <p v-if="mockStatusMessage" class="meeting-status" role="status">
        {{ mockStatusMessage }}
      </p>
    </section>

    <section class="content-panel plan-comparison">
      <div>
        <h2>Plan comparison</h2>
        <p>No pressure. Free keeps the core weekly meeting flow available.</p>
      </div>

      <article
        v-for="plan in planComparisonItems"
        :key="plan.planType"
        class="plan-comparison__group"
      >
        <div class="plan-comparison__header">
          <h3>{{ plan.label }}</h3>
          <PremiumBadge v-if="plan.planType === 'premium'" />
        </div>
        <FeatureList :features="plan.benefits" />
      </article>
    </section>

    <section class="content-panel subscription-status-panel">
      <div>
        <h2>Subscription status</h2>
        <p>Current plan: {{ currentPlanLabel }}</p>
      </div>
      <dl class="subscription-status-list">
        <div>
          <dt>Renewal</dt>
          <dd>Not available until payments are connected.</dd>
        </div>
        <div>
          <dt>Manage subscription</dt>
          <dd>Mobile billing management will be added later.</dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>
            {{
              authStore.isAuthenticated
                ? authStore.user?.email
                : 'Local device mode'
            }}
          </dd>
        </div>
      </dl>
      <button class="secondary-button" type="button" @click="router.back()">
        Go back
      </button>
    </section>
  </section>
</template>
