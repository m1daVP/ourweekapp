// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { useMeetingSession } from '../useMeetingSession';
import { setupRecapTest } from '../../__tests__/recapFixtures';

const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const haptics = vi.hoisted(() => ({
  completeMeeting: vi.fn(),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('@/shared/services/hapticsService', () => ({ haptics }));
let wrapper: VueWrapper;
afterEach(() => {
  wrapper?.unmount();
  vi.clearAllMocks();
});

describe('meeting recap completion', () => {
  it('opens the recorded recap immediately without starting optional AI work', async () => {
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

    expect(context.meetings.meetings[0]!.status).toBe('completed');
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'meeting-summary' })
    );
  });

  it('finishes an empty meeting and opens the recorded recap', async () => {
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

    expect(context.meetings.meetings[0]!.status).toBe('completed');
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'meeting-summary' })
    );
  });
});
