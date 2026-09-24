import { computed, onBeforeUnmount, ref } from 'vue';
import {
  discardMeetingComposerDraft,
  loadMeetingComposerDraft,
  saveMeetingComposerDraft,
  type MeetingComposerDraftFields,
  type MeetingComposerDraftScope,
} from '@/features/meeting/meetingComposerDrafts';

export type MeetingComposerSaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface MeetingComposerSubmitSuccess {
  ok: true;
  itemId: string;
}

export interface MeetingComposerSubmitFailure {
  ok: false;
  message: string;
}

export type MeetingComposerSubmitResult =
  MeetingComposerSubmitSuccess | MeetingComposerSubmitFailure;

export interface UseMeetingComposerOptions {
  scope: MeetingComposerDraftScope;
  initialFields?: MeetingComposerDraftFields;
  debounceMs?: number;
}

function cloneFields(fields: MeetingComposerDraftFields) {
  return { ...fields };
}

export function useMeetingComposer({
  scope,
  initialFields = {},
  debounceMs = 300,
}: UseMeetingComposerOptions) {
  const fields = ref<MeetingComposerDraftFields>(cloneFields(initialFields));
  const saveState = ref<MeetingComposerSaveState>('idle');
  const errorMessage = ref('');
  const submittedItemId = ref<string | null>(null);
  const isSubmitting = ref(false);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const hasDraftContent = computed(() =>
    Object.values(fields.value).some(
      (value) =>
        (typeof value === 'string' && value.trim().length > 0) ||
        (Array.isArray(value) && value.length > 0)
    )
  );

  function clearScheduledSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  function load() {
    const draft = loadMeetingComposerDraft(scope);
    fields.value = cloneFields(draft?.fields ?? initialFields);
    submittedItemId.value = draft?.submittedItemId ?? null;
    errorMessage.value = '';
    saveState.value = 'idle';
    return draft;
  }

  function updateFields(nextFields: MeetingComposerDraftFields) {
    fields.value = cloneFields(nextFields);
    errorMessage.value = '';
    submittedItemId.value = null;
    scheduleSave();
  }

  function flush() {
    clearScheduledSave();

    if (!hasDraftContent.value) {
      return { ok: true } as const;
    }

    saveState.value = 'saving';
    const result = saveMeetingComposerDraft({
      version: 1,
      ...scope,
      fields: cloneFields(fields.value),
      ...(submittedItemId.value
        ? { submittedItemId: submittedItemId.value }
        : {}),
      updatedAt: new Date().toISOString(),
    });

    if (result.ok) {
      saveState.value = 'saved';
      return result;
    }

    saveState.value = 'error';
    errorMessage.value = "Couldn't save. Try again.";
    return result;
  }

  function scheduleSave() {
    clearScheduledSave();

    if (!hasDraftContent.value) {
      return;
    }

    saveTimer = setTimeout(() => {
      saveTimer = null;
      flush();
    }, debounceMs);
  }

  function discard() {
    clearScheduledSave();
    const result = discardMeetingComposerDraft(scope);

    if (result.ok) {
      fields.value = cloneFields(initialFields);
      submittedItemId.value = null;
      errorMessage.value = '';
      saveState.value = 'idle';
    } else {
      saveState.value = 'error';
      errorMessage.value = "Couldn't save. Try again.";
    }

    return result;
  }

  async function submit(
    submitItem: (
      fields: MeetingComposerDraftFields
    ) => MeetingComposerSubmitResult | Promise<MeetingComposerSubmitResult>
  ): Promise<MeetingComposerSubmitResult | null> {
    if (isSubmitting.value) {
      return null;
    }

    isSubmitting.value = true;
    errorMessage.value = '';
    const draftWrite = flush();

    if (!draftWrite.ok) {
      isSubmitting.value = false;
      return { ok: false, message: errorMessage.value };
    }

    const result = await submitItem(cloneFields(fields.value));

    if (!result.ok) {
      errorMessage.value = result.message;
      isSubmitting.value = false;
      return result;
    }

    submittedItemId.value = result.itemId;
    const cleanup = discardMeetingComposerDraft(scope);

    if (!cleanup.ok) {
      const retained = flush();
      isSubmitting.value = false;
      return retained.ok
        ? { ok: true, itemId: result.itemId }
        : { ok: false, message: errorMessage.value };
    }

    fields.value = cloneFields(initialFields);
    saveState.value = 'idle';
    isSubmitting.value = false;
    return result;
  }

  onBeforeUnmount(() => {
    flush();
  });

  return {
    discard,
    errorMessage,
    fields,
    flush,
    hasDraftContent,
    isSubmitting,
    load,
    saveState,
    scheduleSave,
    submit,
    submittedItemId,
    updateFields,
  };
}
