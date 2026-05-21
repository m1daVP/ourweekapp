<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const isLoggingOut = ref(false)
const userEmail = computed(() => authStore.user?.email ?? 'this account')

async function confirmLogout() {
  isLoggingOut.value = true
  await authStore.logout()
  void router.replace({ name: 'welcome' })
}
</script>

<template>
  <section class="auth-page">
    <div>
      <p class="page-kicker">Log out</p>
      <h1>Log out of Weekly Us?</h1>
      <p class="page-copy">
        You will leave {{ userEmail }} on this device. Local meeting data
        already saved on this phone is not deleted.
      </p>
    </div>

    <div class="content-panel settings-panel">
      <p>
        You can continue local-only after logging out, or sign back in from the
        welcome screen.
      </p>
      <button
        class="meeting-primary"
        type="button"
        :disabled="isLoggingOut"
        @click="confirmLogout"
      >
        {{ isLoggingOut ? 'Logging out...' : 'Log out' }}
      </button>
      <RouterLink
        class="secondary-button link-button"
        :to="{ name: 'account' }"
      >
        Keep signed in
      </RouterLink>
    </div>
  </section>
</template>
