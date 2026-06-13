<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const termsSections = [
  {
    title: 'legal.terms.serviceTitle',
    text: 'legal.terms.serviceText',
  },
  {
    title: 'legal.terms.adviceTitle',
    text: 'legal.terms.adviceText',
  },
  {
    title: 'legal.terms.accountTitle',
    text: 'legal.terms.accountText',
  },
  {
    title: 'legal.terms.subscriptionTitle',
    text: 'legal.terms.subscriptionText',
  },
  {
    title: 'legal.terms.aiTitle',
    text: 'legal.terms.aiText',
  },
  {
    title: 'legal.terms.calendarTitle',
    text: 'legal.terms.calendarText',
  },
  {
    title: 'legal.terms.dataTitle',
    text: 'legal.terms.dataText',
  },
  {
    title: 'legal.terms.availabilityTitle',
    text: 'legal.terms.availabilityText',
  },
];
</script>

<template>
  <section class="page-stack legal-page">
    <header>
      <p class="page-kicker">{{ t('legal.terms.kicker') }}</p>
      <h1>{{ t('legal.terms.title') }}</h1>
      <p class="page-copy">{{ t('legal.terms.intro') }}</p>
    </header>

    <section
      v-for="section in termsSections"
      :key="section.title"
      class="content-panel"
    >
      <h2>{{ t(section.title) }}</h2>
      <p>{{ t(section.text) }}</p>
    </section>

    <RouterLink class="secondary-button link-button" :to="{ name: 'settings' }">
      {{ t('legal.backToSettings') }}
    </RouterLink>
  </section>
</template>
