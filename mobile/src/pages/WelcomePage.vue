<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
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
    </div>
  </section>
</template>
