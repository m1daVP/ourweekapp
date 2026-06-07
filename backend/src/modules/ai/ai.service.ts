import { createHash, randomUUID } from 'node:crypto';

import { requireMinimumRole, type AuthContext } from '../../shared/auth/index.js';
import { ApiError, isApiError } from '../../shared/errors/index.js';
import type { JsonValue } from '../../shared/repositories/index.js';
import { MeetingsRepository, type MeetingDto as MeetingRepositoryDto } from '../meetings/meetings.repository.js';
import { meetingSummarySchema, type AiMeetingSummaryRequestDto } from './ai.schema.js';
import { AiRepository } from './ai.repository.js';
import type { AiSummaryProvider } from './openai.client.js';

const DEFAULT_AI_MODEL = 'gpt-4.1-mini';
const AI_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const AI_RATE_LIMIT_PER_USER = 5;
const AI_RATE_LIMIT_PER_WORKSPACE = 20;
const AI_SUMMARY_INPUT_MAX_CHARS = 12_000;
const AI_SUMMARY_DISCLAIMER =
  'AI summaries can miss context. Please review before relying on them.';

type AiRepositoryPort = Pick<
  AiRepository,
  | 'createSummaryRequest'
  | 'markSummaryRequestCompleted'
  | 'markSummaryRequestFailed'
  | 'countRecentSummaryRequestsForWorkspace'
  | 'countRecentSummaryRequestsForUserInWorkspace'
>;

type MeetingsRepositoryPort = Pick<
  MeetingsRepository,
  'findMeetingByIdForWorkspace' | 'updateMeetingSummary'
>;

type AiSummaryServiceOptions = {
  aiConfigured?: boolean;
  model?: string;
  providerName?: string;
};

