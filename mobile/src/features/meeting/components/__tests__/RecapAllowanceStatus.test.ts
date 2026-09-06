// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import RecapAllowanceStatus from '../RecapAllowanceStatus.vue';
import { allowance, setupRecapTest } from '../../__tests__/recapFixtures';

let context: ReturnType<typeof setupRecapTest>;
let wrapper: VueWrapper;
beforeEach(() => {
  context = setupRecapTest();
});
afterEach(() => {
  wrapper?.unmount();
  vi.restoreAllMocks();
});
function render() {
  wrapper = mount(RecapAllowanceStatus, {
    global: { plugins: [context.pinia, context.i18n] },
  });
}
describe('recap availability recovery', () => {
  it('shows a real Free allowance', () => {
    render();
    expect(wrapper.text()).toContain('Free recaps remaining: 3');
    expect(wrapper.find('button').exists()).toBe(false);
  });
  it('distinguishes missing data from zero credits and refreshes only status', async () => {
    context.subscription.assistantRecap = null;
    const refresh = vi
      .spyOn(context.subscription, 'refreshCurrentPlan')
      .mockImplementationOnce(async () => {
        context.subscription.assistantRecap = allowance(2);
      });
    render();
    expect(wrapper.text()).toContain('could not be confirmed');
    expect(wrapper.text()).not.toContain('No free recaps');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(refresh).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('Free recaps remaining: 2');
  });
  it('disables refresh while checking', () => {
    context.subscription.isLoading = true;
    render();
    expect(wrapper.text()).toContain('Checking recap availability');
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
  });
  it('shows known exhausted Free allowance and a refresh action', () => {
    context.subscription.assistantRecap = allowance(0);
    render();
    expect(wrapper.text()).toContain('No free recaps remain.');
    expect(wrapper.find('button').exists()).toBe(true);
  });
  it.each([true, false])(
    'never asks viewers to upgrade, even if cached allowance says %s',
    (canGenerate) => {
      context.workspace.workspace.members[0]!.role = 'viewer';
      context.subscription.assistantRecap = allowance(3, canGenerate);
      render();
      expect(wrapper.text()).toContain('Your household role cannot generate');
      expect(wrapper.find('button').exists()).toBe(false);
      expect(wrapper.find('a').exists()).toBe(false);
    }
  );
  it('explains backend role restriction with credits remaining', () => {
    context.subscription.assistantRecap = allowance(3, false);
    render();
    expect(wrapper.text()).toContain('Your household role cannot generate');
  });
  it.each([0, 2])(
    'shows Premium allowance and renewal information with %s left',
    (remaining) => {
      context.subscription.assistantRecap = {
        ...allowance(remaining),
        periodEndsAt: '2026-10-04T10:00:00.000Z',
      };
      render();
      expect(wrapper.text()).toContain('October');
      expect(wrapper.text()).toContain(
        remaining ? 'Recaps available: 2' : 'No recaps remain for this period.'
      );
    }
  );
  it.each([
    ['uk', 'Доступно підсумків', 'Підсумків на цей період більше немає'],
    ['es', 'Resúmenes disponibles', 'No quedan resúmenes para este período'],
  ] as const)(
    'localizes Premium remaining-credit and renewal copy in %s',
    async (locale, remainingText, exhaustedText) => {
      context.i18n.global.locale.value = locale;
      context.subscription.assistantRecap = {
        ...allowance(2),
        periodEndsAt: '2026-10-04T10:00:00.000Z',
      };
      render();
      expect(wrapper.text()).toContain(remainingText);

      context.subscription.assistantRecap = {
        ...allowance(0),
        periodEndsAt: '2026-10-04T10:00:00.000Z',
      };
      await nextTick();
      expect(wrapper.text()).toContain(exhaustedText);
    }
  );
  it('does not throw or invent a Free period for an invalid renewal date', () => {
    context.subscription.assistantRecap = {
      ...allowance(2),
      periodEndsAt: 'bad-date',
    };
    render();
    expect(wrapper.text()).toContain('Recaps available: 2 of 3.');
  });
  it.each(['uk', 'es'] as const)('localizes recovery in %s', (locale) => {
    context.i18n.global.locale.value = locale;
    context.subscription.assistantRecap = null;
    render();
    expect(wrapper.text()).not.toContain('ai.recap');
    expect(wrapper.text()).not.toContain('could not be confirmed');
    expect(wrapper.get('button').text()).toBe(
      locale === 'uk' ? 'Оновити доступність' : 'Actualizar disponibilidad'
    );
  });
});
