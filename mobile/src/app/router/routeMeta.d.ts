import type { FeatureKey } from '@/features/access/types'

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresFeature?: FeatureKey
    requiresPremium?: boolean
    lockedRedirectName?: string
    requiresAuth?: boolean
    guestOnly?: boolean
    hideNavigation?: boolean
    isPublicEntry?: boolean
  }
}
