// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import MeetingItemComposer from '../MeetingItemComposer.vue';

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('MeetingItemComposer', () => {
  it('keeps an invalid note open and shows its inline error', async () => {
    const wrapper = mount(MeetingItemComposer, {
      props: {
        open: true,
        participants: [],
        scope: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          meetingId: 'meeting-1',
          sectionId: 'goodThings',
          type: 'note',
        },
        submitItem: vi.fn(),
      },
      global: {
        stubs: { BaseBottomSheet: { template: '<div><slot /></div>' } },
      },
    });

    await wrapper.get('form').trigger('submit');

    expect(wrapper.text()).toContain('meetingStore.addShortNote');
    expect(wrapper.emitted('close')).toBeUndefined();
  });
});
