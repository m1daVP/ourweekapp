<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import GoogleSignInButton from '@/features/auth/GoogleSignInButton.vue';
import { isNativeGoogleSignInSupported } from '@/features/auth/googleSignInService';

const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();
const formError = ref('');
const form = reactive({
  displayName: '',
  email: '',
  password: '',
});
const showGoogleSignIn = isNativeGoogleSignInSupported();

const isSubmitting = computed(() => authStore.authStatus === 'loading');

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

  const didSignUp = await authStore.signUp({
    displayName: form.displayName,
    email: form.email,
    password: form.password,
  });

  if (didSignUp) {
    void router.push({ name: 'home' });
    return;
  }

  formError.value = authStore.errorMessage || t('auth.signUpFailed');
}

async function handleGoogleSignIn() {
  formError.value = '';

  const didSignIn = await authStore.signInWithGoogle();

  if (didSignIn) {
    void router.push({ name: 'home' });
    return;
  }

  formError.value = authStore.errorMessage || t('auth.googleSignInFailed');
}
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
    </div>

    <p class="auth-switch">
      {{ t('auth.alreadyHaveAccount') }}
      <RouterLink :to="{ name: 'sign-in' }">{{ t('auth.signIn') }}</RouterLink>
    </p>
  </section>
</template>
