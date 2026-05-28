<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const email = ref('');
const statusMessage = ref('');
const formError = ref('');

function handleSubmit() {
  statusMessage.value = '';
  formError.value = '';

  if (!email.value.trim()) {
    formError.value = t('auth.addAccountEmail');
    return;
  }

  statusMessage.value = t('auth.resetPlaceholder');
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
      <p v-if="statusMessage" class="meeting-status" role="status">
        {{ statusMessage }}
      </p>
      <button class="meeting-primary" type="submit">
        {{ t('auth.continue') }}
      </button>
    </form>

    <p class="auth-switch">
      {{ t('auth.remembered') }}
      <RouterLink :to="{ name: 'sign-in' }">{{ t('auth.signIn') }}</RouterLink>
    </p>
  </section>
</template>