type SanitizedMeetingSection = {
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

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function shortHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

  const notes: SanitizedMeetingSection['notes'] = [];

  for (const item of value) {
    if (!isJsonObject(item)) {
      continue;
    }

    if (isPrivateNote(item)) {
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

  const tasks: SanitizedMeetingSection['tasks'] = [];

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

  const agreements: SanitizedMeetingSection['agreements'] = [];

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

function sanitizeSectionsForAi(sections: JsonValue[]): SanitizedMeetingSection[] {
  const sanitized: SanitizedMeetingSection[] = [];

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

function buildPromptPayload(meeting: MeetingRepositoryDto, locale?: string) {
  const payload = {
    meeting: {
      id: meeting.id,
      title: meeting.title,
      status: meeting.status,
      participantIds: meeting.participantIds,
      completedAt: meeting.completedAt,
      sections: sanitizeSectionsForAi(meeting.sections),
    },
    locale: locale ?? 'en',
  };
  const serialized = JSON.stringify(payload);

  if (serialized.length > AI_SUMMARY_INPUT_MAX_CHARS) {
    throw new ApiError(
      422,
      'ai_summary_input_too_large',
      'Meeting content is too large to summarize safely.',
      { limit: AI_SUMMARY_INPUT_MAX_CHARS },
    );
  }

  return serialized;
}

function buildSystemPrompt() {
  return [
    'You summarize family or couple meeting notes for a mobile app.',
    'Return only valid JSON matching this shape:',
    '{"shortSummary":string,"mainTopics":string[],"keyTensions":string[],"agreements":string[],"tasks":[{"title":string,"responsibleParticipantIds"?:string[],"dueDate"?:string}],"suggestedNextMeetingFocus":string[]}',
    'Keep output neutral, short, practical, and non-judgmental.',
    'Do not diagnose people, assign blame, provide therapy, or make psychological claims.',
    'Do not mention private notes.',
  ].join('\n');
}

function buildUserPrompt(promptPayload: string) {
  return [
    'Summarize this meeting content.',
    'Use only the provided content.',
    'Prefer concise lists.',
    promptPayload,
  ].join('\n\n');
}

export class AiSummaryService {
  constructor(
    private readonly aiRepository: AiRepositoryPort,
    private readonly meetingsRepository: MeetingsRepositoryPort,
    private readonly provider: AiSummaryProvider,
    private readonly options: AiSummaryServiceOptions = {},
  ) {}

  async generateMeetingSummary(
    auth: AuthContext,
    request: AiMeetingSummaryRequestDto,
    now = new Date(),
  ) {
    requireMinimumRole(auth, 'adult_member');

    if (this.options.aiConfigured === false) {
      throw new ApiError(
        503,
        'ai_provider_not_configured',
        'AI summaries are not available right now.',
      );
    }

    await this.requireWithinRateLimits(auth, now);

    const meeting = await this.meetingsRepository.findMeetingByIdForWorkspace(
      auth.workspaceId,
      request.meetingId,
    );

    if (!meeting) {
      throw new ApiError(404, 'meeting_not_found', 'Meeting not found.');
    }

    const promptPayload = buildPromptPayload(meeting, request.locale);
    const createdAt = now.toISOString();
    const summaryRequest = await this.aiRepository.createSummaryRequest({
        workspaceId: auth.workspaceId,
        userId: auth.userId,
        meetingId: meeting.id,
        provider: this.options.providerName ?? 'openai',
        status: 'pending',
        inputHash: shortHash(promptPayload),
      });

    try {
      await this.requireReservedRequestWithinRateLimits(
        auth,
        now,
      );

      const providerOutput = await this.provider.generateMeetingSummary({
        systemPrompt: buildSystemPrompt(),
        userPrompt: buildUserPrompt(promptPayload),
        model: this.options.model ?? DEFAULT_AI_MODEL,
      });
      const summary = meetingSummarySchema.parse({
        ...(isRecord(providerOutput) ? providerOutput : {}),
        id: randomUUID(),
        meetingId: meeting.id,
        createdAt,
      });
      const updated = await this.meetingsRepository.updateMeetingSummary(
        auth.workspaceId,
        meeting.id,
        toJsonValue(summary),
      );

      if (!updated) {
        throw new ApiError(
          409,
          'meeting_update_conflict',
          'Meeting changed while saving summary.',
        );
      }

      await this.aiRepository.markSummaryRequestCompleted(
        auth.workspaceId,
        summaryRequest.id,
        now.toISOString(),
      );

      return {
        summary,
        disclaimer: AI_SUMMARY_DISCLAIMER,
        generatedAt: createdAt,
      };
    } catch (error) {
      const errorCode = isApiError(error)
        ? error.code
        : 'ai_summary_generation_failed';

      await this.aiRepository.markSummaryRequestFailed(
        auth.workspaceId,
        summaryRequest.id,
        now.toISOString(),
        errorCode,
      );

      if (isApiError(error)) {
        throw error;
      }

      throw new ApiError(
        503,
        'ai_summary_generation_failed',
        'AI summaries are not available right now.',
      );
    }
  }

  private async requireWithinRateLimits(auth: AuthContext, now: Date) {
    const since = new Date(now.getTime() - AI_RATE_LIMIT_WINDOW_MS).toISOString();
    const [workspaceCount, userCount] = await Promise.all([
      this.aiRepository.countRecentSummaryRequestsForWorkspace(auth.workspaceId, since),
      this.aiRepository.countRecentSummaryRequestsForUserInWorkspace(
        auth.workspaceId,
        auth.userId,
        since,
      ),
    ]);

    if (
      workspaceCount >= AI_RATE_LIMIT_PER_WORKSPACE ||
      userCount >= AI_RATE_LIMIT_PER_USER
    ) {
      throw new ApiError(
        429,
        'ai_summary_rate_limited',
        'Please wait before generating another AI summary.',
        {
          userLimit: AI_RATE_LIMIT_PER_USER,
          workspaceLimit: AI_RATE_LIMIT_PER_WORKSPACE,
          windowSeconds: AI_RATE_LIMIT_WINDOW_MS / 1000,
        },
      );
    }
  }

  private async requireReservedRequestWithinRateLimits(
    auth: AuthContext,
    now: Date,
  ) {
    const since = new Date(now.getTime() - AI_RATE_LIMIT_WINDOW_MS).toISOString();
    const [workspaceCount, userCount] = await Promise.all([
      this.aiRepository.countRecentSummaryRequestsForWorkspace(auth.workspaceId, since),
      this.aiRepository.countRecentSummaryRequestsForUserInWorkspace(
        auth.workspaceId,
        auth.userId,
        since,
      ),
    ]);

    if (
      workspaceCount <= AI_RATE_LIMIT_PER_WORKSPACE &&
      userCount <= AI_RATE_LIMIT_PER_USER
    ) {
      return;
    }

    throw new ApiError(
      429,
      'ai_summary_rate_limited',
      'Please wait before generating another AI summary.',
      {
        userLimit: AI_RATE_LIMIT_PER_USER,
        workspaceLimit: AI_RATE_LIMIT_PER_WORKSPACE,
        windowSeconds: AI_RATE_LIMIT_WINDOW_MS / 1000,
      },
    );
  }
}

export function createDefaultAiSummaryService(
  supabase: ConstructorParameters<typeof AiRepository>[0],
  provider: AiSummaryProvider,
  options: AiSummaryServiceOptions,
) {
  return new AiSummaryService(
    new AiRepository(supabase),
    new MeetingsRepository(supabase),
    provider,
    options,
  );
}
