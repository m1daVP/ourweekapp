<script setup lang="ts">
const navigationItems = [
  { to: '/', label: 'Home' },
  { to: '/meeting', label: 'Meeting' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
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
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
