<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { privacyPolicy } from '@/features/legal/productionLegalContent';

const { t } = useI18n();
</script>

<template>
  <section class="page-stack legal-page">
    <header>
      <p class="page-kicker">OurWeek</p>
      <h1>{{ privacyPolicy.title }}</h1>
      <p class="page-copy">{{ privacyPolicy.intro }}</p>
      <p>{{ privacyPolicy.effectiveDate }}</p>
    </header>

    <section
      v-for="section in privacyPolicy.sections"
      :key="section.heading"
      class="content-panel"
    >
      <h2>{{ section.heading }}</h2>
      <p v-for="paragraph in section.paragraphs" :key="paragraph">
        {{ paragraph }}
      </p>
      <ul v-if="section.links" class="legal-page__links">
        <li v-for="link in section.links" :key="link.url">
          <a :href="link.url" target="_blank" rel="noopener noreferrer">
            {{ link.label }}
          </a>
        </li>
      </ul>
    </section>

    <RouterLink class="secondary-button link-button" :to="{ name: 'settings' }">
      {{ t('legal.backToSettings') }}
    </RouterLink>
  </section>
</template>
