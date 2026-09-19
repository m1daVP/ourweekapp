// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
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

function render(
  props: Partial<{
    showAction: boolean;
    canGenerate: boolean;
    generating: boolean;
    generateLabel: string;
  }> = {}
) {
  wrapper = mount(RecapAllowanceStatus, {
    props: {
      showAction: true,
      canGenerate: true,
      generating: false,
      generateLabel: 'Generate',
      ...props,
    },
    global: { plugins: [context.pinia, context.i18n] },
  });

  return wrapper;
}

function premiumAllowance(remaining: number) {
  return {
    limit: 20,
    used: 20 - remaining,
    remaining,
    canGenerate: remaining > 0,
    periodEndsAt: '2026-10-04T10:00:00.000Z',
  };
}

describe('RecapAllowanceStatus', () => {
  it.each([3, 2])(
    'shows the dynamic Free counter with %s credits left',
    (remaining) => {
      context.subscription.assistantRecap = allowance(remaining);
      render();

      expect(
        wrapper.get('[data-testid="recap-allowance-counter"]').text()
      ).toBe(`Free summaries remaining: ${remaining} of 3`);
      expect(
        wrapper.find('[data-testid="recap-allowance-generate"]').exists()
      ).toBe(true);
    }
  );

  it('marks the final Free credit without changing the dynamic counter', () => {
    context.subscription.assistantRecap = allowance(1);
    render();

    expect(wrapper.text()).toContain('Free summaries remaining: 1 of 3');
    expect(wrapper.get('[data-testid="recap-allowance-last"]').text()).toBe(
      'Last'
    );
  });

  it('shows the exhausted Free state and sends an eligible owner to upgrade', async () => {
    context.subscription.assistantRecap = allowance(0);
    render();

    expect(wrapper.text()).toContain('Free summaries remaining: 0 of 3');
    expect(wrapper.text()).toContain('Your free recap limit has been reached');
    expect(
      wrapper.find('[data-testid="recap-allowance-generate"]').exists()
    ).toBe(false);

    await wrapper
      .get('[data-testid="recap-allowance-upgrade"]')
      .trigger('click');
    expect(wrapper.emitted('upgrade')).toHaveLength(1);
  });

  it.each([
    [20, '100', '20 summaries'],
    [7, '35', '7 summaries remaining'],
  ])(
    'shows the dynamic Premium counter and %s%% progress with %s credits left',
    (remaining, progress, label) => {
      context.subscription.currentPlan = 'premium';
      context.subscription.assistantRecap = premiumAllowance(remaining);
      render();

      expect(
        wrapper.get('[data-testid="recap-allowance-counter"]').text()
      ).toBe(`${remaining} / 20`);
      expect(
        wrapper
          .get('[data-testid="recap-allowance-progress"]')
          .attributes('aria-valuenow')
      ).toBe(progress);
      expect(wrapper.text()).toContain(label);
    }
  );

  it('shows the exhausted Premium state and an update-plan action', async () => {
    context.subscription.currentPlan = 'premium';
    context.subscription.assistantRecap = premiumAllowance(0);
    render();

    expect(wrapper.text()).toContain('0 / 20');
    expect(wrapper.text()).toContain('Limit reached');
    expect(wrapper.text()).toContain('Your plan recap limit has been reached');
    expect(
      wrapper.get('[data-testid="recap-allowance-upgrade"]').text()
    ).toContain('Update plan');

    await wrapper
      .get('[data-testid="recap-allowance-upgrade"]')
      .trigger('click');
    expect(wrapper.emitted('upgrade')).toHaveLength(1);
  });

  it('keeps the existing refresh fallback for missing allowance data', async () => {
    context.subscription.assistantRecap = null;
    const refresh = vi
      .spyOn(context.subscription, 'refreshCurrentPlan')
      .mockImplementationOnce(async () => {
        context.subscription.assistantRecap = allowance(2);
      });
    render();

    expect(wrapper.text()).toContain('could not be confirmed');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('keeps viewers out of upgrade flows even when the cached allowance is exhausted', () => {
    context.workspace.workspace.members[0]!.role = 'viewer';
    context.subscription.assistantRecap = allowance(0, false);
    render();

    expect(wrapper.text()).toContain('Your household role cannot generate');
    expect(
      wrapper.find('[data-testid="recap-allowance-upgrade"]').exists()
    ).toBe(false);
  });

  it('keeps the current checking fallback while a refresh is in progress', () => {
    context.subscription.isLoading = true;
    render();

    expect(wrapper.text()).toContain('Checking recap availability');
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
  });

  it('localizes the Free counter and exhausted action', async () => {
    context.i18n.global.locale.value = 'uk';
    context.subscription.assistantRecap = allowance(0);
    render();

    expect(wrapper.text()).toContain(
      'Залишилося безкоштовних підсумків: 0 з 3'
    );
    expect(
      wrapper.get('[data-testid="recap-allowance-upgrade"]').text()
    ).toContain('Оновити до Premium');

    context.subscription.assistantRecap = allowance(2);
    await nextTick();
    expect(wrapper.text()).toContain(
      'Залишилося безкоштовних підсумків: 2 з 3'
    );
  });
});
