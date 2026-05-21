<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import { appConfig } from '@/shared/config/env';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const formError = ref('');
const form = reactive({
  email: '',
  password: '',
});

const isSubmitting = computed(() => authStore.authStatus === 'loading');
const isMockAuth = computed(() => appConfig.apiMode === 'mock');

function getRedirectPath() {
  const redirect = route.query.redirect;

  return typeof redirect === 'string' && redirect.startsWith('/')
    ? redirect
    : '/';
}

async function handleSubmit() {
  formError.value = '';

  if (!form.email.trim()) {
    formError.value = 'Add an email address.';
    return;
  }

  if (!form.password) {
    formError.value = 'Add your password.';
    return;
  }

  const didSignIn = await authStore.signIn({
    email: form.email,
    password: form.password,
  });

  if (didSignIn) {
    void router.push(getRedirectPath());
    return;
  }

  formError.value = authStore.errorMessage || 'Could not sign in.';
}
</script>

<template>
  <section class="auth-page">
    <div>
      <p class="page-kicker">Sign in</p>
      <h1>Open your Weekly Us account.</h1>
      <p class="page-copy">
        Use email and password for now. Local-only data stays on this device.
      </p>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit">
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
          autocomplete="current-password"
          type="password"
          placeholder="Password"
        />
      </label>

      <RouterLink class="small-link" :to="{ name: 'forgot-password' }">
        Forgot password?
      </RouterLink>

      <p v-if="isMockAuth" class="auth-note">
        Mock auth is active. Any email and password will create a temporary
        frontend session.
      </p>
      <p v-if="formError" class="meeting-error" role="alert">
        {{ formError }}
      </p>

      <button class="meeting-primary" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>

    <p class="auth-switch">
      New to Weekly Us?
      <RouterLink :to="{ name: 'sign-up' }">Create account</RouterLink>
    </p>
  </section>
</template>
