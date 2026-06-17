<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const { t } = useI18n();
const route = useRoute();

const navigationItems = [
  { to: '/', labelKey: 'app.nav.home', icon: 'home', exact: true },
  { to: '/meeting', labelKey: 'app.nav.meeting', icon: 'chat_bubble' },
  { to: '/tasks', labelKey: 'app.nav.tasks', icon: 'check_circle' },
  { to: '/history', labelKey: 'app.nav.history', icon: 'history' },
  { to: '/settings', labelKey: 'app.nav.settings', icon: 'settings' },
];

function isActiveNavItem(item: (typeof navigationItems)[number]) {
  if (item.exact) {
    return route.path === item.to;
  }

  return route.path === item.to || route.path.startsWith(`${item.to}/`);
}
</script>

<template>
  <nav class="bottom-navigation" :aria-label="t('app.navigationLabel')">
    <RouterLink
      v-for="item in navigationItems"
      :key="item.to"
      :to="item.to"
      :class="[
        'bottom-navigation__item',
        { 'bottom-navigation__item--active': isActiveNavItem(item) },
      ]"
    >
      <span
        class="bottom-navigation__icon material-symbols-outlined"
        aria-hidden="true"
      >
        {{ item.icon }}
      </span>
      <span class="bottom-navigation__label">{{ t(item.labelKey) }}</span>
    </RouterLink>
  </nav>
</template>
