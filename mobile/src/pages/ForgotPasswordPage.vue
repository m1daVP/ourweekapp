<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestPasswordReset } from '@/shared/api/authApi';
import { useInAppNotification } from '@/shared/composables/useInAppNotification';

const { t } = useI18n();
const email = ref('');
const hasRequestedReset = ref(false);
const formError = ref('');
const isSubmitting = ref(false);
const { showInAppNotification } = useInAppNotification();

async function handleSubmit() {
  hasRequestedReset.value = false;
  formError.value = '';
  const normalizedEmail = email.value.trim().toLowerCase();

  if (!normalizedEmail) {
    formError.value = t('auth.addAccountEmail');
    return;
  }

  isSubmitting.value = true;

  try {
    await requestPasswordReset({ email: normalizedEmail });
    hasRequestedReset.value = true;
    showInAppNotification(t('auth.resetRequested'));
  } catch (error) {
    formError.value =
      error instanceof Error ? error.message : t('auth.resetFailed');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="auth-page">
    <div>
      <p class="page-kicker">{{ t('auth.passwordHelpKicker') }}</p>
      <h1>{{ t('auth.resetPasswordTitle') }}</h1>
      <p class="page-copy">{{ t('auth.resetPasswordIntro') }}</p>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit">
      <label>
        <span>{{ t('common.email') }}</span>
        <input
          v-model="email"
          autocomplete="email"
          inputmode="email"
          type="email"
          :placeholder="t('auth.emailPlaceholder')"
        />
      </label>
      <p v-if="formError" class="meeting-error" role="alert">
        {{ formError }}
      </p>
      <p v-if="hasRequestedReset" class="auth-switch">
        <RouterLink :to="{ name: 'reset-password' }">
          {{ t('auth.enterResetCode') }}
        </RouterLink>
      </p>
      <button class="meeting-primary" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? t('auth.sendingReset') : t('auth.continue') }}
      </button>
    </form>

    <p class="auth-switch">
      {{ t('auth.remembered') }}
      <RouterLink :to="{ name: 'sign-in' }">{{ t('auth.signIn') }}</RouterLink>
    </p>
  </section>
</template>
