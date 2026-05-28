<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section class="page-stack legal-page">
    <header>
      <p class="page-kicker">{{ t('legal.privacy.kicker') }}</p>
      <h1>{{ t('legal.privacy.title') }}</h1>
      <p class="page-copy">{{ t('legal.privacy.intro') }}</p>
    </header>

    <section class="content-panel">
      <h2>{{ t('legal.privacy.dataTitle') }}</h2>
      <p>{{ t('legal.privacy.dataText') }}</p>
    </section>

    <section class="content-panel">
      <h2>{{ t('legal.privacy.privateNotesTitle') }}</h2>
      <p>{{ t('legal.privacy.privateNotesText') }}</p>
    </section>

    <section class="content-panel">
      <h2>{{ t('legal.privacy.aiTitle') }}</h2>
      <p>{{ t('legal.privacy.aiText') }}</p>
      <p>{{ t('legal.privacy.premiumText') }}</p>
    </section>

    <RouterLink class="secondary-button link-button" :to="{ name: 'settings' }">
      {{ t('legal.backToSettings') }}
    </RouterLink>
  </section>
</template>
