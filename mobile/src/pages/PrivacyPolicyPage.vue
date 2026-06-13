<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const privacySections = [
  {
    title: 'legal.privacy.accountTitle',
    text: 'legal.privacy.accountText',
  },
  {
    title: 'legal.privacy.syncTitle',
    text: 'legal.privacy.syncText',
  },
  {
    title: 'legal.privacy.localStorageTitle',
    text: 'legal.privacy.localStorageText',
  },
  {
    title: 'legal.privacy.privateNotesTitle',
    text: 'legal.privacy.privateNotesText',
  },
  {
    title: 'legal.privacy.aiTitle',
    text: 'legal.privacy.aiText',
  },
  {
    title: 'legal.privacy.subscriptionTitle',
    text: 'legal.privacy.subscriptionText',
  },
  {
    title: 'legal.privacy.calendarTitle',
    text: 'legal.privacy.calendarText',
  },
  {
    title: 'legal.privacy.notificationsTitle',
    text: 'legal.privacy.notificationsText',
  },
  {
    title: 'legal.privacy.exportTitle',
    text: 'legal.privacy.exportText',
  },
  {
    title: 'legal.privacy.rightsTitle',
    text: 'legal.privacy.rightsText',
  },
];
</script>

<template>
  <section class="page-stack legal-page">
    <header>
      <p class="page-kicker">{{ t('legal.privacy.kicker') }}</p>
      <h1>{{ t('legal.privacy.title') }}</h1>
      <p class="page-copy">{{ t('legal.privacy.intro') }}</p>
    </header>

    <section
      v-for="section in privacySections"
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
