import { requireMinimumRole, type AuthContext } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import type { JsonValue, SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import type { MeetingDto } from '../meetings/meetings.repository.js';
import { ExportsRepository } from './exports.repository.js';
import type {
  ExportMeetingRequestDto,
  ExportMeetingResponseDto,
  MeetingExportFormatDto,
} from './exports.schema.js';

type ExportsRepositoryPort = Pick<ExportsRepository, 'findMeetingForExport'>;

type ExportSection = {
  title?: string;
  prompt?: string;
  notes: Array<{ participantId?: string; text: string }>;
  tasks: Array<{
    title: string;
    description?: string;
    responsibleParticipantIds?: string[];
    dueDate?: string;
    status?: string;
  }>;
  agreements: Array<{
    title: string;
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

function isPrivateNote(value: { [key: string]: JsonValue }) {
  return (
    value.private === true ||
    value.isPrivate === true ||
    value.visibility === 'private' ||
    value.type === 'private'
  );
}

function sanitizeNotes(value: JsonValue | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  const notes: ExportSection['notes'] = [];

  for (const item of value) {
    if (!isJsonObject(item) || isPrivateNote(item)) {
      continue;
    }

    const text = trimmedString(item.text);

    if (!text) {
      continue;
    }

    const participantId = trimmedString(item.participantId);

    notes.push({
      ...(participantId ? { participantId } : {}),
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
    const status = trimmedString(item.status);

    tasks.push({
      title,
      ...(description ? { description } : {}),
      ...(responsibleParticipantIds ? { responsibleParticipantIds } : {}),
      ...(dueDate ? { dueDate } : {}),
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

    const title = trimmedString(item.title);

    if (!title) {
      continue;
    }

    const description = trimmedString(item.description);
    const participantIds = stringArray(item.participantIds);

    agreements.push({
      title,
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
              ? `${agreement.title} (${details.join('; ')})`
              : agreement.title,
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

export class ExportsService {
  constructor(private readonly repository: ExportsRepositoryPort) {}

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
}

export { sanitizeSections as sanitizeMeetingSectionsForExport };
