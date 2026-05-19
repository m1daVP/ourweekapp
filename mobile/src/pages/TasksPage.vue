<script setup lang="ts">
import PremiumLock from '@/shared/components/PremiumLock.vue'
</script>

<template>
  <section class="page-stack">
    <div>
      <p class="page-kicker">Tasks</p>
      <h1>Shared task list placeholder</h1>
      <p class="page-copy">
        This screen will hold household follow-ups and assignments after the
        core task workflow is defined.
      </p>
    </div>

    <div class="content-panel">
      <h2>Tasks and agreements</h2>
      <p>Free users can create tasks, create agreements, and assign owners.</p>
    </div>

    <PremiumLock feature="agreementReminders">
      <div class="content-panel feature-summary">
        <h2>Unfinished agreement reminders</h2>
        <p>Remind the family when an agreement still needs follow-up.</p>
      </div>
    </PremiumLock>
  </section>
</template>
