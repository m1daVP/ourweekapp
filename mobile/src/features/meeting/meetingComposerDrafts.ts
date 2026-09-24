import type { MeetingSectionId } from './types';
import {
  readStorageSlice,
  writeStorageSlice,
} from '@/shared/services/storageService';

export type MeetingComposerDraftType = 'note' | 'task' | 'agreement';

export type MeetingComposerDraftFields = Record<
  string,
  string | string[] | undefined
>;

export interface MeetingComposerDraft {
  version: 1;
  userId: string;
  workspaceId: string;
  meetingId: string;
  sectionId: MeetingSectionId;
  type: MeetingComposerDraftType;
  itemId?: string;
  fields: MeetingComposerDraftFields;
  submittedItemId?: string;
  updatedAt: string;
}

export interface MeetingComposerDraftScope {
  userId: string;
  workspaceId: string;
  meetingId: string;
  sectionId: MeetingSectionId;
  type: MeetingComposerDraftType;
  itemId?: string;
}

const draftStorageKey = 'meetingComposerDrafts';

function readDrafts() {
  const value = readStorageSlice<unknown>(draftStorageKey, []);
  return Array.isArray(value) ? (value as MeetingComposerDraft[]) : [];
}

function matchesScope(
  draft: MeetingComposerDraft,
  scope: MeetingComposerDraftScope
) {
  return (
    draft.userId === scope.userId &&
    draft.workspaceId === scope.workspaceId &&
    draft.meetingId === scope.meetingId &&
    draft.sectionId === scope.sectionId &&
    draft.type === scope.type &&
    draft.itemId === scope.itemId
  );
}

export function loadMeetingComposerDraft(scope: MeetingComposerDraftScope) {
  return readDrafts().find((draft) => matchesScope(draft, scope)) ?? null;
}

export function getMeetingComposerDraftsForMeeting(
  userId: string,
  workspaceId: string,
  meetingId: string
) {
  return readDrafts()
    .filter(
      (draft) =>
        draft.userId === userId &&
        draft.workspaceId === workspaceId &&
        draft.meetingId === meetingId &&
        !draft.submittedItemId
    )
    .sort((first, second) => first.updatedAt.localeCompare(second.updatedAt));
}

export function saveMeetingComposerDraft(draft: MeetingComposerDraft) {
  const drafts = readDrafts();
  const nextDrafts = drafts.filter((item) => !matchesScope(item, draft));
  return writeStorageSlice(draftStorageKey, [...nextDrafts, draft]);
}

export function discardMeetingComposerDraft(scope: MeetingComposerDraftScope) {
  return writeStorageSlice(
    draftStorageKey,
    readDrafts().filter((draft) => !matchesScope(draft, scope))
  );
}

export function discardMeetingComposerDraftsForMeeting(
  userId: string,
  workspaceId: string,
  meetingId: string
) {
  const drafts = readDrafts();
  const hasMatchingDraft = drafts.some(
    (draft) =>
      draft.userId === userId &&
      draft.workspaceId === workspaceId &&
      draft.meetingId === meetingId &&
      !draft.submittedItemId
  );

  if (!hasMatchingDraft) return { ok: true } as const;

  return writeStorageSlice(
    draftStorageKey,
    drafts.filter(
      (draft) =>
        draft.userId !== userId ||
        draft.workspaceId !== workspaceId ||
        draft.meetingId !== meetingId ||
        Boolean(draft.submittedItemId)
    )
  );
}

export function clearMeetingComposerDraftsForUser(userId: string) {
  return writeStorageSlice(
    draftStorageKey,
    readDrafts().filter((draft) => draft.userId !== userId)
  );
}
