// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import type { Task } from '@/features/tasks/types';
import TaskSwipeActionCard from '@/features/tasks/components/TaskSwipeActionCard.vue';

const state = vi.hoisted(() => ({
  tasks: [] as Task[],
  deleteTask: vi.fn(),
  updateMeetingTaskStatus: vi.fn(),
  updateTaskStatus: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
}));

vi.mock('@/app/stores/meetings', () => ({
  useMeetingsStore: () => ({
    meetings: [],
    deleteTask: state.deleteTask,
    syncFromMeetings: vi.fn(),
    updateTaskDetails: vi.fn(),
    updateTaskStatus: state.updateMeetingTaskStatus,
  }),
}));

vi.mock('@/app/stores/participants', () => ({
  useParticipantsStore: () => ({
    activeParticipants: [
      {
        id: 'participant-1',
        name: 'Rita',
        initials: 'R',
        avatarColor: '#6d8b74',
        avatarType: 'initials',
        type: 'adult',
        isActive: true,
        createdAt: '2026-09-05T10:00:00.000Z',
        updatedAt: '2026-09-05T10:00:00.000Z',
      },
    ],
    getParticipantById: () => null,
  }),
}));

vi.mock('@/app/stores/tasks', () => ({
  useTasksStore: () => ({
    get tasks() {
      return state.tasks;
    },
    get openTasks() {
      return state.tasks.filter((task) => task.status === 'open');
    },
    get doneTasks() {
      return state.tasks.filter((task) => task.status === 'done');
    },
    get skippedTasks() {
      return state.tasks.filter((task) => task.status === 'skipped');
    },
    addTask: vi.fn(),
    deleteTask: state.deleteTask,
    syncFromMeetings: vi.fn(),
    updateTask: vi.fn(),
    updateTaskStatus: state.updateTaskStatus,
  }),
}));

vi.mock('@/app/stores/workspace', () => ({
  useWorkspaceStore: () => ({ activeMembers: [] }),
}));

vi.mock('@/shared/composables/useStartupLoadingState', () => ({
  useStartupLoadingState: () => ({ isStartupLoading: ref(false) }),
}));

vi.mock('@/shared/composables/useWorkspacePermissions', () => ({
  useWorkspacePermissions: () => ({ can: () => true }),
}));

vi.mock('@/features/participants/components/ParticipantAvatar.vue', () => ({
  default: { template: '<span />' },
}));

vi.mock('@/shared/components/ConfirmationDialog.vue', () => ({
  default: {
    name: 'ConfirmationDialog',
    props: ['open'],
    template: '<span />',
  },
}));

vi.mock('@/shared/components/BaseBottomSheet.vue', () => ({
  default: {
    props: ['open'],
    template: '<section v-if="open"><slot /></section>',
  },
}));

import TasksPage from '../TasksPage.vue';

function mountTasksPage() {
  return mount(TasksPage);
}

beforeEach(() => {
  state.deleteTask.mockReset();
  state.updateMeetingTaskStatus.mockReset();
  state.updateTaskStatus.mockReset();
  state.tasks = [
    {
      id: 'task-1',
      title: 'Buy fruit',
      responsibilityType: 'shared',
      responsibleParticipantIds: ['participant-1'],
      responsibleUserIds: ['adult-1'],
      status: 'open',
      createdAt: '2026-09-05T10:00:00.000Z',
      updatedAt: '2026-09-05T10:00:00.000Z',
    },
  ];
});

describe('TasksPage responsibility editing', () => {
  it('does not render adult assignment controls in either task sheet', async () => {
    const wrapper = mountTasksPage();

    await wrapper.get('.tasks-fab').trigger('click');

    expect(wrapper.text()).not.toContain('tasksPage.responsibleAdults');

    await wrapper.get('.task-card__content').trigger('click');

    expect(wrapper.text()).not.toContain('tasksPage.responsibleAdults');
  });
});

describe('TasksPage swipe actions', () => {
  it('uses the existing completion flow when a task card requests finish', async () => {
    vi.useFakeTimers();
    const wrapper = mountTasksPage();

    wrapper.findComponent(TaskSwipeActionCard).vm.$emit('finish');
    await nextTick();

    expect(
      wrapper.findComponent(TaskSwipeActionCard).props('isCompleting')
    ).toBe(true);

    vi.advanceTimersByTime(720);
    await nextTick();

    expect(state.updateTaskStatus).toHaveBeenCalledWith('task-1', 'done');
    expect(state.updateMeetingTaskStatus).toHaveBeenCalledWith(
      'task-1',
      'done'
    );
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('opens the existing confirmation dialog when a task card requests removal', async () => {
    const wrapper = mountTasksPage();

    wrapper.findComponent(TaskSwipeActionCard).vm.$emit('requestDelete');
    await nextTick();

    expect(
      wrapper.findComponent({ name: 'ConfirmationDialog' }).props('open')
    ).toBe(true);
  });

  it('does not enable the finish swipe for a completed task', async () => {
    state.tasks[0].status = 'done';
    const wrapper = mountTasksPage();

    await wrapper.findAll('[role="tab"]')[2].trigger('click');

    expect(wrapper.findComponent(TaskSwipeActionCard).props('canFinish')).toBe(
      false
    );
  });
});
