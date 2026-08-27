<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import {
  readPendingInvitationToken,
  writePendingInvitationToken,
} from '@/shared/services/authTokenStorageService';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const errorMessage = ref('');
const isAccepting = ref(false);

function queryToken() {
  const token = route.query.token;
  return typeof token === 'string' ? token.trim() : '';
}

async function acceptInvitation() {
  const token = queryToken() || (await readPendingInvitationToken());

  if (!token) {
    errorMessage.value = 'This invitation link is invalid or incomplete.';
    return;
  }

  await writePendingInvitationToken(token);

  if (!authStore.isAuthenticated) {
    await router.replace({
      name: 'sign-in',
      query: { redirect: '/invitations/accept' },
    });
    return;
  }

  isAccepting.value = true;
  errorMessage.value = '';
  const accepted = await authStore.acceptWorkspaceInvitation(token);
  isAccepting.value = false;

  if (accepted) {
    await router.replace({ name: 'home' });
    return;
  }

  errorMessage.value = authStore.errorMessage || 'Unable to accept this invitation.';
}

onMounted(() => {
  void acceptInvitation();
});
</script>

<template>
  <section class="auth-page">
    <div>
      <p class="page-kicker">Household invitation</p>
      <h1>Join your household</h1>
      <p class="page-copy">
        {{
          isAccepting
            ? 'Connecting you to this household…'
            : 'Sign in or create an account with the invited email to continue.'
        }}
      </p>
      <p v-if="errorMessage" class="meeting-error" role="alert">
        {{ errorMessage }}
      </p>
    </div>
  </section>
</template>
