<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import { useSubscriptionStore } from '@/app/stores/subscription';
import FeatureList from '@/features/subscription/components/FeatureList.vue';
import PlanCard from '@/features/subscription/components/PlanCard.vue';
import { planComparisonItems } from '@/features/subscription/subscriptionPlans';
import type { SubscriptionPlanId } from '@/features/subscription/types';
import PremiumBadge from '@/shared/components/PremiumBadge.vue';

const router = useRouter();
const authStore = useAuthStore();
const subscriptionStore = useSubscriptionStore();
const selectedPlanId = ref<SubscriptionPlanId>('premium_monthly');

const currentPlanLabel = computed(() =>
  subscriptionStore.currentPlan === 'premium' ? 'Premium' : 'Free'
);
const selectedPlan = computed(() =>
  subscriptionStore.availablePlans.find(
    (plan) => plan.id === selectedPlanId.value
  )
);
const hasPremium = computed(() => subscriptionStore.hasPremiumEntitlement);

function selectPlan(planId: SubscriptionPlanId) {
  selectedPlanId.value = planId;
}

function purchaseSelectedPlan() {
  subscriptionStore.purchasePlan(selectedPlanId.value);
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
          v-for="plan in subscriptionStore.availablePlans"
          :key="plan.id"
          :plan="plan"
          :selected="selectedPlanId === plan.id"
          :disabled="subscriptionStore.isPurchasing"
          @select="selectPlan"
        />
      </div>

      <button
        class="meeting-primary"
        type="button"
        :disabled="
          subscriptionStore.isPurchasing || !selectedPlan || hasPremium
        "
        @click="purchaseSelectedPlan"
      >
        {{ hasPremium ? 'Premium active' : 'Start mock Premium' }}
      </button>
      <p class="subscription-note">
        This paywall uses a mock billing provider only. Real mobile billing must
        validate entitlements through a trusted provider or backend before
        unlocking Premium in production.
      </p>
      <button
        class="secondary-button"
        type="button"
        :disabled="subscriptionStore.isRestoring"
        @click="subscriptionStore.restorePurchases()"
      >
        Restore purchases
      </button>
      <p
        v-if="subscriptionStore.statusMessage"
        class="meeting-status"
        role="status"
      >
        {{ subscriptionStore.statusMessage }}
      </p>
      <p
        v-if="subscriptionStore.errorMessage"
        class="meeting-error"
        role="alert"
      >
        {{ subscriptionStore.errorMessage }}
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
          <dd>
            {{
              subscriptionStore.premiumEntitlement?.expiresAt ??
              'Not available until real billing is connected.'
            }}
          </dd>
        </div>
        <div>
          <dt>Manage subscription</dt>
          <dd>
            {{
              subscriptionStore.canManageSubscription
                ? 'Available through the store.'
                : 'Mobile billing management will be added later.'
            }}
          </dd>
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
      <button
        class="secondary-button"
        type="button"
        :disabled="subscriptionStore.isManaging"
        @click="subscriptionStore.manageSubscription()"
      >
        Manage subscription
      </button>
      <button class="secondary-button" type="button" @click="router.back()">
        Go back
      </button>
    </section>
  </section>
</template>
