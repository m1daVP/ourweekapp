// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import SavedMeetingExportCard from '../SavedMeetingExportCard.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      common: {
        copy: 'Copy',
        shareOrSave: 'Share or save',
        pdf: 'PDF',
        markdown: 'Markdown',
      },
      meeting: {
        exportMeeting: 'Export meeting',
        exportHelp: 'Save a clean copy. Private notes are not included.',
        exportPremiumTitle: 'Export is premium',
        exportPremiumMessage: 'Upgrade to export this meeting.',
        format: 'Format',
        plainText: 'Plain text',
        plainTextHelp: 'Best for messages and notes.',
        markdownHelp: 'Best for Markdown apps.',
      },
    },
  },
});

function render(available: boolean) {
  return mount(SavedMeetingExportCard, {
    props: {
      available,
      format: 'text',
      exporting: false,
    },
    global: {
      plugins: [i18n],
      stubs: {
        UpgradePrompt: {
          template:
            '<div class="upgrade-prompt"><button class="secondary-button">Export is premium</button></div>',
        },
      },
    },
  });
}

describe('SavedMeetingExportCard', () => {
  it('shows inline format and export actions for an unlocked account', async () => {
    const wrapper = render(true);

    await wrapper.get('[data-testid="saved-export-copy"]').trigger('click');

    expect(wrapper.emitted('copy')).toHaveLength(1);
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2);
    expect(wrapper.find('.upgrade-prompt').exists()).toBe(false);
  });

  it('emits selected formats and each export action', async () => {
    const wrapper = render(true);

    await wrapper.get('input[value="markdown"]').trigger('change');
    await wrapper.findAll('button')[1]!.trigger('click');
    await wrapper.findAll('button')[2]!.trigger('click');

    expect(wrapper.emitted('update:format')).toEqual([['markdown']]);
    expect(wrapper.emitted('share')).toHaveLength(1);
    expect(wrapper.emitted('pdf')).toHaveLength(1);
  });

  it('shows the Premium prompt without inactive controls when locked', () => {
    const wrapper = render(false);

    expect(wrapper.get('.upgrade-prompt').exists()).toBe(true);
    expect(wrapper.text()).toContain('Export is premium');
    expect(wrapper.find('[data-testid="saved-export-copy"]').exists()).toBe(
      false
    );
    expect(wrapper.find('input[type="radio"]').exists()).toBe(false);
  });
});
