// @vitest-environment happy-dom
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import AnchoredActionMenu from '../AnchoredActionMenu.vue';

const menuProps = {
  triggerLabel: 'Open actions for Buy fruit',
  menuLabel: 'Actions for Buy fruit',
  items: [
    { id: 'edit', label: 'Edit', icon: 'edit' },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'delete_outline',
      variant: 'destructive' as const,
    },
  ],
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('AnchoredActionMenu', () => {
  it('opens labelled actions and emits the selected action', async () => {
    const wrapper = mount(AnchoredActionMenu, {
      attachTo: document.body,
      props: menuProps,
    });

    await wrapper
      .get('[aria-label="Open actions for Buy fruit"]')
      .trigger('click');

    expect(document.querySelector('[role="menu"]')?.textContent).toContain(
      'Edit'
    );

    document.querySelector<HTMLButtonElement>('[aria-label="Edit"]')?.click();
    await nextTick();

    expect(wrapper.emitted('select')).toEqual([['edit']]);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    wrapper.unmount();
  });

  it('closes when a pointer event lands outside its trigger and menu', async () => {
    const wrapper = mount(AnchoredActionMenu, {
      attachTo: document.body,
      props: menuProps,
    });

    await wrapper
      .get('[aria-label="Open actions for Buy fruit"]')
      .trigger('click');
    document.body.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true })
    );
    await nextTick();

    expect(document.querySelector('[role="menu"]')).toBeNull();
    wrapper.unmount();
  });
});
