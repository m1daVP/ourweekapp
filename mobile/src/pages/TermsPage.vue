<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section class="page-stack legal-page">
    <header>
      <p class="page-kicker">{{ t('legal.terms.kicker') }}</p>
      <h1>{{ t('legal.terms.title') }}</h1>
      <p class="page-copy">{{ t('legal.terms.intro') }}</p>
    </header>

    <section class="content-panel">
      <h2>{{ t('legal.terms.testingTitle') }}</h2>
      <p>{{ t('legal.terms.testingText') }}</p>
    </section>

    <section class="content-panel">
      <h2>{{ t('legal.terms.adviceTitle') }}</h2>
      <p>{{ t('legal.terms.adviceText') }}</p>
    </section>

    <section class="content-panel">
      <h2>{{ t('legal.terms.localDataTitle') }}</h2>
      <p>{{ t('legal.terms.localDataText') }}</p>
    </section>

    <RouterLink class="secondary-button link-button" :to="{ name: 'settings' }">
      {{ t('legal.backToSettings') }}
    </RouterLink>
  </section>
</template>
