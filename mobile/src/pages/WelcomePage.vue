<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'
import { appConfig } from '@/shared/config/env'

const router = useRouter()
const authStore = useAuthStore()

const isMockAuth = computed(() => appConfig.apiMode === 'mock')

function continueLocalOnly() {
  authStore.continueLocalOnly()
  void router.push({ name: 'home' })
}
</script>

<template>
  <section class="auth-page welcome-page">
    <div class="auth-hero">
      <p class="page-kicker">Weekly Us</p>
      <h1>
        A calmer weekly check-in, with your household history kept together.
      </h1>
      <p class="page-copy">
        Create an account when you want sync, history across devices, and future
        premium features. You can also keep using this phone only.
      </p>
    </div>

    <div class="auth-benefit-list" aria-label="Why create an account">
      <div>
        <strong>Sync later</strong>
        <p>Prepare for cross-device access when backend sync is connected.</p>
      </div>
      <div>
        <strong>Keep history</strong>
        <p>Connect meetings, agreements, and unfinished follow-ups to you.</p>
      </div>
      <div>
        <strong>Premium ready</strong>
        <p>
          Use the same account model for paid features when payments are added.
        </p>
      </div>
    </div>

    <p v-if="isMockAuth" class="auth-note">
      Account sign-in is mocked in this build. No real password is stored
      locally.
    </p>

    <div class="auth-actions">
      <RouterLink class="meeting-primary link-button" :to="{ name: 'sign-up' }">
        Create account
      </RouterLink>
      <RouterLink
        class="secondary-button link-button"
        :to="{ name: 'sign-in' }"
      >
        Sign in
      </RouterLink>
      <button type="button" class="text-button" @click="continueLocalOnly">
        Continue on this device only
      </button>
    </div>
  </section>
</template>
