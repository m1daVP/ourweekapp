// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { i18n } from '@/features/localization/i18n';
import PrivacyPolicyPage from '../PrivacyPolicyPage.vue';
import TermsPage from '../TermsPage.vue';

function mountPage(component: typeof PrivacyPolicyPage) {
  return shallowMount(component, {
    global: {
      plugins: [i18n],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  });
}

describe('legal pages', () => {
  it.each(['en', 'uk', 'es'] as const)(
    'renders canonical English privacy content for %s',
    (locale) => {
      i18n.global.locale.value = locale;

      const wrapper = mountPage(PrivacyPolicyPage);

      expect(wrapper.text()).toContain('VADYM PASICHNYK - WebWave');
      expect(wrapper.text()).toContain('ourweekapp@gmail.com');
      expect(wrapper.text()).toContain('30 days');
      expect(wrapper.text()).toContain('90 days');
      expect(wrapper.text()).not.toContain(
        'This policy describes the planned public v1 behavior'
      );
    }
  );

  it.each(['en', 'uk', 'es'] as const)(
    'renders canonical English terms content for %s',
    (locale) => {
      i18n.global.locale.value = locale;

      const wrapper = mountPage(TermsPage);

      expect(wrapper.text()).toContain('VADYM PASICHNYK - WebWave');
      expect(wrapper.text()).toContain('ourweekapp@gmail.com');
      expect(wrapper.text()).toContain('laws of Poland');
      expect(wrapper.text()).toContain('30 days');
      expect(wrapper.text()).toContain('90 days');
      expect(wrapper.text()).not.toContain(
        'These terms describe the planned public v1 behavior'
      );
    }
  );
});
