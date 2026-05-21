import type { Meeting, MeetingSummary } from '@/features/meeting/types'
import { apiRequest, isBackendApiConfigured } from './httpClient'

export interface GenerateMeetingSummaryRequestDto {
  meeting: Meeting
  promptContract: readonly string[]
}

export interface GenerateMeetingSummaryResponseDto {
  summary: MeetingSummary
  disclaimer: string
  generatedAt: string
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createMockSummary(meeting: Meeting): MeetingSummary {
  const tasks = meeting.sections.flatMap((section) =>
    section.tasks.map((task) => ({
      title: task.title,
      description: task.description,
      responsibilityType: task.responsibilityType,
      responsibleParticipantIds: task.responsibleParticipantIds,
      dueDate: task.dueDate,
      status: task.status,
    })),
  )
  const agreements = meeting.sections
    .flatMap((section) => section.agreements)
    .map((agreement) => agreement.text)

  return {
    id: createId('meeting-summary'),
    meetingId: meeting.id,
    shortSummary:
      'This local mock summary is a placeholder until backend AI summaries are connected.',
    mainTopics: meeting.sections
      .filter(
        (section) =>
          section.notes.length ||
          section.tasks.length ||
          section.agreements.length,
      )
      .map((section) => section.title),
    keyTensions: [],
    agreements,
    tasks,
    suggestedNextMeetingFocus: tasks
      .filter((task) => task.status === 'open')
      .map((task) => `Check progress on "${task.title}".`),
    createdAt: new Date().toISOString(),
  }
}

export async function generateAiMeetingSummary(
  payload: GenerateMeetingSummaryRequestDto,
): Promise<GenerateMeetingSummaryResponseDto> {
  if (!isBackendApiConfigured()) {
    return {
      summary: createMockSummary(payload.meeting),
      disclaimer:
        'AI summaries may be inaccurate. Review before relying on them.',
      generatedAt: new Date().toISOString(),
    }
  }

  return apiRequest<GenerateMeetingSummaryResponseDto>('/ai/meeting-summary', {
    method: 'POST',
    body: payload,
  })
}
