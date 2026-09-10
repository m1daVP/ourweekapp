// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { useMeetingSession } from '../useMeetingSession';
import { generateMeetingSummary } from '@/features/meeting/aiSummaryService';
import { allowance, setupRecapTest } from '../../__tests__/recapFixtures';

const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const haptics = vi.hoisted(() => ({
  completeMeeting: vi.fn(),
}));
const recapDisclosure = vi.hoisted(() => ({
  acknowledge: vi.fn(),
  hasAcknowledged: vi.fn(() => false),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('@/shared/services/hapticsService', () => ({ haptics }));
vi.mock('@/features/meeting/aiRecapDisclosure', () => ({
  acknowledgeAiRecapDisclosure: recapDisclosure.acknowledge,
  hasAcknowledgedAiRecapDisclosure: recapDisclosure.hasAcknowledged,
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
  it('preserves meeting completion and skips AI when the disclosure is deferred', async () => {
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
    expect(session.isAiRecapDisclosureOpen.value).toBe(true);
    await session.deferAiRecapDisclosure();

    expect(context.meetings.meetings[0]!.status).toBe('completed');
    expect(generateMeetingSummary).not.toHaveBeenCalled();
    expect(recapDisclosure.acknowledge).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'meeting-summary' })
    );
  });

  it('shows low-content guidance before privacy disclosure and preserves dismissal', async () => {
    const context = setupRecapTest(false);
    context.meetings.meetings[0]!.status = 'in_progress';
    context.meetings.meetings[0]!.sections = [
      context.meetings.meetings[0]!.sections[0]!,
    ];
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

    expect(session.isAiRecapLowContentOpen.value).toBe(true);
    expect(session.isAiRecapDisclosureOpen.value).toBe(false);
    expect(generateMeetingSummary).not.toHaveBeenCalled();

    await session.deferAiRecapLowContent();

    expect(context.meetings.meetings[0]!.status).toBe('completed');
    expect(generateMeetingSummary).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'meeting-summary' })
    );
  });

  it('requires privacy acknowledgement before a confirmed low-content recap', async () => {
    const context = setupRecapTest(false);
    context.meetings.meetings[0]!.status = 'in_progress';
    context.meetings.meetings[0]!.sections = [
      context.meetings.meetings[0]!.sections[0]!,
    ];
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
    await session.confirmAiRecapLowContent();

    expect(session.isAiRecapLowContentOpen.value).toBe(false);
    expect(session.isAiRecapDisclosureOpen.value).toBe(true);
    expect(generateMeetingSummary).not.toHaveBeenCalled();

    await session.confirmAiRecapDisclosure();

    expect(generateMeetingSummary).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'meeting-1' }),
      { allowLowContent: true }
    );
  });

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
      if (state === 'eligible' || state === 'offline') {
        expect(session.isAiRecapDisclosureOpen.value).toBe(true);
        expect(generateMeetingSummary).not.toHaveBeenCalled();
        await session.confirmAiRecapDisclosure();
        expect(recapDisclosure.acknowledge).toHaveBeenCalledOnce();
      }
      expect(context.meetings.meetings[0]!.status).toBe(
        state === 'viewer' ? 'in_progress' : 'completed'
      );
      expect(generateMeetingSummary).toHaveBeenCalledTimes(
        state === 'eligible' || state === 'offline' ? 1 : 0
      );
      expect(haptics.completeMeeting).toHaveBeenCalledTimes(
        state === 'viewer' ? 0 : 1
      );
      if (state !== 'viewer')
        expect(push).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'meeting-summary' })
        );
      else expect(push).not.toHaveBeenCalled();
    }
  );
});
