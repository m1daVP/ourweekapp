<script setup lang="ts">
import PremiumLock from '@/shared/components/PremiumLock.vue'
</script>

<template>
  <section class="page-stack">
    <div>
      <p class="page-kicker">Weekly Meeting</p>
      <h1>Meeting flow placeholder</h1>
      <p class="page-copy">
        This screen is ready for agenda prompts, notes, and decisions when the
        meeting feature is implemented.
      </p>
    </div>

    <div class="content-panel">
      <h2>Default template</h2>
      <p>Free users can run the core 15-minute weekly meeting flow.</p>
    </div>

    <PremiumLock feature="aiSummary">
      <div class="content-panel feature-summary">
        <h2>AI summary</h2>
        <p>Generate a short summary with decisions and follow-up items.</p>
      </div>
    </PremiumLock>

    <PremiumLock feature="privateNotes">
      <div class="content-panel feature-summary">
        <h2>Private notes</h2>
        <p>Prepare personal notes without adding them to shared meeting notes.</p>
      </div>
    </PremiumLock>
  </section>
</template>
