// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import AiRecapRecoveryPanel from '../AiRecapRecoveryPanel.vue';
import { i18n } from '@/features/localization/i18n';
import type { AiRecapRecovery } from '../../aiSummaryService';

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  i18n.global.locale.value = 'en';
});

function render(recovery: AiRecapRecovery) {
  wrapper = mount(AiRecapRecoveryPanel, {
    props: { recovery },
    global: { plugins: [i18n] },
  });

  return wrapper;
}

describe('AiRecapRecoveryPanel', () => {
  it('shows a safe support reference and emits only after an explicit retry', async () => {
    const panel = render({
      kind: 'providerUnavailable',
      messageKey: 'ai.recap.recovery.providerUnavailable',
      messageParams: {},
      retryable: true,
      requestId: 'req_mobile_support_123',
    });

    expect(panel.get('[role="alert"]').text()).toContain(
      'Recaps are temporarily unavailable'
    );
    expect(panel.text()).toContain('Support reference: req_mobile_support_123');
    await panel.get('[data-testid="retry-meeting-recap"]').trigger('click');
    expect(panel.emitted('retry')).toHaveLength(1);
  });

  it('does not offer retry for an exhausted allowance', () => {
    const panel = render({
      kind: 'allowanceExhausted',
      messageKey: 'ai.recap.recovery.allowanceExhausted',
      messageParams: {},
      retryable: false,
    });

    expect(panel.get('[role="alert"]').text()).toContain(
      'No recaps are available right now'
    );
    expect(panel.find('[data-testid="retry-meeting-recap"]').exists()).toBe(
      false
    );
  });

  it.each([
    ['uk', 'Відновіть підключення до інтернету'],
    ['es', 'Vuelve a conectarte a internet'],
  ] as const)('localizes recovery copy in %s', (locale, expectedMessage) => {
    i18n.global.locale.value = locale;
    const panel = render({
      kind: 'offline',
      messageKey: 'ai.recap.recovery.offline',
      messageParams: {},
      retryable: true,
    });

    expect(panel.get('[role="alert"]').text()).toContain(expectedMessage);
    expect(panel.get('[data-testid="retry-meeting-recap"]').text()).not.toBe(
      'Retry recap'
    );
  });
});
