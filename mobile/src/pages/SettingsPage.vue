<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { featureAccessConfig, premiumFeatureKeys } from '@/features/access/featureAccess.config'
import type { FeatureKey, PlanType, UserRole } from '@/features/access/types'
import UpgradePrompt from '@/shared/components/UpgradePrompt.vue'
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess'

const route = useRoute()
const { planType, userRole, canUseFeature, setMockPlan, setMockRole } = useFeatureAccess()

const planOptions: PlanType[] = ['free', 'premium']
const roleOptions: Array<{ label: string; value: UserRole }> = [
  { label: 'Owner', value: 'owner' },
  { label: 'Partner / Adult', value: 'partner' },
  { label: 'Viewer', value: 'viewer' },
  { label: 'Child profile', value: 'childProfile' },
]

const lockedFeature = computed(() => {
  const value = route.query.lockedFeature

  if (typeof value !== 'string') {
    return undefined
  }

  if (!Object.prototype.hasOwnProperty.call(featureAccessConfig, value)) {
    return undefined
  }

  return value as FeatureKey
})
</script>

<template>
  <section class="page-stack">
    <div>
      <p class="page-kicker">Settings</p>
      <h1>Access model</h1>
      <p class="page-copy">
        Mock plan and workspace role state for testing free and premium UI.
      </p>
    </div>

    <UpgradePrompt v-if="lockedFeature" :feature="lockedFeature" />

    <div class="content-panel settings-panel">
      <h2>Mock plan</h2>
      <div class="segmented-control" aria-label="Mock plan">
        <button
          v-for="plan in planOptions"
          :key="plan"
          type="button"
          :class="['segmented-control__button', { 'is-active': planType === plan }]"
          @click="setMockPlan(plan)"
        >
          {{ plan }}
        </button>
      </div>
    </div>

    <div class="content-panel settings-panel">
      <h2>Workspace role</h2>
      <div class="role-grid">
        <button
          v-for="role in roleOptions"
          :key="role.value"
          type="button"
          :class="['role-option', { 'is-active': userRole === role.value }]"
          @click="setMockRole(role.value)"
        >
          {{ role.label }}
        </button>
      </div>
    </div>

    <div class="content-panel settings-panel">
      <h2>Premium feature checks</h2>
      <ul class="feature-list">
        <li v-for="featureKey in premiumFeatureKeys" :key="featureKey">
          <div>
            <strong>{{ featureAccessConfig[featureKey].label }}</strong>
            <p>{{ featureAccessConfig[featureKey].description }}</p>
          </div>
          <span :class="['feature-status', { 'is-available': canUseFeature(featureKey) }]">
            {{ canUseFeature(featureKey) ? 'Available' : 'Locked' }}
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>
