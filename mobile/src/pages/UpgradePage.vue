<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();
const selectedPlanId = ref<SubscriptionPlanId>('premium_monthly');

const currentPlanLabel = computed(() =>
  subscriptionStore.currentPlan === 'premium'
    ? t('premium.badge')
    : t('common.free')
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
      <p class="page-kicker">{{ t('upgrade.kicker') }}</p>
      <h1>{{ t('upgrade.title') }}</h1>
      <p class="page-copy">{{ t('upgrade.intro') }}</p>
    </header>

    <section class="content-panel upgrade-hero">
      <div>
        <PremiumBadge />
        <h2>{{ t('upgrade.heroTitle') }}</h2>
        <p>{{ t('upgrade.heroText') }}</p>
      </div>
      <FeatureList :features="planComparisonItems[1].benefits" />
    </section>

    <section class="content-panel subscription-plans">
      <div>
        <h2>{{ t('upgrade.placeholdersTitle') }}</h2>
        <p>{{ t('upgrade.placeholdersText') }}</p>
      </div>

      <div class="plan-card-grid" :aria-label="t('upgrade.planOptionsLabel')">
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
        {{
          hasPremium
            ? t('upgrade.premiumActive')
            : t('upgrade.startMockPremium')
        }}
      </button>
      <p class="subscription-note">
        {{ t('upgrade.billingNote') }}
      </p>
      <button
        class="secondary-button"
        type="button"
        :disabled="subscriptionStore.isRestoring"
        @click="subscriptionStore.restorePurchases()"
      >
        {{ t('common.restorePurchases') }}
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
        <h2>{{ t('upgrade.comparisonTitle') }}</h2>
        <p>{{ t('upgrade.comparisonText') }}</p>
      </div>

      <article
        v-for="plan in planComparisonItems"
        :key="plan.planType"
        class="plan-comparison__group"
      >
        <div class="plan-comparison__header">
          <h3>
            {{
              plan.planType === 'premium'
                ? t('premium.badge')
                : t('common.free')
            }}
          </h3>
          <PremiumBadge v-if="plan.planType === 'premium'" />
        </div>
        <FeatureList :features="plan.benefits" />
      </article>
    </section>

    <section class="content-panel subscription-status-panel">
      <div>
        <h2>{{ t('upgrade.statusTitle') }}</h2>
        <p>{{ t('upgrade.currentPlan', { plan: currentPlanLabel }) }}</p>
      </div>
      <dl class="subscription-status-list">
        <div>
          <dt>{{ t('upgrade.renewal') }}</dt>
          <dd>
            {{
              subscriptionStore.premiumEntitlement?.expiresAt ??
              t('upgrade.renewalUnavailable')
            }}
          </dd>
        </div>
        <div>
          <dt>{{ t('upgrade.manageSubscription') }}</dt>
          <dd>
            {{
              subscriptionStore.canManageSubscription
                ? t('upgrade.manageAvailable')
                : t('upgrade.manageUnavailable')
            }}
          </dd>
        </div>
        <div>
          <dt>{{ t('upgrade.account') }}</dt>
          <dd>
            {{
              authStore.isAuthenticated
                ? authStore.user?.email
                : t('upgrade.localDeviceMode')
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
        {{ t('common.manageSubscription') }}
      </button>
      <button class="secondary-button" type="button" @click="router.back()">
        {{ t('common.goBack') }}
      </button>
    </section>
  </section>
</template>
