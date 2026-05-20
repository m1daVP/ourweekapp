<script setup lang="ts">
const navigationItems = [
  { to: '/', label: 'Home' },
  { to: '/meeting', label: 'Meeting' },
  { to: '/history', label: 'History' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/private-notes', label: 'Notes' },
  { to: '/settings', label: 'Settings' },
]
</script>

<template>
  <nav class="app-navigation" aria-label="Primary navigation">
    <RouterLink
      v-for="item in navigationItems"
      :key="item.to"
      :to="item.to"
      class="app-navigation__item"
    >
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
