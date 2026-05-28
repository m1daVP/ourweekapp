<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import { appConfig } from '@/shared/config/env';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();
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

      <RouterLink class="small-link" :to="{ name: 'forgot-password' }">
        {{ t('auth.forgotPassword') }}
      </RouterLink>

      <p v-if="isMockAuth" class="auth-note">
        {{ t('auth.mockSignIn') }}
      </p>
      <p v-if="formError" class="meeting-error" role="alert">
        {{ formError }}
      </p>

      <button class="meeting-primary" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? t('auth.signingIn') : t('auth.signIn') }}
      </button>
    </form>

    <p class="auth-switch">
      {{ t('auth.newHere') }}
      <RouterLink :to="{ name: 'sign-up' }">
        {{ t('auth.createAccount') }}
      </RouterLink>
    </p>
  </section>
</template>
