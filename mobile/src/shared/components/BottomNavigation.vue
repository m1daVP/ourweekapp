<script setup lang="ts">
const navigationItems = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/meeting', label: 'Meeting', icon: 'chat_bubble' },
  { to: '/tasks', label: 'Tasks', icon: 'check_circle' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];
</script>

<template>
  <nav class="bottom-navigation" aria-label="Primary navigation">
    <RouterLink
      v-for="item in navigationItems"
      :key="item.to"
      :to="item.to"
      class="bottom-navigation__item"
    >
      <span class="material-symbols-outlined" aria-hidden="true">
        {{ item.icon }}
      </span>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
