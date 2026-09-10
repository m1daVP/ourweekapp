// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createLegacyFeatureAccessMap } from '@/features/access/legacyFeatureAccess';
import MeetingSummaryPage from '../MeetingSummaryPage.vue';
import MeetingDetailsPage from '../MeetingDetailsPage.vue';
import { generateMeetingSummary } from '@/features/meeting/aiSummaryService';
import { ApiClientError } from '@/shared/api/httpClient';
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
  function addConflictingCommitments() {
    const meeting = context.meetings.meetings[0]!;
    const section = meeting.sections[0]!;

    section.tasks = [
      {
        id: 'canonical-task-1',
        sectionId: 'goodThings',
        title: 'Book the dentist appointment',
        responsibilityType: 'shared',
        responsibleParticipantIds: [],
        status: 'open',
        createdAt: '2026-09-04T10:00:00.000Z',
        updatedAt: '2026-09-04T10:00:00.000Z',
      },
    ];
    section.agreements = [
      {
        id: 'canonical-agreement-1',
        sectionId: 'goodThings',
        text: 'We will plan Sunday together after breakfast.',
        participantIds: [],
        createdAt: '2026-09-04T10:00:00.000Z',
      },
    ];
    meeting.aiSummary = {
      ...savedRecap,
      agreements: ['AI rewrite: plan Sunday only if convenient.'],
      tasks: [
        {
          title: 'AI-invented task',
          responsibilityType: 'shared',
          responsibleParticipantIds: [],
          status: 'open',
        },
      ],
    };
  }

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

  it('asks before spending a recap on low-content meeting notes', async () => {
    const meeting = context.meetings.meetings[0]!;
    meeting.aiSummary = undefined;
    meeting.sections = [meeting.sections[0]!];
    render();

    await wrapper
      .get('[data-testid="generate-meeting-recap"]')
      .trigger('click');
    await nextTick();

    expect(document.body.textContent).toContain('Add a little more context?');
    expect(generateMeetingSummary).not.toHaveBeenCalled();

    await (
      document.querySelector(
        '.confirmation-dialog__confirm'
      ) as HTMLButtonElement
    ).click();
    await flushPromises();

    expect(generateMeetingSummary).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'meeting-1' }),
      { allowLowContent: true }
    );
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

  it('shows one safe manual retry after a temporary provider failure', async () => {
    context.meetings.meetings[0]!.aiSummary = undefined;
    vi.mocked(generateMeetingSummary).mockRejectedValueOnce(
      new ApiClientError('raw provider body must stay hidden', {
        status: 503,
        code: 'ai_summary_generation_failed',
        requestId: 'req_mobile_support_123',
      })
    );
    render();

    await wrapper
      .get('[data-testid="generate-meeting-recap"]')
      .trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Recaps are temporarily unavailable'
    );
    expect(wrapper.text()).toContain(
      'Support reference: req_mobile_support_123'
    );
    expect(wrapper.text()).not.toContain('raw provider body must stay hidden');
    expect(context.meetings.meetings[0]!.status).toBe('completed');

    await wrapper.get('[data-testid="retry-meeting-recap"]').trigger('click');
    await flushPromises();

    expect(generateMeetingSummary).toHaveBeenCalledTimes(2);
  });

  it('shows a distinct hourly limit without a retry control', async () => {
    context.meetings.meetings[0]!.aiSummary = undefined;
    vi.mocked(generateMeetingSummary).mockRejectedValueOnce(
      new ApiClientError('rate limit details', {
        status: 429,
        code: 'ai_summary_rate_limited',
        details: {
          userLimit: 5,
          workspaceLimit: 20,
          scope: 'user',
          resetAt: '2026-07-15T15:45:00.000Z',
        },
      })
    );
    render();

    await wrapper
      .get('[data-testid="generate-meeting-recap"]')
      .trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('5');
    expect(wrapper.find('[data-testid="retry-meeting-recap"]').exists()).toBe(
      false
    );
    expect(
      wrapper.find('[data-testid="generate-meeting-recap"]').exists()
    ).toBe(false);
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

  if (name === 'summary') {
    it('keeps recorded commitments authoritative over divergent AI output', () => {
      addConflictingCommitments();
      render();

      expect(wrapper.text()).toContain('Book the dentist appointment');
      expect(wrapper.text()).toContain(
        'We will plan Sunday together after breakfast.'
      );
      expect(wrapper.text()).toContain(savedRecap.shortSummary);
      expect(wrapper.text()).not.toContain('AI-invented task');
      expect(wrapper.text()).not.toContain(
        'AI rewrite: plan Sunday only if convenient.'
      );
    });
  }
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

it('shares recorded commitments instead of divergent AI task and agreement output', async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: share,
  });
  const meeting = context.meetings.meetings[0]!;
  const section = meeting.sections[0]!;
  section.tasks = [
    {
      id: 'canonical-task-1',
      sectionId: 'goodThings',
      title: 'Book the dentist appointment',
      responsibilityType: 'shared',
      responsibleParticipantIds: [],
      status: 'open',
      createdAt: '2026-09-04T10:00:00.000Z',
      updatedAt: '2026-09-04T10:00:00.000Z',
    },
  ];
  section.agreements = [
    {
      id: 'canonical-agreement-1',
      sectionId: 'goodThings',
      text: 'We will plan Sunday together after breakfast.',
      participantIds: [],
      createdAt: '2026-09-04T10:00:00.000Z',
    },
  ];
  meeting.aiSummary = {
    ...savedRecap,
    agreements: ['AI rewrite: plan Sunday only if convenient.'],
    tasks: [
      {
        title: 'AI-invented task',
        responsibilityType: 'shared',
        responsibleParticipantIds: [],
        status: 'open',
      },
    ],
  };
  wrapper = mount(MeetingSummaryPage, {
    global: {
      plugins: [context.pinia, context.i18n],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  });

  await wrapper.get('[data-testid="share-meeting-summary"]').trigger('click');
  await flushPromises();

  const text = share.mock.calls[0]?.[0].text as string;
  expect(text).toContain('Book the dentist appointment');
  expect(text).toContain('We will plan Sunday together after breakfast.');
  expect(text).toContain(savedRecap.shortSummary);
  expect(text).not.toContain('AI-invented task');
  expect(text).not.toContain('AI rewrite: plan Sunday only if convenient.');
});
