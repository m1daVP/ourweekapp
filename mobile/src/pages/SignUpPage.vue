<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import { appConfig } from '@/shared/config/env';

const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();
const formError = ref('');
const form = reactive({
  displayName: '',
  email: '',
  password: '',
});

const isSubmitting = computed(() => authStore.authStatus === 'loading');
const isMockAuth = computed(() => appConfig.apiMode === 'mock');

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

      <p v-if="isMockAuth" class="auth-note">
        {{ t('auth.mockSignUp') }}
      </p>
      <p v-if="formError" class="meeting-error" role="alert">
        {{ formError }}
      </p>

      <button class="meeting-primary" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? t('auth.creating') : t('auth.createAccount') }}
      </button>
    </form>

    <p class="auth-switch">
      {{ t('auth.alreadyHaveAccount') }}
      <RouterLink :to="{ name: 'sign-in' }">{{ t('auth.signIn') }}</RouterLink>
    </p>
  </section>
</template>
