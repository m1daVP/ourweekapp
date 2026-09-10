<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { canPurchasePremium } from '@/features/access/premiumPurchasePolicy';
import type { SubscriptionPlanOption } from '@/features/subscription/types';
import { appConfig } from '@/shared/config/env';
import { useInAppNotification } from '@/shared/composables/useInAppNotification';

const subscriptionStore = useSubscriptionStore();
const workspaceStore = useWorkspaceStore();
const { t } = useI18n();
const { showInAppNotification } = useInAppNotification();

watch(
  () => subscriptionStore.statusMessage,
  (message) => {
    if (!message) {
      return;
    }

    showInAppNotification(message);
    subscriptionStore.clearStatusMessage();
  },
  { immediate: true }
);

const planOrder: SubscriptionPlanOption['id'][] = [
  'premium_monthly',
  'premium_yearly',
];
const benefitItems = [
  {
    icon: 'auto_awesome',
    titleKey: 'upgrade.benefits.aiSummaries.title',
    textKey: 'upgrade.benefits.aiSummaries.text',
  },
  {
    icon: 'dashboard_customize',
    titleKey: 'upgrade.benefits.templates.title',
    textKey: 'upgrade.benefits.templates.text',
  },
  {
    icon: 'calendar_month',
    titleKey: 'upgrade.benefits.calendarSync.title',
    textKey: 'upgrade.benefits.calendarSync.text',
  },
  {
    icon: 'ios_share',
    titleKey: 'upgrade.benefits.export.title',
    textKey: 'upgrade.benefits.export.text',
  },
  {
    icon: 'lock',
    titleKey: 'upgrade.benefits.privateNotes.title',
    textKey: 'upgrade.benefits.privateNotes.text',
  },
] as const;

const displayPlans = computed(() =>
  planOrder
    .map((planId) =>
      subscriptionStore.availablePlans.find((plan) => plan.id === planId)
    )
    .filter((plan): plan is SubscriptionPlanOption => Boolean(plan))
);
const selectedPlanId = ref<SubscriptionPlanOption['id'] | null>(null);
const selectedPlan = computed(() => {
  const explicitlySelectedPlan = displayPlans.value.find(
    (plan) => plan.id === selectedPlanId.value
  );

  return (
    explicitlySelectedPlan ??
    displayPlans.value.find((plan) => plan.id === 'premium_yearly') ??
    displayPlans.value[0] ??
    null
  );
});
const hasPremium = computed(() => subscriptionStore.hasPremiumEntitlement);
const isPurchaseUnavailable = computed(() => !appConfig.isRevenueCatEnabled);
const canRestorePurchases = computed(() => appConfig.isRevenueCatEnabled);
const isWorkspaceOwner = computed(() =>
  canPurchasePremium(workspaceStore.currentUserRole)
);
const purchaseButtonLabel = computed(() => {
  if (hasPremium.value) {
    return t('upgrade.premiumActive');
  }

  return isPurchaseUnavailable.value
    ? t('upgrade.billingUnavailableAction')
    : t('upgrade.startPremium');
});

function selectPlan(planId: SubscriptionPlanOption['id']) {
  selectedPlanId.value = planId;
}

async function purchaseSelectedPlan() {
  if (!selectedPlan.value) {
    return;
  }

  await subscriptionStore.purchasePlan(selectedPlan.value.id);
}

function isYearlyPlan(plan: SubscriptionPlanOption) {
  return plan.id === 'premium_yearly';
}

function getPlanMessageKey(plan: SubscriptionPlanOption) {
  return plan.id === 'premium_yearly'
    ? 'upgrade.plans.premiumYearly'
    : 'upgrade.plans.premiumMonthly';
}
</script>

