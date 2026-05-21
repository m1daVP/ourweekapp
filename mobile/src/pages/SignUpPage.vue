<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'
import { appConfig } from '@/shared/config/env'

const router = useRouter()
const authStore = useAuthStore()
const formError = ref('')
const form = reactive({
  displayName: '',
  email: '',
  password: '',
})

const isSubmitting = computed(() => authStore.authStatus === 'loading')
const isMockAuth = computed(() => appConfig.apiMode === 'mock')

async function handleSubmit() {
  formError.value = ''

  if (!form.displayName.trim()) {
    formError.value = 'Add a display name.'
    return
  }

  if (!form.email.trim()) {
    formError.value = 'Add an email address.'
    return
  }

  if (form.password.length < 8) {
    formError.value = 'Use at least 8 characters for the password.'
    return
  }

  const didSignUp = await authStore.signUp({
    displayName: form.displayName,
    email: form.email,
    password: form.password,
  })

  if (didSignUp) {
    void router.push({ name: 'home' })
    return
  }

  formError.value = authStore.errorMessage || 'Could not create the account.'
}
</script>

<template>
  <section class="auth-page">
    <div>
      <p class="page-kicker">Create account</p>
      <h1>Set up Weekly Us for sync later.</h1>
      <p class="page-copy">
        Email and password are enough for the MVP. Google and Apple sign-in are
        not enabled yet.
      </p>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit">
      <label>
        <span>Display name</span>
        <input
          v-model="form.displayName"
          autocomplete="name"
          type="text"
          placeholder="Your name"
        />
      </label>
      <label>
        <span>Email</span>
        <input
          v-model="form.email"
          autocomplete="email"
          inputmode="email"
          type="email"
          placeholder="you@example.com"
        />
      </label>
      <label>
        <span>Password</span>
        <input
          v-model="form.password"
          autocomplete="new-password"
          type="password"
          placeholder="At least 8 characters"
        />
      </label>

      <p v-if="isMockAuth" class="auth-note">
        Mock auth is active. The password is sent through the mock auth service
        and is not saved locally.
      </p>
      <p v-if="formError" class="meeting-error" role="alert">
        {{ formError }}
      </p>

      <button class="meeting-primary" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Creating...' : 'Create account' }}
      </button>
    </form>

    <p class="auth-switch">
      Already have an account?
      <RouterLink :to="{ name: 'sign-in' }">Sign in</RouterLink>
    </p>
  </section>
</template>
