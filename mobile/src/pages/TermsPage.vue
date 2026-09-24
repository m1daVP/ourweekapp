<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { termsOfService } from '@/features/legal/productionLegalContent';

const { t } = useI18n();
</script>

<template>
  <section class="page-stack legal-page">
    <header>
      <p class="page-kicker">OurWeek</p>
      <h1>{{ termsOfService.title }}</h1>
      <p class="page-copy">{{ termsOfService.intro }}</p>
      <p>{{ termsOfService.effectiveDate }}</p>
    </header>

    <section
      v-for="section in termsOfService.sections"
      :key="section.heading"
      class="content-panel"
    >
      <h2>{{ section.heading }}</h2>
      <p v-for="paragraph in section.paragraphs" :key="paragraph">
        {{ paragraph }}
      </p>
    </section>

    <RouterLink class="secondary-button link-button" :to="{ name: 'settings' }">
      {{ t('legal.backToSettings') }}
    </RouterLink>
  </section>
</template>
