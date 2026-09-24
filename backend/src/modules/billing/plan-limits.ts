import type { PlanType, UserRole } from '../../shared/auth/index.js';

export const FREE_RECAP_LIMIT = 3;
export const PREMIUM_RECAP_LIMIT = 20;
export const FREE_HOUSEHOLD_MEMBER_LIMIT = 4;
export const PREMIUM_HOUSEHOLD_MEMBER_LIMIT = 8;

export function recapLimitForPlan(planType: PlanType) {
  return planType === 'premium' ? PREMIUM_RECAP_LIMIT : FREE_RECAP_LIMIT;
}

export function householdMemberLimitForPlan(planType: PlanType) {
  return planType === 'premium'
    ? PREMIUM_HOUSEHOLD_MEMBER_LIMIT
    : FREE_HOUSEHOLD_MEMBER_LIMIT;
}

export function recapAllowanceForPlan(input: {
  planType: PlanType;
  expiresAt: string | null;
  used: number;
  role: UserRole;
}) {
  const limit = recapLimitForPlan(input.planType);
  const used = Math.max(0, input.used);
  const remaining = Math.max(0, limit - used);

  return {
    limit,
    used,
    remaining,
    periodEndsAt: input.planType === 'premium' ? input.expiresAt : null,
    canGenerate: input.role !== 'viewer' && remaining > 0,
  };
}
