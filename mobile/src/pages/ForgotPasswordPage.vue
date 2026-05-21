<script setup lang="ts">
import { ref } from 'vue'

const email = ref('')
const statusMessage = ref('')
const formError = ref('')

function handleSubmit() {
  statusMessage.value = ''
  formError.value = ''

  if (!email.value.trim()) {
    formError.value = 'Add the email for your account.'
    return
  }

  statusMessage.value =
    'Password reset is a placeholder until backend email is connected.'
}
</script>

<template>
  <section class="auth-page">
    <div>
      <p class="page-kicker">Password help</p>
      <h1>Reset password placeholder.</h1>
      <p class="page-copy">
        Backend email is not connected yet. This screen keeps the account flow
        ready without pretending a reset was sent.
      </p>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit">
      <label>
        <span>Email</span>
        <input
          v-model="email"
          autocomplete="email"
          inputmode="email"
          type="email"
          placeholder="you@example.com"
        />
      </label>
      <p v-if="formError" class="meeting-error" role="alert">
        {{ formError }}
      </p>
      <p v-if="statusMessage" class="meeting-status" role="status">
        {{ statusMessage }}
      </p>
      <button class="meeting-primary" type="submit">Continue</button>
    </form>

    <p class="auth-switch">
      Remembered it?
      <RouterLink :to="{ name: 'sign-in' }">Sign in</RouterLink>
    </p>
  </section>
</template>
