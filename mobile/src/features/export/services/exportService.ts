import type {
  Meeting,
  MeetingSummaryTask,
  MeetingTask,
} from '@/features/meeting/types';

export type MeetingExportFormat = 'text' | 'markdown';

export interface MeetingExportContext {
  getParticipantName: (participantId: string) => string;
  formatDate?: (date: Date) => string;
  formatDateTime?: (value: string) => string;
}

export interface MeetingExportFile {
  content: string;
  fileName: string;
  mimeType: string;
}

interface WebNavigatorWithShare extends Navigator {
  canShare?: (data: ShareData) => boolean;
}

const lineBreak = '\n';

function defaultFormatDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function defaultFormatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
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
  return meeting.status === 'completed' ? 'finished' : 'draft';
}

function getResponsibleLabel(
  task: Pick<
    MeetingTask | MeetingSummaryTask,
    'responsibilityType' | 'responsibleParticipantIds'
  >,
  getParticipantName: MeetingExportContext['getParticipantName']
) {
  if (task.responsibilityType === 'needsDiscussion') {
    return 'Needs discussion';
  }

  if (!task.responsibleParticipantIds.length) {
    return task.responsibilityType === 'shared' ? 'Shared' : 'Unassigned';
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
    `Status: ${task.status}`,
    `Responsible: ${getResponsibleLabel(task, context.getParticipantName)}`,
  ];

  if (task.dueDate) {
    details.push(`Due: ${task.dueDate}`);
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
  return `weekly-us-${date}-${createSlug(meeting.title)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
    'AI summary',
    'AI summaries may be inaccurate. Review before relying on them.',
    meeting.aiSummary.shortSummary,
    ''
  );

  addListText(lines, 'Main topics discussed', meeting.aiSummary.mainTopics);
  addListText(lines, 'Key tensions', meeting.aiSummary.keyTensions);
  addListText(lines, 'Agreements made', meeting.aiSummary.agreements);

  lines.push('Open tasks');
  if (meeting.aiSummary.tasks.length) {
    for (const task of meeting.aiSummary.tasks) {
      lines.push(`- ${task.title}`);
      if (task.description) {
        lines.push(`  ${task.description}`);
      }
      lines.push(`  ${getTaskMeta(task, context)}`);
    }
  } else {
    lines.push('- No open tasks were summarized.');
  }
  lines.push('');

  addListText(
    lines,
    'Topics to revisit next week',
    meeting.aiSummary.suggestedNextMeetingFocus
  );
}

function addListText(lines: string[], title: string, items: string[]) {
  lines.push(title);
  if (items.length) {
    lines.push(...items.map((item) => `- ${item}`));
  } else {
    lines.push('- None recorded.');
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
    '## AI summary',
    '_AI summaries may be inaccurate. Review before relying on them._',
    '',
    meeting.aiSummary.shortSummary,
    ''
  );

  addListMarkdown(lines, 'Main topics discussed', meeting.aiSummary.mainTopics);
  addListMarkdown(lines, 'Key tensions', meeting.aiSummary.keyTensions);
  addListMarkdown(lines, 'Agreements made', meeting.aiSummary.agreements);

  lines.push('### Open tasks');
  if (meeting.aiSummary.tasks.length) {
    for (const task of meeting.aiSummary.tasks) {
      lines.push(`- **${task.title}**`);
      if (task.description) {
        lines.push(`  ${task.description}`);
      }
      lines.push(`  ${getTaskMeta(task, context)}`);
    }
  } else {
    lines.push('- No open tasks were summarized.');
  }
  lines.push('');

  addListMarkdown(
    lines,
    'Topics to revisit next week',
    meeting.aiSummary.suggestedNextMeetingFocus
  );
}

function addListMarkdown(lines: string[], title: string, items: string[]) {
  lines.push(`### ${title}`);
  if (items.length) {
    lines.push(...items.map((item) => `- ${item}`));
  } else {
    lines.push('- None recorded.');
  }
  lines.push('');
}

export function exportMeetingAsText(
  meeting: Meeting,
  context: MeetingExportContext
) {
  const formatDate = context.formatDate ?? defaultFormatDate;
  const formatDateTime = context.formatDateTime ?? defaultFormatDateTime;
  const lines: string[] = [
    'Weekly Us meeting',
    meeting.title,
    `Date: ${formatDate(getMeetingDate(meeting))}`,
    `Status: ${getMeetingStatusLabel(meeting)}`,
    '',
  ];

  addAiSummaryText(lines, meeting, context);

  lines.push('Meeting sections', '');

  for (const section of meeting.sections) {
    lines.push(section.title, section.prompt, '');

    lines.push('Notes');
    if (section.notes.length) {
      for (const note of section.notes) {
        lines.push(
          `- ${context.getParticipantName(note.participantId)} (${formatDateTime(
            note.createdAt
          )}): ${note.text}`
        );
      }
    } else {
      lines.push('- No notes in this section.');
    }
    lines.push('');

    lines.push('Tasks');
    if (section.tasks.length) {
      for (const task of section.tasks) {
        lines.push(`- ${task.title}`);
        if (task.description) {
          lines.push(`  ${task.description}`);
        }
        lines.push(`  ${getTaskMeta(task, context)}`);
      }
    } else {
      lines.push('- No tasks in this section.');
    }
    lines.push('');

    lines.push('Agreements');
    if (section.agreements.length) {
      for (const agreement of section.agreements) {
        const participants = agreement.participantIds
          .map(context.getParticipantName)
          .join(', ');
        lines.push(`- ${agreement.text}`);
        if (participants) {
          lines.push(`  People: ${participants}`);
        }
      }
    } else {
      lines.push('- No agreements in this section.');
    }
    lines.push('');
  }

  lines.push('Private notes are not included in this export.');

  return lines.join(lineBreak).trimEnd();
}

export function exportMeetingAsMarkdown(
  meeting: Meeting,
  context: MeetingExportContext
) {
  const formatDate = context.formatDate ?? defaultFormatDate;
  const formatDateTime = context.formatDateTime ?? defaultFormatDateTime;
  const lines: string[] = [
    `# ${meeting.title}`,
    '',
    `- Date: ${formatDate(getMeetingDate(meeting))}`,
    `- Status: ${getMeetingStatusLabel(meeting)}`,
    '',
  ];

  addAiSummaryMarkdown(lines, meeting, context);

  lines.push('## Meeting sections', '');

  for (const section of meeting.sections) {
    lines.push(`### ${section.title}`, section.prompt, '');

    lines.push('#### Notes');
    if (section.notes.length) {
      for (const note of section.notes) {
        lines.push(
          `- **${context.getParticipantName(note.participantId)}** (${formatDateTime(
            note.createdAt
          )}): ${note.text}`
        );
      }
    } else {
      lines.push('- No notes in this section.');
    }
    lines.push('');

    lines.push('#### Tasks');
    if (section.tasks.length) {
      for (const task of section.tasks) {
        lines.push(`- **${task.title}**`);
        if (task.description) {
          lines.push(`  ${task.description}`);
        }
        lines.push(`  ${getTaskMeta(task, context)}`);
      }
    } else {
      lines.push('- No tasks in this section.');
    }
    lines.push('');

    lines.push('#### Agreements');
    if (section.agreements.length) {
      for (const agreement of section.agreements) {
        const participants = agreement.participantIds
          .map(context.getParticipantName)
          .join(', ');
        lines.push(`- ${agreement.text}`);
        if (participants) {
          lines.push(`  People: ${participants}`);
        }
      }
    } else {
      lines.push('- No agreements in this section.');
    }
    lines.push('');
  }

  lines.push('_Private notes are not included in this export._');

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
    throw new Error('Clipboard is not available in this browser.');
  }

  await navigator.clipboard.writeText(content);
}

export async function shareExportFile(file: MeetingExportFile) {
  const exportedFile = new File([file.content], file.fileName, {
    type: file.mimeType,
  });
  const shareData: ShareData = {
    title: file.fileName,
    files: [exportedFile],
  };
  const webNavigator = navigator as WebNavigatorWithShare;

  if (!navigator.share || !webNavigator.canShare?.(shareData)) {
    return false;
  }

  await navigator.share(shareData);
  return true;
}

export function downloadExportFile(file: MeetingExportFile) {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = file.fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportMeetingAsPdf(
  meeting: Meeting,
  context: MeetingExportContext
) {
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    return false;
  }

  const markdown = exportMeetingAsMarkdown(meeting, context);
  const escapedContent = escapeHtml(markdown);
  const escapedTitle = escapeHtml(meeting.title);

  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>${escapedTitle}</title>
    <style>
      body {
        color: #221f1b;
        font-family: Arial, sans-serif;
        line-height: 1.45;
        margin: 32px;
      }
      pre {
        white-space: pre-wrap;
        word-wrap: break-word;
        font: inherit;
      }
    </style>
  </head>
  <body>
    <pre>${escapedContent}</pre>
  </body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();

  return true;
}
