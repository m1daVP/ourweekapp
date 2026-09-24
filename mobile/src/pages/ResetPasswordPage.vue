<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  normalizeResetPasswordToken,
  submitResetPasswordConfirmation,
  type ResetPasswordValidationError,
} from '@/features/auth/passwordReset';
import { useInAppNotification } from '@/shared/composables/useInAppNotification';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const token = ref('');
const password = ref('');
const formError = ref('');
const isSubmitting = ref(false);
const hasConfirmedReset = ref(false);
let redirectTimeoutId: ReturnType<typeof window.setTimeout> | null = null;
const { showInAppNotification } = useInAppNotification();

onMounted(() => {
  token.value = normalizeResetPasswordToken(route.query.token);

  if (Object.hasOwn(route.query, 'token')) {
    void router.replace({ name: 'reset-password' });
  }
});

onBeforeUnmount(() => {
  if (redirectTimeoutId) {
    window.clearTimeout(redirectTimeoutId);
  }
});

function getValidationMessage(error: ResetPasswordValidationError) {
  if (error === 'missingToken') {
    return t('auth.resetMissingToken');
  }

  if (error === 'missingPassword') {
    return t('auth.addPassword');
  }

  return t('auth.passwordLength');
}

async function handleSubmit() {
  if (hasConfirmedReset.value) {
    return;
  }

  formError.value = '';
  isSubmitting.value = true;

  try {
    const result = await submitResetPasswordConfirmation({
      token: token.value,
      password: password.value,
    });

    if (result.status === 'invalid') {
      formError.value = getValidationMessage(result.error);
      return;
    }

    password.value = '';
    hasConfirmedReset.value = true;
    showInAppNotification(t('auth.resetConfirmed'));
    redirectTimeoutId = window.setTimeout(() => {
      void router.replace({ name: 'sign-in' });
    }, 1600);
  } catch {
    formError.value = t('auth.resetConfirmFailed');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="auth-page">
    <div>
      <p class="page-kicker">{{ t('auth.passwordHelpKicker') }}</p>
      <h1>{{ t('auth.chooseNewPasswordTitle') }}</h1>
      <p class="page-copy">{{ t('auth.chooseNewPasswordIntro') }}</p>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit">
      <label>
        <span>{{ t('auth.resetCodeLabel') }}</span>
        <input
          v-model.trim="token"
          autocomplete="one-time-code"
          type="text"
          :placeholder="t('auth.resetCodeLabel')"
        />
      </label>
      <label>
        <span>{{ t('common.password') }}</span>
        <input
          v-model="password"
          autocomplete="new-password"
          type="password"
          :placeholder="t('auth.passwordHelp')"
        />
      </label>

      <p v-if="formError" class="meeting-error" role="alert">
        {{ formError }}
      </p>
      <button
        class="meeting-primary"
        type="submit"
        :disabled="isSubmitting || hasConfirmedReset"
      >
        {{
          isSubmitting ? t('auth.updatingPassword') : t('auth.updatePassword')
        }}
      </button>
    </form>

    <p class="auth-switch">
      <RouterLink :to="{ name: 'sign-in' }">{{ t('auth.signIn') }}</RouterLink>
    </p>
  </section>
</template>
