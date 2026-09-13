import type {
  Meeting,
  MeetingSummaryTask,
  MeetingTask,
} from '@/features/meeting/types';
import { translate } from '@/features/localization/i18n';
import {
  getMeetingSectionPrompt,
  getMeetingSectionTitle,
  getMeetingTemplateName,
} from '@/features/meeting/meetingTemplates';
import type { SupportedLocale } from '@/features/localization/types';
import {
  downloadFileInBrowser,
  deliverBinaryExportFile,
  shareExportFile as shareDeliveredExportFile,
} from '@/shared/services/exportFileDeliveryService';
import { exportMeetingPdf as requestMeetingPdf } from '@/shared/api/exportsApi';

export type MeetingExportFormat = 'text' | 'markdown';

export interface MeetingExportContext {
  getParticipantName: (participantId: string) => string;
  locale?: SupportedLocale;
  formatDate?: (date: Date) => string;
  formatDateTime?: (value: string) => string;
}

export interface MeetingExportFile {
  content: string;
  fileName: string;
  mimeType: string;
}

const lineBreak = '\n';

function defaultFormatDate(date: Date, locale?: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function defaultFormatDateTime(value: string, locale?: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function getMeetingDate(meeting: Meeting) {
  return new Date(
    meeting.completedAt ?? meeting.updatedAt ?? meeting.createdAt
  );
}

function getMeetingStatusLabel(meeting: Meeting) {
  return meeting.status === 'completed'
    ? translate('export.finished')
    : translate('export.draft');
}

function getResponsibleLabel(
  task: Pick<
    MeetingTask | MeetingSummaryTask,
    'responsibilityType' | 'responsibleParticipantIds'
  >,
  getParticipantName: MeetingExportContext['getParticipantName']
) {
  if (task.responsibilityType === 'needsDiscussion') {
    return translate('export.needsDiscussion');
  }

  if (!task.responsibleParticipantIds.length) {
    return task.responsibilityType === 'shared'
      ? translate('export.shared')
      : translate('export.unassigned');
  }

  return task.responsibleParticipantIds.map(getParticipantName).join(', ');
}

function getTaskMeta(
  task: Pick<
    MeetingTask | MeetingSummaryTask,
    'status' | 'dueDate' | 'responsibilityType' | 'responsibleParticipantIds'
  >,
  context: MeetingExportContext
) {
  const details = [
    `${translate('export.status')}: ${task.status ? translate(`export.taskStatus.${task.status}`) : translate('followThrough.unknownStatus')}`,
    `${translate('export.responsible')}: ${getResponsibleLabel(
      task,
      context.getParticipantName
    )}`,
  ];

  if (task.dueDate) {
    details.push(`${translate('export.due')}: ${task.dueDate}`);
  }

  return details.join(' | ');
}

function createSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'meeting';
}

function getExportBaseName(meeting: Meeting) {
  const date = getMeetingDate(meeting).toISOString().slice(0, 10);
  return `ourweek-${date}-${createSlug(meeting.title)}`;
}

function addAiSummaryText(
  lines: string[],
  meeting: Meeting,
  context: MeetingExportContext
) {
  if (!meeting.aiSummary) {
    return;
  }

  lines.push(
    translate('export.aiSummary'),
    translate('export.aiDisclaimer'),
    meeting.aiSummary.shortSummary,
    ''
  );

  if (addFollowThrough(lines, meeting)) return;

  addListText(
    lines,
    translate('export.mainTopics'),
    meeting.aiSummary.mainTopics
  );
  addListText(
    lines,
    translate('export.keyTensions'),
    meeting.aiSummary.keyTensions
  );
  addListText(
    lines,
    translate('export.agreementsMade'),
    meeting.aiSummary.agreements
  );

  lines.push(translate('meeting.tasks'));
  if (meeting.aiSummary.tasks.length) {
    for (const task of meeting.aiSummary.tasks) {
      lines.push(`- ${task.title}`);
      if (task.description) {
        lines.push(`  ${task.description}`);
      }
      lines.push(`  ${getTaskMeta(task, context)}`);
    }
  } else {
    lines.push(`- ${translate('export.noOpenTasks')}`);
  }
  lines.push('');

  addListText(
    lines,
    translate('export.revisitNextWeek'),
    meeting.aiSummary.suggestedNextMeetingFocus
  );
}

function addListText(lines: string[], title: string, items: string[]) {
  lines.push(title);
  if (items.length) {
    lines.push(...items.map((item) => `- ${item}`));
  } else {
    lines.push(`- ${translate('export.noneRecorded')}`);
  }
  lines.push('');
}

function addAiSummaryMarkdown(
  lines: string[],
  meeting: Meeting,
  context: MeetingExportContext
) {
  if (!meeting.aiSummary) {
    return;
  }

  lines.push(
    `## ${translate('export.aiSummary')}`,
    `_${translate('export.aiDisclaimer')}_`,
    '',
    meeting.aiSummary.shortSummary,
    ''
  );

  if (addFollowThrough(lines, meeting)) return;

  addListMarkdown(
    lines,
    translate('export.mainTopics'),
    meeting.aiSummary.mainTopics
  );
  addListMarkdown(
    lines,
    translate('export.keyTensions'),
    meeting.aiSummary.keyTensions
  );
  addListMarkdown(
    lines,
    translate('export.agreementsMade'),
    meeting.aiSummary.agreements
  );

  lines.push(`### ${translate('meeting.tasks')}`);
  if (meeting.aiSummary.tasks.length) {
    for (const task of meeting.aiSummary.tasks) {
      lines.push(`- **${task.title}**`);
      if (task.description) {
        lines.push(`  ${task.description}`);
      }
      lines.push(`  ${getTaskMeta(task, context)}`);
    }
  } else {
    lines.push(`- ${translate('export.noOpenTasks')}`);
  }
  lines.push('');

  addListMarkdown(
    lines,
    translate('export.revisitNextWeek'),
    meeting.aiSummary.suggestedNextMeetingFocus
  );
}

function addListMarkdown(lines: string[], title: string, items: string[]) {
  lines.push(`### ${title}`);
  if (items.length) {
    lines.push(...items.map((item) => `- ${item}`));
  } else {
    lines.push(`- ${translate('export.noneRecorded')}`);
  }
  lines.push('');
}

export function exportMeetingAsText(
  meeting: Meeting,
  context: MeetingExportContext
) {
  const formatDate =
    context.formatDate ??
    ((date: Date) => defaultFormatDate(date, context.locale));
  const formatDateTime =
    context.formatDateTime ??
    ((value: string) => defaultFormatDateTime(value, context.locale));
  const lines: string[] = [
    translate('export.meetingTitle'),
    getMeetingTemplateName(meeting.templateId, meeting.title),
    `${translate('export.date')}: ${formatDate(getMeetingDate(meeting))}`,
    `${translate('export.status')}: ${getMeetingStatusLabel(meeting)}`,
    '',
  ];

  addAiSummaryText(lines, meeting, context);

  lines.push(translate('export.meetingSections'), '');

  for (const section of meeting.sections) {
    lines.push(
      getMeetingSectionTitle(section.id, section.title),
      getMeetingSectionPrompt(section.id, section.prompt),
      ''
    );

    lines.push(translate('export.notes'));
    if (section.notes.length) {
      for (const note of section.notes) {
        lines.push(
          `- ${note.participantId ? context.getParticipantName(note.participantId) : translate('meeting.shared')} (${formatDateTime(
            note.createdAt
          )}): ${note.text}`
        );
      }
    } else {
      lines.push(`- ${translate('export.noNotes')}`);
    }
    lines.push('');

    lines.push(translate('export.tasks'));
    if (section.tasks.length) {
      for (const task of section.tasks) {
        lines.push(`- ${task.title}`);
        if (task.description) {
          lines.push(`  ${task.description}`);
        }
        lines.push(`  ${getTaskMeta(task, context)}`);
      }
    } else {
      lines.push(`- ${translate('export.noTasks')}`);
    }
    lines.push('');

    lines.push(translate('export.agreements'));
    if (section.agreements.length) {
      for (const agreement of section.agreements) {
        const participants = agreement.participantIds
          .map(context.getParticipantName)
          .join(', ');
        lines.push(`- ${agreement.text}`);
        if (participants) {
          lines.push(`  ${translate('export.people')}: ${participants}`);
        }
      }
    } else {
      lines.push(`- ${translate('export.noAgreements')}`);
    }
    lines.push('');
  }

  lines.push(translate('export.privateNotesExcluded'));

  return lines.join(lineBreak).trimEnd();
}

export function exportMeetingAsMarkdown(
  meeting: Meeting,
  context: MeetingExportContext
) {
  const formatDate =
    context.formatDate ??
    ((date: Date) => defaultFormatDate(date, context.locale));
  const formatDateTime =
    context.formatDateTime ??
    ((value: string) => defaultFormatDateTime(value, context.locale));
  const lines: string[] = [
    `# ${getMeetingTemplateName(meeting.templateId, meeting.title)}`,
    '',
    `- ${translate('export.date')}: ${formatDate(getMeetingDate(meeting))}`,
    `- ${translate('export.status')}: ${getMeetingStatusLabel(meeting)}`,
    '',
  ];

  addAiSummaryMarkdown(lines, meeting, context);

  lines.push(`## ${translate('export.meetingSections')}`, '');

  for (const section of meeting.sections) {
    lines.push(
      `### ${getMeetingSectionTitle(section.id, section.title)}`,
      getMeetingSectionPrompt(section.id, section.prompt),
      ''
    );

    lines.push(`#### ${translate('export.notes')}`);
    if (section.notes.length) {
      for (const note of section.notes) {
        lines.push(
          `- **${note.participantId ? context.getParticipantName(note.participantId) : translate('meeting.shared')}** (${formatDateTime(
            note.createdAt
          )}): ${note.text}`
        );
      }
    } else {
      lines.push(`- ${translate('export.noNotes')}`);
    }
    lines.push('');

    lines.push(`#### ${translate('export.tasks')}`);
    if (section.tasks.length) {
      for (const task of section.tasks) {
        lines.push(`- **${task.title}**`);
        if (task.description) {
          lines.push(`  ${task.description}`);
        }
        lines.push(`  ${getTaskMeta(task, context)}`);
      }
    } else {
      lines.push(`- ${translate('export.noTasks')}`);
    }
    lines.push('');

    lines.push(`#### ${translate('export.agreements')}`);
    if (section.agreements.length) {
      for (const agreement of section.agreements) {
        const participants = agreement.participantIds
          .map(context.getParticipantName)
          .join(', ');
        lines.push(`- ${agreement.text}`);
        if (participants) {
          lines.push(`  ${translate('export.people')}: ${participants}`);
        }
      }
    } else {
      lines.push(`- ${translate('export.noAgreements')}`);
    }
    lines.push('');
  }

  lines.push(`_${translate('export.privateNotesExcluded')}_`);

  return lines.join(lineBreak).trimEnd();
}

export function createMeetingExportFile(
  meeting: Meeting,
  context: MeetingExportContext,
  format: MeetingExportFormat
): MeetingExportFile {
  if (format === 'markdown') {
    return {
      content: exportMeetingAsMarkdown(meeting, context),
      fileName: `${getExportBaseName(meeting)}.md`,
      mimeType: 'text/markdown;charset=utf-8',
    };
  }

  return {
    content: exportMeetingAsText(meeting, context),
    fileName: `${getExportBaseName(meeting)}.txt`,
    mimeType: 'text/plain;charset=utf-8',
  };
}

export async function copyExportToClipboard(content: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error(translate('export.clipboardUnavailable'));
  }

  await navigator.clipboard.writeText(content);
}

export async function shareExportFile(file: MeetingExportFile) {
  return shareDeliveredExportFile(file);
}

export function downloadExportFile(file: MeetingExportFile) {
  downloadFileInBrowser(file);
}

export async function exportMeetingAsPdf(meetingId: string) {
  const file = await requestMeetingPdf(meetingId);

  return deliverBinaryExportFile({
    content: file.blob,
    fileName: file.fileName,
    mimeType: 'application/pdf',
    title: file.fileName,
  });
}

export function followThroughExportLines(meeting: Meeting): string[] {
  const result = [translate('followThrough.exportSnapshot')];
  for (const observation of meeting.aiSummary?.followThrough?.observations ??
    []) {
    result.push(
      '',
      translate(`followThrough.${observation.reviewHorizon}`),
      observation.title,
      observation.explanation,
      `${translate('followThrough.suggestion')}: ${observation.question}`,
      `${translate('followThrough.evidence')}: ${observation.sourceRefs.map((source) => source.label).join('; ')}`
    );
  }
  return result;
}
function addFollowThrough(lines: string[], meeting: Meeting) {
  lines.push(...followThroughExportLines(meeting));
  return Boolean(meeting.aiSummary?.followThrough);
}