<template>
  <section class="upgrade-page upgrade-page--redesign">
    <section class="upgrade-redesign-hero" aria-labelledby="upgrade-title">
      <div class="upgrade-redesign-hero__icon" aria-hidden="true">
        <span class="material-symbols-outlined filled">favorite</span>
      </div>
      <p class="upgrade-redesign-hero__kicker">{{ t('upgrade.kicker') }}</p>
      <h1 id="upgrade-title">{{ t('upgrade.heroTitle') }}</h1>
      <p>{{ t('upgrade.heroText') }}</p>
    </section>

    <section
      class="upgrade-benefits-card"
      aria-labelledby="upgrade-benefits-title"
    >
      <h2 id="upgrade-benefits-title">{{ t('upgrade.benefitsTitle') }}</h2>
      <ul class="upgrade-benefit-list">
        <li v-for="benefit in benefitItems" :key="benefit.titleKey">
          <span class="material-symbols-outlined" aria-hidden="true">
            {{ benefit.icon }}
          </span>
          <div>
            <strong>{{ t(benefit.titleKey) }}</strong>
            <p>{{ t(benefit.textKey) }}</p>
          </div>
        </li>
      </ul>
    </section>

    <section
      class="upgrade-plan-section"
      :aria-label="t('upgrade.planOptionsLabel')"
    >
      <button
        v-for="plan in displayPlans"
        :key="plan.id"
        :class="[
          'upgrade-plan-card',
          {
            'upgrade-plan-card--yearly': isYearlyPlan(plan),
            'upgrade-plan-card--selected': selectedPlan?.id === plan.id,
          },
        ]"
        type="button"
        :data-testid="`plan-${plan.id}`"
        :aria-pressed="selectedPlan?.id === plan.id"
        @click="selectPlan(plan.id)"
      >
        <span v-if="isYearlyPlan(plan)" class="upgrade-plan-card__badge">
          {{ t('upgrade.bestValue') }}
        </span>
        <div class="upgrade-plan-card__content">
          <div>
            <h3>{{ t(`${getPlanMessageKey(plan)}.name`) }}</h3>
            <p class="upgrade-plan-card__price">
              {{ plan.priceLabel }}
              <span class="upgrade-plan-card__period">
                {{ t(`upgrade.plans.${plan.cadence}BillingPeriod`) }}
              </span>
            </p>
            <p v-if="isYearlyPlan(plan)" class="upgrade-plan-card__note">
              {{ t('upgrade.yearlyNote') }}
            </p>
          </div>
          <span class="upgrade-plan-card__indicator" aria-hidden="true">
            <span
              class="material-symbols-outlined filled"
              :class="{
                'upgrade-plan-card__check--visible':
                  selectedPlan?.id === plan.id,
              }"
            >
              check
            </span>
          </span>
        </div>
      </button>
      <p v-if="!displayPlans.length" class="upgrade-plan-section__empty">
        {{ t('upgrade.planUnavailable') }}
      </p>
    </section>

    <div class="upgrade-purchase-dock" :aria-label="t('upgrade.actionsLabel')">
      <button
        v-if="isWorkspaceOwner"
        class="meeting-primary upgrade-purchase-dock__primary"
        type="button"
        data-testid="start-premium"
        :disabled="
          subscriptionStore.isPurchasing ||
          !subscriptionStore.availablePlans.length ||
          hasPremium ||
          isPurchaseUnavailable
        "
        @click="purchaseSelectedPlan"
      >
        {{ purchaseButtonLabel }}
      </button>
      <p class="upgrade-purchase-dock__note">
        {{ t('upgrade.billingNote') }}
      </p>
      <button
        v-if="isWorkspaceOwner"
        class="upgrade-purchase-dock__link"
        type="button"
        data-testid="restore-purchases"
        :disabled="subscriptionStore.isRestoring || !canRestorePurchases"
        @click="subscriptionStore.restorePurchases()"
      >
        {{ t('common.restorePurchases') }}
      </button>
      <p v-else class="upgrade-purchase-dock__note">
        {{ t('upgrade.ownerManaged') }}
      </p>
      <span class="upgrade-purchase-dock__separator" aria-hidden="true" />
      <RouterLink class="upgrade-purchase-dock__link" :to="{ name: 'terms' }">
        {{ t('upgrade.termsLink') }}
      </RouterLink>
      <template
        v-if="isWorkspaceOwner && subscriptionStore.canManageSubscription"
      >
        <span class="upgrade-purchase-dock__separator" aria-hidden="true" />
        <button
          class="upgrade-purchase-dock__link"
          type="button"
          data-testid="manage-subscription"
          :disabled="subscriptionStore.isManaging"
          @click="subscriptionStore.manageSubscription()"
        >
          {{ t('common.manageSubscription') }}
        </button>
      </template>
      <p
        v-if="subscriptionStore.errorMessage"
        class="meeting-error"
        role="alert"
      >
        {{ subscriptionStore.errorMessage }}
      </p>
    </div>
  </section>
</template>
