// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { webcrypto } from 'node:crypto';
import {
  summarySourceFingerprint,
  resolveSummarySource,
} from '../followThrough';
import { meetingFixture, setupRecapTest } from './recapFixtures';
import MeetingFollowThrough from '../components/MeetingFollowThrough.vue';
import { useTasksStore } from '@/app/stores/tasks';
import { followThroughExportLines } from '@/features/export/services/exportService';
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/shared/composables/useWorkspacePermissions', () => ({
  useWorkspacePermissions: () => ({ can: () => true }),
}));
vi.stubGlobal('crypto', webcrypto);

describe('meeting follow-through', () => {
  it('detects changes to facts but ignores summary persistence metadata', async () => {
    const meeting = meetingFixture();
    const original = await summarySourceFingerprint(meeting);
    meeting.updatedAt = '2026-09-06T00:00:00Z';
    meeting.serverRevision = 100;
    meeting.aiSummary!.shortSummary = 'New overview';
    expect(await summarySourceFingerprint(meeting)).toBe(original);
    meeting.sections[0]!.notes[0]!.text = 'Different plan';
    expect(await summarySourceFingerprint(meeting)).not.toBe(original);
  });
  it('rejects a moved or missing source rather than opening a different record', () => {
    const meeting = meetingFixture();
    expect(
      resolveSummarySource(meeting, {
        sectionIndex: 0,
        sectionId: 'plans',
        kind: 'note',
        itemId: 'note-1',
        label: 'Plan',
      })
    ).toBeNull();
    expect(
      resolveSummarySource(meeting, {
        sectionIndex: 0,
        kind: 'note',
        itemId: 'missing',
        label: 'Plan',
      })
    ).toBeNull();
  });
  it('creates nothing until a fresh draft is confirmed, and disables stale drafts', async () => {
    const context = setupRecapTest();
    const meeting = context.meetings.meetings[0]!;
    meeting.aiSummary!.followThrough = {
      version: 1,
      sourceFingerprint: await summarySourceFingerprint(meeting),
      observations: [
        {
          title: 'Clarify Sunday',
          explanation: 'A plan is recorded without a next step.',
          question: 'Choose a time for Sunday',
          kind: 'clarify',
          reviewHorizon: 'beforeNextMeeting',
          sourceRefs: [
            {
              sectionIndex: 0,
              sectionId: 'goodThings',
              kind: 'note',
              itemId: 'note-1',
              label: 'Plan Sunday.',
            },
          ],
          action: { type: 'createTask', sourceRefIndex: 0 },
        },
      ],
    };
    const wrapper = mount(MeetingFollowThrough, {
      props: { meeting },
      global: {
        plugins: [context.pinia, context.i18n],
        stubs: {
          BaseBottomSheet: {
            props: ['open'],
            template: '<div v-if="open"><slot /></div>',
          },
        },
      },
    });
    await flushPromises();
    await vi.waitFor(() =>
      expect(wrapper.text()).not.toContain('Checking whether')
    );
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Draft a task')!
      .trigger('click');
    const tasks = useTasksStore();
    expect(tasks.tasks).toHaveLength(0);
    await wrapper.get('select').setValue('shared');
    await wrapper.get('form').trigger('submit');
    await vi.waitFor(() => expect(tasks.tasks).toHaveLength(1));
    expect(tasks.tasks).toHaveLength(1);
    expect(tasks.tasks[0]!.dueDate).toBeUndefined();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Draft a task')!
      .trigger('click');
    await wrapper.get('select').setValue('shared');
    await wrapper.get('form').trigger('submit');
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain('already been saved')
    );
    expect(tasks.tasks).toHaveLength(1);
    meeting.sections[0]!.notes[0]!.text = 'Changed plan';
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.text()).toContain('earlier version'));
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === 'Draft a task')!
        .attributes('disabled')
    ).toBeDefined();
    expect(followThroughExportLines(meeting).join('\n')).toContain(
      'Choose a time for Sunday'
    );
    wrapper.unmount();
  });
  it('labels legacy summaries without suggesting verified freshness', async () => {
    const context = setupRecapTest();
    const wrapper = mount(MeetingFollowThrough, {
      props: { meeting: context.meetings.meetings[0]! },
      global: {
        plugins: [context.pinia, context.i18n],
        stubs: { BaseBottomSheet: true },
      },
    });
    expect(wrapper.text()).toContain('Saved snapshot');
    expect(wrapper.text()).not.toContain('Draft a task');
    wrapper.unmount();
  });
});
