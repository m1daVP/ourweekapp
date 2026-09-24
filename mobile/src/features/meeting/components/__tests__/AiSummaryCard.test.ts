// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import AiSummaryCard from '../AiSummaryCard.vue';
import { meetingFixture, setupRecapTest } from '../../__tests__/recapFixtures';

let context: ReturnType<typeof setupRecapTest>;
let wrapper: VueWrapper;

beforeEach(() => {
  context = setupRecapTest(false);
});

afterEach(() => {
  wrapper?.unmount();
});

const baseProps = {
  meeting: meetingFixture(false),
  state: 'empty' as const,
  canGenerate: true,
  canRegenerate: false,
  generating: false,
  recovery: null,
  errorMessage: 'The recap failed.',
  emptyMessage: 'No recap yet.',
  loadingMessage: 'Preparing the recap...',
  title: 'AI summary',
  disclaimer: 'Review before relying on it.',
  generateLabel: 'Generate',
};

function render(
  props: Partial<typeof baseProps> = {},
  slots: Record<string, string> = {}
) {
  wrapper = mount(AiSummaryCard, {
    props: { ...baseProps, ...props },
    slots,
    global: {
      plugins: [context.pinia, context.i18n],
      stubs: {
        RecapAllowanceStatus: {
          props: ['showAction', 'canGenerate', 'generating', 'generateLabel'],
          emits: ['generate', 'upgrade'],
          template:
            '<div class="allowance-stub"><button v-if="showAction && canGenerate" data-testid="recap-allowance-generate" class="ai-summary-card__action" type="button" :disabled="generating" @click="$emit(\'generate\')">{{ generateLabel }}</button><button data-testid="recap-allowance-upgrade" type="button" @click="$emit(\'upgrade\')">Upgrade</button></div>',
        },
        MeetingFollowThrough: {
          emits: ['regenerate'],
          template:
            '<button data-testid="regenerate-meeting-recap" type="button" @click="$emit(\'regenerate\')">Regenerate</button>',
        },
      },
    },
  });

  return wrapper;
}

describe('AiSummaryCard', () => {
  it('renders the shared header, allowance strip, and full-width generate action', () => {
    const card = render();

    expect(card.find('.ai-summary-card').exists()).toBe(true);
    expect(card.find('.ai-summary-card__icon').exists()).toBe(true);
    expect(card.text()).toContain('AI summary');
    expect(card.text()).toContain('No recap yet.');
    expect(card.find('.ai-summary-card__allowance').exists()).toBe(true);
    expect(
      card.get('[data-testid="recap-allowance-generate"]').text()
    ).toContain('Generate');
    expect(
      card.get('[data-testid="recap-allowance-generate"]').classes()
    ).toContain('ai-summary-card__action');
  });

  it.each(['loading', 'error'] as const)(
    'renders the %s state in the shared shell',
    (state) => {
      const card = render({ state, canGenerate: false });

      expect(card.find('.ai-summary-card').exists()).toBe(true);
      expect(
        card.find('[data-testid="recap-allowance-generate"]').exists()
      ).toBe(false);
    }
  );

  it('emits generate, upgrade, and regenerate actions', async () => {
    const card = render();

    await card.get('[data-testid="recap-allowance-generate"]').trigger('click');
    expect(card.emitted('generate')).toHaveLength(1);

    await card.get('[data-testid="recap-allowance-upgrade"]').trigger('click');
    expect(card.emitted('upgrade')).toHaveLength(1);

    await card.setProps({
      meeting: meetingFixture(),
      state: 'available',
      canGenerate: false,
      canRegenerate: true,
    });
    await card.get('[data-testid="regenerate-meeting-recap"]').trigger('click');
    expect(card.emitted('regenerate')).toHaveLength(1);
  });

  it('renders a retryable recovery and emits retry explicitly', async () => {
    const card = render({
      state: 'error',
      canGenerate: false,
      recovery: {
        kind: 'providerUnavailable',
        messageKey: 'ai.recap.recovery.providerUnavailable',
        messageParams: {},
        retryable: true,
        requestId: 'req_mobile_support_123',
      },
    });

    expect(card.get('[role="alert"]').text()).toContain(
      'Recaps are temporarily unavailable'
    );
    await card.get('[data-testid="retry-meeting-recap"]').trigger('click');
    expect(card.emitted('retry')).toHaveLength(1);
  });

  it('keeps non-retryable recovery safe and renders legacy slot content', () => {
    const card = render(
      {
        meeting: meetingFixture(),
        state: 'available',
        canGenerate: false,
        recovery: {
          kind: 'allowanceExhausted',
          messageKey: 'ai.recap.recovery.allowanceExhausted',
          messageParams: {},
          retryable: false,
        },
      },
      { legacy: 'Legacy summary details' }
    );

    expect(card.text()).toContain('Legacy summary details');
    expect(card.find('[data-testid="retry-meeting-recap"]').exists()).toBe(
      false
    );
  });
});
