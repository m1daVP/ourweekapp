<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import welcomeHeroUrl from '@/assets/welcome-hero.webp';

const { t } = useI18n();
const router = useRouter();

const featureKeys = [
  'welcome.talkThroughWeek',
  'welcome.shareResponsibilities',
  'welcome.clearAgreements',
] as const;

function goToSignIn() {
  void router.push({ name: 'sign-in' });
}
</script>

<template>
  <section class="welcome-page--redesign" aria-labelledby="welcome-title">
    <div class="welcome-page__hero" aria-hidden="true">
      <img :src="welcomeHeroUrl" alt="" />
    </div>

    <div class="welcome-page__sheet">
      <header class="welcome-page__header">
        <h1 id="welcome-title">{{ t('welcome.title') }}</h1>
        <h2>{{ t('welcome.tagline') }}</h2>
        <p>{{ t('welcome.intro') }}</p>
      </header>

      <ul
        class="welcome-page__features"
        :aria-label="t('welcome.benefitsLabel')"
      >
        <li v-for="featureKey in featureKeys" :key="featureKey">
          <span
            class="welcome-page__check material-symbols-outlined"
            aria-hidden="true"
          >
            check
          </span>
          <span>{{ t(featureKey) }}</span>
        </li>
      </ul>

      <div class="welcome-page__actions">
        <button
          class="welcome-page__primary-action"
          type="button"
          @click="goToSignIn"
        >
          {{ t('welcome.continueToSignIn') }}
        </button>
        <p>{{ t('welcome.authRequired') }}</p>
      </div>
    </div>
  </section>
</template>
