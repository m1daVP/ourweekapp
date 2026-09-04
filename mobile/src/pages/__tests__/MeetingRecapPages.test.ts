// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createLegacyFeatureAccessMap } from '@/features/access/legacyFeatureAccess';
import MeetingSummaryPage from '../MeetingSummaryPage.vue';
import MeetingDetailsPage from '../MeetingDetailsPage.vue';
import { generateMeetingSummary } from '@/features/meeting/aiSummaryService';
import {
  allowance,
  savedRecap,
  setupRecapTest,
} from '@/features/meeting/__tests__/recapFixtures';

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { meetingId: 'meeting-1' }, query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('@/features/meeting/aiSummaryService', async (original) => ({
  ...(await original<typeof import('@/features/meeting/aiSummaryService')>()),
  generateMeetingSummary: vi.fn(),
}));
let context: ReturnType<typeof setupRecapTest>;
let wrapper: VueWrapper;
beforeEach(() => {
  vi.clearAllMocks();
  context = setupRecapTest();
});
afterEach(() => {
  wrapper?.unmount();
  vi.restoreAllMocks();
});

describe.each([
  ['summary', MeetingSummaryPage],
  ['details', MeetingDetailsPage],
] as const)('%s recap page', (name, page) => {
  function render() {
    wrapper = mount(page, {
      global: {
        plugins: [context.pinia, context.i18n],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    return wrapper;
  }

  it.each(['unknown', 'exhausted'] as const)(
    'never uses a Premium feature flag when allowance is %s',
    (state) => {
      context.meetings.meetings[0]!.aiSummary = undefined;
      context.subscription.currentPlan = 'premium';
      context.subscription.featureAccess = createLegacyFeatureAccessMap({
        planType: 'premium',
      });
      context.subscription.assistantRecap =
        state === 'unknown' ? null : allowance(0);
      render();
      expect(context.subscription.getFeatureAccess('aiSummary').state).toBe(
        'available'
      );
      expect(
        wrapper.find('[data-testid="generate-meeting-recap"]').exists()
      ).toBe(false);
    }
  );

  it.each(['exhausted', 'expired', 'unknown'] as const)(
    'keeps saved recaps readable when %s',
    (state) => {
      context.subscription.assistantRecap =
        state === 'unknown' ? null : allowance(0);
      context.subscription.currentPlan = 'free'; // expired Premium resolves to Free
      render();
      expect(wrapper.text()).toContain(savedRecap.shortSummary);
      expect(
        wrapper.find('[data-testid="generate-meeting-recap"]').exists()
      ).toBe(false);
      if (name === 'details') {
        expect(
          wrapper.get('.ai-summary-panel').element.closest('[inert]')
        ).toBeNull();
        expect(wrapper.find('.premium-lock').exists()).toBe(true); // export stays gated
        expect(context.subscription.getFeatureAccess('export').state).not.toBe(
          'available'
        );
      }
    }
  );

  it('allows eligible Free users to generate without opening a paywall', async () => {
    context.meetings.meetings[0]!.aiSummary = undefined;
    render();
    const button = wrapper.get('[data-testid="generate-meeting-recap"]');
    expect(button.element.closest('[inert]')).toBeNull();
    await button.trigger('click');
    await flushPromises();
    expect(generateMeetingSummary).toHaveBeenCalledOnce();
  });

  it.each(['unknown', 'exhausted', 'viewer', 'checking'] as const)(
    'does not offer generation when %s',
    (state) => {
      context.meetings.meetings[0]!.aiSummary = undefined;
      context.subscription.assistantRecap =
        state === 'unknown'
          ? null
          : allowance(
              state === 'exhausted' ? 0 : 3,
              state !== 'viewer' && state !== 'exhausted'
            );
      if (state === 'viewer')
        context.workspace.workspace.members[0]!.role = 'viewer';
      if (state === 'checking') context.subscription.isLoading = true;
      render();
      expect(
        wrapper.find('[data-testid="generate-meeting-recap"]').exists()
      ).toBe(false);
      expect(generateMeetingSummary).not.toHaveBeenCalled();
    }
  );

  it('keeps the final-credit result visible after allowance refresh', async () => {
    context.meetings.meetings[0]!.aiSummary = undefined;
    context.subscription.assistantRecap = allowance(1);
    vi.mocked(generateMeetingSummary).mockImplementationOnce(async () => {
      context.meetings.meetings[0]!.aiSummary = { ...savedRecap };
      context.subscription.assistantRecap = allowance(0);
      return savedRecap;
    });
    render();
    await wrapper
      .get('[data-testid="generate-meeting-recap"]')
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain(savedRecap.shortSummary);
    expect(
      wrapper.find('[data-testid="generate-meeting-recap"]').exists()
    ).toBe(false);
    if (name === 'details')
      expect(
        wrapper.get('.ai-summary-panel').element.closest('[inert]')
      ).toBeNull();
  });

  it('does not expose content or generate for a missing meeting', async () => {
    context.meetings.meetings = [];
    render();
    await nextTick();
    expect(wrapper.text()).not.toContain(savedRecap.shortSummary);
    expect(
      wrapper.find('[data-testid="generate-meeting-recap"]').exists()
    ).toBe(false);
    expect(wrapper.find('[data-testid="share-meeting-summary"]').exists()).toBe(
      false
    );
  });
});

it('keeps a saved insight in ordinary share text after allowance exhaustion', async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: share,
  });
  context.subscription.assistantRecap = allowance(0);
  wrapper = mount(MeetingSummaryPage, {
    global: {
      plugins: [context.pinia, context.i18n],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  });
  await wrapper.get('[data-testid="share-meeting-summary"]').trigger('click');
  await flushPromises();
  expect(share).toHaveBeenCalledWith(
    expect.objectContaining({
      text: expect.stringContaining(savedRecap.shortSummary),
    })
  );
});
