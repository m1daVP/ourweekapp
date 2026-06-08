<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/app/stores/auth';
import { useSubscriptionStore } from '@/app/stores/subscription';
import PremiumBadge from '@/shared/components/PremiumBadge.vue';

const authStore = useAuthStore();
const subscriptionStore = useSubscriptionStore();
const { t, locale } = useI18n();
const displayName = ref(authStore.user?.displayName ?? '');
const statusMessage = ref('');
const formError = ref('');

const user = computed(() => authStore.user);
const currentPlanLabel = computed(() =>
  subscriptionStore.currentPlan === 'premium'
    ? t('premium.badge')
    : t('common.free')
);

function formatDate(value?: string) {
  if (!value) {
    return t('common.notAvailable');
  }

  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function saveProfile() {
  statusMessage.value = '';
  formError.value = '';

  if (!displayName.value.trim()) {
    formError.value = t('account.addDisplayName');
    return;
  }

  if (!authStore.updateProfile(displayName.value)) {
    formError.value = t('account.updateFailed');
    return;
  }

  statusMessage.value = t('account.updated');
}
</script>

<template>
  <section v-if="user" class="page-stack account-page">
    <div>
      <p class="page-kicker">{{ t('account.kicker') }}</p>
      <h1>{{ t('account.title') }}</h1>
      <p class="page-copy">{{ t('account.intro') }}</p>
    </div>

    <section class="content-panel account-summary">
      <div>
        <span class="account-label">{{ t('account.signedInAs') }}</span>
        <strong>{{ user.email }}</strong>
      </div>
      <div>
        <span class="account-label">{{ t('account.plan') }}</span>
        <strong>{{ currentPlanLabel }}</strong>
      </div>
      <div>
        <span class="account-label">{{ t('account.created') }}</span>
        <strong>{{ formatDate(user.createdAt) }}</strong>
      </div>
    </section>

    <section class="content-panel settings-panel subscription-status-panel">
      <div>
        <PremiumBadge v-if="subscriptionStore.hasPremiumEntitlement" />
        <h2>{{ t('account.subscription') }}</h2>
        <p>{{ t('account.currentPlan', { plan: currentPlanLabel }) }}</p>
      </div>

      <dl class="subscription-status-list">
        <div>
          <dt>{{ t('account.renewal') }}</dt>
          <dd>
            {{
              subscriptionStore.premiumEntitlement?.expiresAt
                ? formatDate(subscriptionStore.premiumEntitlement.expiresAt)
                : t('account.renewalUnavailable')
            }}
          </dd>
        </div>
        <div>
          <dt>{{ t('account.manageSubscription') }}</dt>
          <dd>
            {{
              subscriptionStore.canManageSubscription
                ? t('account.manageAvailable')
                : t('account.manageUnavailable')
            }}
          </dd>
        </div>
      </dl>

      <RouterLink
        class="secondary-button link-button"
        :to="{ name: 'upgrade' }"
      >
        {{ t('account.viewPremium') }}
      </RouterLink>
      <button
        class="secondary-button"
        type="button"
        :disabled="subscriptionStore.isRestoring"
        @click="subscriptionStore.restorePurchases()"
      >
        {{ t('account.restorePurchases') }}
      </button>
      <p
        v-if="subscriptionStore.statusMessage"
        class="meeting-status"
        role="status"
      >
        {{ subscriptionStore.statusMessage }}
      </p>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>{{ t('account.profile') }}</h2>
        <p>{{ t('account.profileHelp') }}</p>
      </div>
      <form class="auth-form" @submit.prevent="saveProfile">
        <label>
          <span>{{ t('common.displayName') }}</span>
          <input v-model="displayName" type="text" autocomplete="name" />
        </label>
        <p v-if="formError" class="meeting-error" role="alert">
          {{ formError }}
        </p>
        <p v-if="statusMessage" class="meeting-status" role="status">
          {{ statusMessage }}
        </p>
        <button class="meeting-primary" type="submit">
          {{ t('account.saveAccount') }}
        </button>
      </form>
    </section>

    <section class="content-panel settings-panel">
      <h2>{{ t('account.session') }}</h2>
      <p>{{ t('account.apiSession') }}</p>
      <RouterLink class="secondary-button link-button" :to="{ name: 'logout' }">
        {{ t('account.logOut') }}
      </RouterLink>
    </section>
  </section>
</template>
