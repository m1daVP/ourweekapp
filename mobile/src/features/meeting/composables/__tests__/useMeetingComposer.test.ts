import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

const drafts = vi.hoisted(() => ({
  current: null as {
    fields: Record<string, string | string[] | undefined>;
    submittedItemId?: string;
  } | null,
  save: vi.fn(() => ({ ok: true })),
  discard: vi.fn(() => ({ ok: true })),
}));

vi.mock('@/features/meeting/meetingComposerDrafts', () => ({
  loadMeetingComposerDraft: () => drafts.current,
  saveMeetingComposerDraft: (draft: typeof drafts.current) => {
    drafts.current = draft;
    return drafts.save(draft);
  },
  discardMeetingComposerDraft: () => {
    drafts.current = null;
    return drafts.discard();
  },
}));

import { useMeetingComposer } from '../useMeetingComposer';

const scope = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
  meetingId: 'meeting-1',
  sectionId: 'goodThings' as const,
  type: 'note' as const,
};

describe('useMeetingComposer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    drafts.current = null;
    drafts.save.mockClear();
    drafts.discard.mockClear();
    drafts.save.mockReturnValue({ ok: true });
    drafts.discard.mockReturnValue({ ok: true });
  });

  it('loads and debounces local drafts', () => {
    const composer = effectScope().run(() => useMeetingComposer({ scope }))!;

    composer.updateFields({ text: 'A quiet breakfast.' });
    expect(drafts.save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(drafts.save).toHaveBeenCalledWith(
      expect.objectContaining({ fields: { text: 'A quiet breakfast.' } })
    );
    expect(composer.saveState.value).toBe('saved');
  });

  it('retains content and exposes retry state when local storage fails', () => {
    drafts.save.mockReturnValue({ ok: false, reason: 'write_failed' });
    const composer = effectScope().run(() => useMeetingComposer({ scope }))!;

    composer.updateFields({ text: 'Do not lose this.' });
    const result = composer.flush();

    expect(result).toEqual({ ok: false, reason: 'write_failed' });
    expect(composer.fields.value).toEqual({ text: 'Do not lose this.' });
    expect(composer.errorMessage.value).toBe("Couldn't save. Try again.");
  });

  it('clears a draft only after a successful submitted item', async () => {
    const composer = effectScope().run(() => useMeetingComposer({ scope }))!;
    composer.updateFields({ text: 'A saved note.' });

    await expect(
      composer.submit(() => ({ ok: true, itemId: 'note-1' }))
    ).resolves.toEqual({ ok: true, itemId: 'note-1' });

    expect(drafts.discard).toHaveBeenCalledTimes(1);
    expect(composer.fields.value).toEqual({});
  });
});
