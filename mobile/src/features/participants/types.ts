export type ParticipantType = 'adult' | 'child' | 'other';

export interface Participant {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  type: ParticipantType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  serverRevision?: number;
  deletedAt?: string;
}
