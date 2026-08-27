<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import GoogleSignInButton from '@/features/auth/GoogleSignInButton.vue';
import { isNativeGoogleSignInSupported } from '@/features/auth/googleSignInService';
import { navigateAfterAuthentication } from '@/features/auth/postAuthNavigation';
import { captureHandledError } from '@/shared/services/errorMonitoringService';
import { readPendingInvitationToken } from '@/shared/services/authTokenStorageService';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();
const formError = ref('');
const isNavigating = ref(false);
const form = reactive({
  displayName: '',
  email: '',
  password: '',
});
const showGoogleSignIn = isNativeGoogleSignInSupported();

const isSubmitting = computed(
  () => authStore.authStatus === 'loading' || isNavigating.value
);
const isGoogleSignInPending = computed(
  () =>
    authStore.authStatus === 'loading' &&
    authStore.authOperationStage !== 'idle' &&
    authStore.authOperationStage !== 'navigation'
);
const authErrorDetails = computed(() => {
  const error = authStore.lastAuthError;

  if (!error) {
    return '';
  }

  return [
    error.source,
    error.stage,
    error.status ? String(error.status) : null,
    error.code,
    error.name,
    error.hasDetails ? 'details available' : null,
  ]
    .filter(Boolean)
    .join(' / ');
});

async function openAuthenticatedApp(provider: 'google' | 'password') {
  authStore.setAuthOperationStage('navigation');
  isNavigating.value = true;

  try {
    await navigateAfterAuthentication(router, route.query.redirect);
    authStore.setAuthOperationStage('idle');
    return true;
  } catch (error) {
    captureHandledError(error, {
      tags: {
        feature: 'auth',
        provider,
        stage: 'navigation',
      },
    });
    formError.value = t('auth.navigationFailed');
    return false;
  } finally {
    isNavigating.value = false;
  }
}

async function handleSubmit() {
  formError.value = '';

  if (!form.displayName.trim()) {
    formError.value = t('account.addDisplayName');
    return;
  }

  if (!form.email.trim()) {
    formError.value = t('auth.addEmail');
    return;
  }

  if (form.password.length < 8) {
    formError.value = t('auth.passwordLength');
    return;
  }

  const invitationToken = await readPendingInvitationToken();
  const didSignUp = await authStore.signUp({
    displayName: form.displayName,
    email: form.email,
    password: form.password,
    invitationToken: invitationToken ?? undefined,
  });

  if (didSignUp) {
    if (invitationToken) {
      await router.replace({ name: 'home' });
      return;
    }
    await openAuthenticatedApp('password');
    return;
  }

  formError.value = authStore.errorMessage || t('auth.signUpFailed');
}

async function handleGoogleSignIn() {
  formError.value = '';

  const didSignIn = await authStore.signInWithGoogle();

  if (didSignIn) {
    await openAuthenticatedApp('google');
    return;
  }

  if (authStore.authStatus === 'idle' && !authStore.errorMessage) {
    return;
  }

  formError.value = authStore.errorMessage || t('auth.googleSignInFailed');
}

function cancelGoogleSignIn() {
  formError.value = '';
  authStore.cancelPendingGoogleSignIn();
}

onBeforeRouteLeave(() => {
  authStore.cancelPendingGoogleSignIn();
  return true;
});
</script>

<template>
  <section class="auth-page">
    <div>
      <p class="page-kicker">{{ t('auth.createAccount') }}</p>
      <h1>{{ t('app.name') }}</h1>
      <p class="page-copy">{{ t('auth.createAccountIntro') }}</p>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit">
      <label>
        <span>{{ t('common.displayName') }}</span>
        <input
          v-model="form.displayName"
          autocomplete="name"
          type="text"
          :placeholder="t('auth.yourName')"
        />
      </label>
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
          autocomplete="new-password"
          type="password"
          :placeholder="t('auth.passwordHelp')"
        />
      </label>

      <p v-if="formError" class="meeting-error" role="alert">
        {{ formError }}
      </p>
      <div v-if="authErrorDetails" class="auth-debug-details">
        <p>{{ t('auth.errorDetails') }}: {{ authErrorDetails }}</p>
      </div>

      <button class="meeting-primary" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? t('auth.creating') : t('auth.createAccount') }}
      </button>
    </form>

    <div v-if="showGoogleSignIn" class="auth-social-actions">
      <GoogleSignInButton
        :disabled="isSubmitting"
        :loading="isSubmitting"
        @click="handleGoogleSignIn"
      />
      <button
        v-if="isGoogleSignInPending"
        class="base-button base-button--ghost"
        type="button"
        @click="cancelGoogleSignIn"
      >
        {{ t('common.cancel') }}
      </button>
    </div>

    <p class="auth-switch">
      {{ t('auth.alreadyHaveAccount') }}
      <RouterLink
        :to="{ name: 'sign-in', query: { redirect: route.query.redirect } }"
        @click="cancelGoogleSignIn"
      >
        {{ t('auth.signIn') }}
      </RouterLink>
    </p>
  </section>
</template>
