// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { useMeetingSession } from '../useMeetingSession';
import { setupRecapTest } from '../../__tests__/recapFixtures';

const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const haptics = vi.hoisted(() => ({
  completeMeeting: vi.fn(),
}));
const draftCleanup = vi.hoisted(() => ({
  discardForMeeting: vi.fn(
    (): { ok: true } | { ok: false; reason: 'write_failed' } => ({ ok: true })
  ),
}));

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('@/shared/services/hapticsService', () => ({ haptics }));
vi.mock('@/features/meeting/meetingComposerDrafts', () => ({
  discardMeetingComposerDraftsForMeeting: draftCleanup.discardForMeeting,
}));

let wrapper: VueWrapper;

beforeEach(() => {
  draftCleanup.discardForMeeting.mockReturnValue({ ok: true });
});

afterEach(() => {
  wrapper?.unmount();
  vi.clearAllMocks();
});

describe('meeting completion draft cleanup', () => {
  it('silently removes temporary drafts before completing the meeting', async () => {
    const context = setupRecapTest(false);
    context.meetings.meetings[0]!.status = 'in_progress';
    context.meetings.activeMeetingId = 'meeting-1';
    let session!: ReturnType<typeof useMeetingSession>;

    wrapper = mount(
      defineComponent({
        setup() {
          session = useMeetingSession();
          return {};
        },
        template: '<div />',
      }),
      { global: { plugins: [context.pinia, context.i18n] } }
    );

    await session.finishMeeting();

    expect(draftCleanup.discardForMeeting).toHaveBeenCalledWith(
      'local-owner',
      context.workspace.workspace.id,
      'meeting-1'
    );
    expect(context.meetings.meetings[0]!.status).toBe('completed');
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'meeting-summary' })
    );
  });

  it('keeps the meeting active when temporary draft cleanup fails', async () => {
    const context = setupRecapTest(false);
    context.meetings.meetings[0]!.status = 'in_progress';
    context.meetings.activeMeetingId = 'meeting-1';
    draftCleanup.discardForMeeting.mockReturnValue({
      ok: false,
      reason: 'write_failed',
    });
    let session!: ReturnType<typeof useMeetingSession>;

    wrapper = mount(
      defineComponent({
        setup() {
          session = useMeetingSession();
          return {};
        },
        template: '<div />',
      }),
      { global: { plugins: [context.pinia, context.i18n] } }
    );

    await session.finishMeeting();

    expect(context.meetings.meetings[0]!.status).toBe('in_progress');
    expect(push).not.toHaveBeenCalled();
    expect(session.formError.value).toBe(
      context.i18n.global.t('meeting.presentation.saveFailed')
    );
  });
});
