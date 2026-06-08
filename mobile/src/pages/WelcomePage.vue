<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import { appConfig } from '@/shared/config/env';

const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();

const isMockAuth = computed(() => appConfig.apiMode === 'mock');
const canContinueLocalOnly = computed(() => !appConfig.isBackendApiEnabled);

async function continueLocalOnly() {
  const didContinue = await authStore.continueLocalOnly();

  if (didContinue) {
    void router.push({ name: 'home' });
  }
}
</script>

<template>
  <section class="auth-page welcome-page">
    <div class="auth-hero">
      <p class="page-kicker">{{ t('app.name') }}</p>
      <h1>{{ t('app.name') }}</h1>
      <h2>{{ t('welcome.tagline') }}</h2>
      <p class="page-copy">{{ t('welcome.intro') }}</p>
    </div>

    <div class="auth-benefit-list" :aria-label="t('welcome.benefitsLabel')">
      <div>
        <strong>{{ t('welcome.syncLater') }}</strong>
        <p>{{ t('welcome.syncLaterText') }}</p>
      </div>
      <div>
        <strong>{{ t('welcome.keepHistory') }}</strong>
        <p>{{ t('welcome.keepHistoryText') }}</p>
      </div>
      <div>
        <strong>{{ t('welcome.premiumReady') }}</strong>
        <p>{{ t('welcome.premiumReadyText') }}</p>
      </div>
    </div>

    <p v-if="isMockAuth" class="auth-note">
      {{ t('welcome.mockAuth') }}
    </p>

    <div class="auth-actions">
      <RouterLink class="meeting-primary link-button" :to="{ name: 'sign-up' }">
        {{ t('welcome.getStarted') }}
      </RouterLink>
      <RouterLink
        class="secondary-button link-button"
        :to="{ name: 'sign-in' }"
      >
        {{ t('auth.signIn') }}
      </RouterLink>
      <button
        v-if="canContinueLocalOnly"
        type="button"
        class="text-button"
        @click="continueLocalOnly"
      >
        {{ t('welcome.continueLocal') }}
      </button>
    </div>
  </section>
</template>
