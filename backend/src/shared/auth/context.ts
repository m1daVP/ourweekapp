export type PlanType = 'free' | 'premium';
export type UserRole = 'owner' | 'adult_member' | 'viewer';

export type AuthContext = {
  userId: string;
  sessionId: string;
  workspaceId: string;
  role: UserRole;
  planType: PlanType;
};
