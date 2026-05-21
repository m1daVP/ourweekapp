<script setup lang="ts">
import PremiumLock from '@/shared/components/PremiumLock.vue';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';

const { canUseFeature, getFreeLimit } = useFeatureAccess();
const freeHistoryLimit = getFreeLimit('limitedHistory') ?? 3;
</script>

<template>
  <section class="page-stack">
    <div>
      <p class="page-kicker">Weekly Us</p>
      <h1>Make the weekly household check-in easier to start.</h1>
      <p class="page-copy">
        A focused mobile space for recurring conversations, shared tasks, and
        small agreements that keep the week moving.
      </p>
    </div>

    <div class="content-panel">
      <h2>Today</h2>
      <p>
        Start with the default meeting template, review open tasks, then agree
        on next steps.
      </p>
    </div>

    <div class="content-panel feature-summary">
      <h2>Meeting history</h2>
      <p v-if="canUseFeature('unlimitedHistory')">
        Your plan can keep unlimited meeting history.
      </p>
      <p v-else>
        Free history includes the latest {{ freeHistoryLimit }} completed
        meetings.
      </p>
    </div>

    <PremiumLock feature="unlimitedHistory">
      <div class="content-panel feature-summary">
        <h2>Full household record</h2>
        <p>Review every completed meeting and agreement over time.</p>
      </div>
    </PremiumLock>
  </section>
</template>
