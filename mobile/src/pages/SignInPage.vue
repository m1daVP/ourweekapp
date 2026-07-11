<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import GoogleSignInButton from '@/features/auth/GoogleSignInButton.vue';
import { isNativeGoogleSignInSupported } from '@/features/auth/googleSignInService';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();
const formError = ref('');
const form = reactive({
  email: '',
  password: '',
});
const showGoogleSignIn = isNativeGoogleSignInSupported();

const isSubmitting = computed(() => authStore.authStatus === 'loading');
const authErrorDetails = computed(() => {
  const error = authStore.lastAuthError;

  if (!error) {
    return '';
  }

  return [
    error.source,
    error.status ? String(error.status) : null,
    error.code,
    error.name,
    error.hasDetails ? 'details available' : null,
  ]
    .filter(Boolean)
    .join(' / ');
});

function getRedirectPath() {
  const redirect = route.query.redirect;

  return typeof redirect === 'string' && redirect.startsWith('/')
    ? redirect
    : '/';
}

async function handleSubmit() {
  formError.value = '';

  if (!form.email.trim()) {
    formError.value = t('auth.addEmail');
    return;
  }

  if (!form.password) {
    formError.value = t('auth.addPassword');
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

  formError.value = authStore.errorMessage || t('auth.signInFailed');
}

async function handleGoogleSignIn() {
  formError.value = '';

  const didSignIn = await authStore.signInWithGoogle();

  if (didSignIn) {
    void router.push(getRedirectPath());
    return;
  }

  formError.value = authStore.errorMessage || t('auth.googleSignInFailed');
}
</script>

<template>
  <section class="auth-page">
    <div>
      <p class="page-kicker">{{ t('auth.signInKicker') }}</p>
      <h1>{{ t('auth.welcomeBack') }}</h1>
      <p class="page-copy">{{ t('auth.signInIntro') }}</p>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit">
      <label>
        <span>{{ t('common.email') }}</span>
        <input
          v-model="form.email"
          autocomplete="email"
          inputmode="email"
          type="email"
          :placeholder="t('auth.emailPlaceholder')"
        />
      </label>
      <label>
        <span>{{ t('common.password') }}</span>
        <input
          v-model="form.password"
          autocomplete="current-password"
          type="password"
          :placeholder="t('common.password')"
        />
      </label>

      <p class="auth-switch">
        <RouterLink :to="{ name: 'forgot-password' }">
          {{ t('auth.forgotPassword') }}
        </RouterLink>
      </p>

      <p v-if="formError" class="meeting-error" role="alert">
        {{ formError }}
      </p>
      <div v-if="authErrorDetails" class="auth-debug-details">
        <p>{{ t('auth.errorDetails') }}: {{ authErrorDetails }}</p>
      </div>

      <button class="meeting-primary" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? t('auth.signingIn') : t('auth.signIn') }}
      </button>
    </form>

    <div v-if="showGoogleSignIn" class="auth-social-actions">
      <GoogleSignInButton
        :disabled="isSubmitting"
        :loading="isSubmitting"
        @click="handleGoogleSignIn"
      />
    </div>

    <p class="auth-switch">
      {{ t('auth.newHere') }}
      <RouterLink :to="{ name: 'sign-up' }">
        {{ t('auth.createAccount') }}
      </RouterLink>
    </p>
  </section>
</template>
