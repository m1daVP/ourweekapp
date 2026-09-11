import { requireMinimumRole, type AuthContext } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import { isPrivateMarkedObject } from '../../shared/privacy/index.js';
import type { JsonValue, SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { meetingSummarySchema } from '../ai/ai.schema.js';
import { summarySourceFingerprint } from '../ai/follow-through.js';
import type { MeetingDto } from '../meetings/meetings.repository.js';
import { ExportsRepository } from './exports.repository.js';
import {
  renderMeetingPdf,
  type MeetingPdfDocument,
  type MeetingPdfTask,
} from './meeting-pdf.js';
import type {
  ExportMeetingPdfRequestDto,
  ExportMeetingRequestDto,
  ExportMeetingResponseDto,
  MeetingExportFormatDto,
} from './exports.schema.js';

type ExportsRepositoryPort = Pick<
  ExportsRepository,
  'findMeetingForExport' | 'listParticipantNamesForWorkspace'
>;

type ExportSection = {
  title?: string;
  prompt?: string;
  notes: Array<{ participantId?: string; createdAt?: string; text: string }>;
  tasks: Array<{
    title: string;
    description?: string;
    responsibleParticipantIds?: string[];
    dueDate?: string;
    responsibilityType?: string;
    status?: string;
  }>;
  agreements: Array<{
    text: string;
    description?: string;
    participantIds?: string[];
  }>;
};

function isJsonObject(value: JsonValue | unknown): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimmedString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
}

function sanitizeNotes(value: JsonValue | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  const notes: ExportSection['notes'] = [];

  for (const item of value) {
    if (!isJsonObject(item) || isPrivateMarkedObject(item)) {
      continue;
    }

    const text = trimmedString(item.text);

    if (!text) {
      continue;
    }

    const participantId = trimmedString(item.participantId);
    const createdAt = trimmedString(item.createdAt);

    notes.push({
      ...(participantId ? { participantId } : {}),
      ...(createdAt ? { createdAt } : {}),
      text,
    });
  }

  return notes;
}

