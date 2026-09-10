<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();
const isLoggingOut = ref(false);
const userEmail = computed(
  () => authStore.user?.email ?? t('logout.accountFallback')
);

async function confirmLogout() {
  isLoggingOut.value = true;
  await authStore.logout();
  void router.replace({ name: 'welcome' });
}
</script>

<template>
  <section class="auth-page">
    <div>
      <p class="page-kicker">{{ t('logout.kicker') }}</p>
      <h1>{{ t('logout.title') }}</h1>
      <p class="page-copy">
        {{ t('logout.intro', { email: userEmail }) }}
      </p>
    </div>

    <div class="content-panel settings-panel">
      <p>
        {{ t('logout.help') }}
      </p>
      <button
        class="meeting-primary"
        type="button"
        :disabled="isLoggingOut"
        @click="confirmLogout"
      >
        {{ isLoggingOut ? t('logout.loggingOut') : t('logout.kicker') }}
      </button>
      <RouterLink
        class="secondary-button link-button"
        :to="{ name: 'settings' }"
      >
        {{ t('logout.keepSignedIn') }}
      </RouterLink>
    </div>
  </section>
</template>
