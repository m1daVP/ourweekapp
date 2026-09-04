// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { useMeetingSession } from '../useMeetingSession';
import { generateMeetingSummary } from '@/features/meeting/aiSummaryService';
import { allowance, setupRecapTest } from '../../__tests__/recapFixtures';

const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('@/features/meeting/aiSummaryService', async (original) => ({
  ...(await original<typeof import('@/features/meeting/aiSummaryService')>()),
  generateMeetingSummary: vi.fn(),
}));
let wrapper: VueWrapper;
afterEach(() => {
  wrapper?.unmount();
  vi.clearAllMocks();
});

describe('completion recap allowance', () => {
  it.each(['eligible', 'unknown', 'exhausted', 'offline', 'viewer'] as const)(
    'preserves completion policy for %s',
    async (state) => {
      const context = setupRecapTest(false);
      context.meetings.meetings[0]!.status = 'in_progress';
      context.meetings.activeMeetingId = 'meeting-1';
      context.subscription.assistantRecap =
        state === 'unknown' ? null : allowance(state === 'exhausted' ? 0 : 3);
      if (state === 'viewer') {
        context.workspace.workspace.members[0]!.role = 'viewer';
        context.subscription.assistantRecap = allowance(3, false);
      }
      if (state === 'offline')
        vi.mocked(generateMeetingSummary).mockRejectedValueOnce(
          new Error('sync offline')
        );
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
      expect(context.meetings.meetings[0]!.status).toBe(
        state === 'viewer' ? 'in_progress' : 'completed'
      );
      expect(generateMeetingSummary).toHaveBeenCalledTimes(
        state === 'eligible' || state === 'offline' ? 1 : 0
      );
      if (state !== 'viewer')
        expect(push).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'meeting-summary' })
        );
      else expect(push).not.toHaveBeenCalled();
    }
  );
});
