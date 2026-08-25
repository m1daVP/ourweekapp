import type {
  InsightSearchItem,
  TaskFollowThroughInsight,
} from './types';

export function getTaskTags(value: TaskFollowThroughInsight) {
  return [
    `${value.done} done`,
    `${value.open} open`,
    ...(value.overdue > 0 ? [`${value.overdue} overdue`] : []),
  ];
}

export function getInsightResultRoute(item: InsightSearchItem) {
  if (item.type === 'task') {
    return { name: 'tasks' as const };
  }

  const meetingId = item.type === 'meeting' ? item.id : item.sourceMeetingId;

  return meetingId
    ? { name: 'meeting-summary' as const, params: { meetingId } }
    : { name: 'history' as const };
}