function sanitizeTasks(value: JsonValue | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  const tasks: ExportSection['tasks'] = [];

  for (const item of value) {
    if (!isJsonObject(item)) {
      continue;
    }

    const title = trimmedString(item.title);

    if (!title) {
      continue;
    }

    const description = trimmedString(item.description);
    const responsibleParticipantIds = stringArray(item.responsibleParticipantIds);
    const dueDate = trimmedString(item.dueDate);
    const responsibilityType = trimmedString(item.responsibilityType);
    const status = trimmedString(item.status);

    tasks.push({
      title,
      ...(description ? { description } : {}),
      ...(responsibleParticipantIds ? { responsibleParticipantIds } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(responsibilityType ? { responsibilityType } : {}),
      ...(status ? { status } : {}),
    });
  }

  return tasks;
}

function sanitizeAgreements(value: JsonValue | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  const agreements: ExportSection['agreements'] = [];

  for (const item of value) {
    if (!isJsonObject(item)) {
      continue;
    }

    const text = trimmedString(item.text) ?? trimmedString(item.title);

    if (!text) {
      continue;
    }

    const description = trimmedString(item.description);
    const participantIds = stringArray(item.participantIds);

    agreements.push({
      text,
      ...(description ? { description } : {}),
      ...(participantIds ? { participantIds } : {}),
    });
  }

  return agreements;
}

function sanitizeSections(sections: JsonValue[]) {
  const sanitized: ExportSection[] = [];

  for (const section of sections) {
    if (!isJsonObject(section)) {
      continue;
    }

    const title = trimmedString(section.title);
    const prompt = trimmedString(section.prompt);

    sanitized.push({
      ...(title ? { title } : {}),
      ...(prompt ? { prompt } : {}),
      notes: sanitizeNotes(section.notes),
      tasks: sanitizeTasks(section.tasks),
      agreements: sanitizeAgreements(section.agreements),
    });
  }

  return sanitized;
}

function bullet(value: string, format: MeetingExportFormatDto) {
  return format === 'markdown' ? `- ${value}` : `* ${value}`;
}

function heading(level: number, value: string, format: MeetingExportFormatDto) {
  if (format === 'markdown') {
    return `${'#'.repeat(level)} ${value}`;
  }

  return level === 1 ? value : value;
}

function addLabeledLine(lines: string[], label: string, value: string | null | undefined) {
  if (value) {
    lines.push(`${label}: ${value}`);
  }
}

function buildExportContent(
  meeting: MeetingDto,
  sections: ExportSection[],
  format: MeetingExportFormatDto,
) {
  const lines: string[] = [];

  lines.push(heading(1, meeting.title, format));
  lines.push('');
  addLabeledLine(lines, 'Status', meeting.status);
  addLabeledLine(lines, 'Completed at', meeting.completedAt);
  addLabeledLine(lines, 'Updated at', meeting.updatedAt);
  lines.push('');

  const summary = meetingSummarySchema.safeParse(meeting.aiSummary);
  if (summary.success && summary.data.followThrough) {
    lines.push(heading(2, 'Meeting follow-through', format));
    lines.push(summarySnapshotLabel(meeting, summary.data.followThrough.sourceFingerprint));
    lines.push('', summary.data.shortSummary, '');
    for (const observation of summary.data.followThrough.observations) {
      lines.push(heading(3, observation.title, format));
      lines.push(reviewHorizonLabel(observation.reviewHorizon));
      lines.push(observation.explanation);
      lines.push(`Question: ${observation.question}`);
      for (const source of observation.sourceRefs) {
        lines.push(bullet(`Source (${source.kind}): ${source.label}`, format));
      }
      lines.push('');
    }
    if (summary.data.followThrough.observations.length === 0) {
      lines.push('No additional follow-up observations.', '');
    }
  }

  for (const [index, section] of sections.entries()) {
    lines.push(
      heading(2, section.title ?? `Section ${index + 1}`, format),
    );

    if (section.prompt) {
      lines.push('');
      lines.push(section.prompt);
    }

    if (section.notes.length > 0) {
      lines.push('');
      lines.push(heading(3, 'Notes', format));
      for (const note of section.notes) {
        const participantPrefix = note.participantId
          ? `[${note.participantId}] `
          : '';
        lines.push(bullet(`${participantPrefix}${note.text}`, format));
      }
    }

    if (section.tasks.length > 0) {
      lines.push('');
      lines.push(heading(3, 'Tasks', format));
      for (const task of section.tasks) {
        const details = [
          task.description,
          task.responsibleParticipantIds?.length
            ? `responsible: ${task.responsibleParticipantIds.join(', ')}`
            : undefined,
          task.dueDate ? `due: ${task.dueDate}` : undefined,
          task.status ? `status: ${task.status}` : undefined,
        ].filter(Boolean);
        lines.push(
          bullet(
            details.length > 0
              ? `${task.title} (${details.join('; ')})`
              : task.title,
            format,
          ),
        );
      }
    }

    if (section.agreements.length > 0) {
      lines.push('');
      lines.push(heading(3, 'Agreements', format));
      for (const agreement of section.agreements) {
        const details = [
          agreement.description,
          agreement.participantIds?.length
            ? `participants: ${agreement.participantIds.join(', ')}`
            : undefined,
        ].filter(Boolean);
        lines.push(
          bullet(
            details.length > 0
              ? `${agreement.text} (${details.join('; ')})`
              : agreement.text,
            format,
          ),
        );
      }
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function toFilename(meeting: MeetingDto, format: MeetingExportFormatDto) {
  const slug = meeting.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'meeting';
  const extension = format === 'markdown' ? 'md' : 'txt';

  return `${slug}-${meeting.id}.${extension}`;
}

function toPdfFilename(meeting: MeetingDto) {
  const date = (meeting.completedAt ?? meeting.updatedAt ?? meeting.createdAt).slice(0, 10);
  const slug = meeting.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'meeting';

  return `ourweek-${date}-${slug}.pdf`;
}

function displayStatus(status: MeetingDto['status']) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function participantIdsForExport(sections: ExportSection[]) {
  const ids = new Set<string>();

  for (const section of sections) {
    section.notes.forEach((note) => note.participantId && ids.add(note.participantId));
    section.tasks.forEach((task) => task.responsibleParticipantIds?.forEach((id) => ids.add(id)));
    section.agreements.forEach((agreement) => agreement.participantIds?.forEach((id) => ids.add(id)));
  }

  return [...ids];
}

function namesForParticipantIds(ids: string[] | undefined, names: Map<string, string>) {
  return (ids ?? []).map((id) => names.get(id)).filter((name): name is string => Boolean(name));
}

function taskResponsibleLabel(
  task: ExportSection['tasks'][number],
  names: Map<string, string>,
) {
  const participantNames = namesForParticipantIds(task.responsibleParticipantIds, names);

  if (participantNames.length > 0) {
    return participantNames.join(', ');
  }

  if (task.responsibilityType === 'shared') {
    return 'Shared';
  }

  if (task.responsibilityType === 'needsDiscussion') {
    return 'Needs discussion';
  }

  return undefined;
}

function toPdfTask(
  task: ExportSection['tasks'][number],
  names: Map<string, string>,
): MeetingPdfTask {
  return {
    title: task.title,
    ...(task.description ? { description: task.description } : {}),
    ...(taskResponsibleLabel(task, names)
      ? { responsible: taskResponsibleLabel(task, names) }
      : {}),
    ...(task.dueDate ? { dueDate: task.dueDate } : {}),
    ...(task.status ? { status: task.status } : {}),
  };
}

function buildPdfDocument(
  meeting: MeetingDto,
  sections: ExportSection[],
  participantNames: Map<string, string>,
  generatedAt: Date,
): MeetingPdfDocument {
  const parsedSummary = meetingSummarySchema.safeParse(meeting.aiSummary);

  return {
    title: meeting.title,
    status: displayStatus(meeting.status),
    occurredOn: (meeting.completedAt ?? meeting.updatedAt ?? meeting.createdAt).slice(0, 10),
    generatedOn: generatedAt.toISOString().slice(0, 10),
    privateNotesNotice: 'Private notes are not included.',
    ...(parsedSummary.success
      ? {
        summary: {
          snapshotLabel: summarySnapshotLabel(meeting, parsedSummary.data.followThrough?.sourceFingerprint),
          ...(parsedSummary.data.followThrough ? {
            observations: parsedSummary.data.followThrough.observations.map((observation) => ({
              title: observation.title,
              explanation: observation.explanation,
              question: observation.question,
              reviewHorizonLabel: reviewHorizonLabel(observation.reviewHorizon),
              sources: observation.sourceRefs.map((source) => `Source (${source.kind}): ${source.label}`),
            })),
          } : {}),
          shortSummary: parsedSummary.data.shortSummary,
          mainTopics: parsedSummary.data.mainTopics,
          keyTensions: parsedSummary.data.keyTensions,
          agreements: parsedSummary.data.agreements,
          tasks: parsedSummary.data.tasks.map((task) => ({
            title: task.title,
            ...(task.responsibleParticipantIds
              ? {
                responsible: namesForParticipantIds(
                  task.responsibleParticipantIds,
                  participantNames,
                ).join(', ') || undefined,
              }
              : {}),
            ...(task.dueDate ? { dueDate: task.dueDate } : {}),
            ...(task.status ? { status: task.status } : {}),
          })),
          suggestedNextMeetingFocus: parsedSummary.data.suggestedNextMeetingFocus,
        },
      }
      : {}),
    sections: sections.map((section, index) => ({
      title: section.title ?? `Section ${index + 1}`,
      ...(section.prompt ? { prompt: section.prompt } : {}),
      notes: section.notes.map((note) => ({
        ...(note.participantId && participantNames.get(note.participantId)
          ? { author: participantNames.get(note.participantId) }
          : {}),
        ...(note.createdAt ? { createdAt: note.createdAt } : {}),
        text: note.text,
      })),
      tasks: section.tasks.map((task) => toPdfTask(task, participantNames)),
      agreements: section.agreements.map((agreement) => ({
        text: agreement.text,
        ...(agreement.description ? { description: agreement.description } : {}),
        ...(namesForParticipantIds(agreement.participantIds, participantNames).length > 0
          ? { participants: namesForParticipantIds(agreement.participantIds, participantNames).join(', ') }
          : {}),
      })),
    })),
  };
}

function reviewHorizonLabel(horizon: 'beforeNextMeeting' | 'nextMeeting') {
  return horizon === 'beforeNextMeeting' ? 'Before the next meeting' : 'At the next meeting';
}

function summarySnapshotLabel(meeting: MeetingDto, fingerprint?: string) {
  if (!fingerprint) return 'Saved snapshot - freshness not verified.';
  return fingerprint === summarySourceFingerprint(meeting)
    ? 'Saved snapshot - matches the current shared meeting content.'
    : 'Saved snapshot - based on an earlier version of this meeting.';
}

export class ExportsService {
  constructor(
    private readonly repository: ExportsRepositoryPort,
    private readonly pdfRenderer: (document: MeetingPdfDocument) => Promise<Buffer> = renderMeetingPdf,
  ) {}

  static fromSupabase(supabase: SupabaseRepositoryClient) {
    return new ExportsService(new ExportsRepository(supabase));
  }

  async exportMeeting(
    auth: AuthContext | undefined,
    request: ExportMeetingRequestDto,
    now = new Date(),
  ): Promise<ExportMeetingResponseDto> {
    const context = requireMinimumRole(auth, 'adult_member');
    const meeting = await this.repository.findMeetingForExport(
      context.workspaceId,
      request.meetingId,
    );

    if (!meeting) {
      throw new ApiError(404, 'meeting_not_found', 'Meeting not found.');
    }

    const sections = sanitizeSections(meeting.sections);

    return {
      meetingId: meeting.id,
      format: request.format,
      contentType: request.format === 'markdown' ? 'text/markdown' : 'text/plain',
      filename: toFilename(meeting, request.format),
      content: buildExportContent(meeting, sections, request.format),
      generatedAt: now.toISOString(),
    };
  }

  async exportMeetingPdf(
    auth: AuthContext | undefined,
    request: ExportMeetingPdfRequestDto,
    now = new Date(),
  ) {
    const context = requireMinimumRole(auth, 'adult_member');
    const meeting = await this.repository.findMeetingForExport(
      context.workspaceId,
      request.meetingId,
    );

    if (!meeting) {
      throw new ApiError(404, 'meeting_not_found', 'Meeting not found.');
    }

    const sections = sanitizeSections(meeting.sections);
    const participantIds = participantIdsForExport(sections);
    const participantRows = await this.repository.listParticipantNamesForWorkspace(
      context.workspaceId,
      participantIds,
    );
    const participantNames = new Map(participantRows.map((participant) => [participant.id, participant.name]));

    return {
      filename: toPdfFilename(meeting),
      content: await this.pdfRenderer(buildPdfDocument(meeting, sections, participantNames, now)),
    };
  }
}

export { sanitizeSections as sanitizeMeetingSectionsForExport };
