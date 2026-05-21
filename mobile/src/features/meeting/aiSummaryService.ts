import type {
  Meeting,
  MeetingSection,
  MeetingSummary,
  MeetingSummaryTask,
} from './types'
import { generateAiMeetingSummary } from '@/shared/api/aiApi'
import { appConfig } from '@/shared/config/env'

export interface AiSummaryProvider {
  generateMeetingSummary(meeting: Meeting): Promise<MeetingSummary>
}

export const aiSummaryPromptContract = [
  'Write a short neutral summary.',
  'List the main topics discussed.',
  'List agreements made.',
  'List open tasks and responsible people.',
  'List topics to revisit next week.',
  'Stay practical and non-judgmental.',
  'Do not act as a therapist or decide who is right or wrong.',
  'Do not include diagnostic or psychological claims.',
] as const

const emptyTensions = ['No specific tensions were recorded in this meeting.']
const emptyAgreements = ['No agreements were recorded in this meeting.']
const emptyFocus = [
  'Review open tasks, confirm any new agreements, and revisit topics that still need a decision.',
]

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sectionHasContent(section: MeetingSection) {
  return (
    section.notes.length > 0 ||
    section.tasks.length > 0 ||
    section.agreements.length > 0
  )
}

function getMainTopics(meeting: Meeting) {
  const topics = meeting.sections
    .filter(sectionHasContent)
    .map((section) => section.title)

  return topics.length ? topics : ['No meeting topics were recorded.']
}

function getKeyTensions(meeting: Meeting) {
  const tensionsSection = meeting.sections.find(
    (section) => section.id === 'tensions',
  )

  const tensions =
    tensionsSection?.notes.map((note) => note.text.trim()).filter(Boolean) ?? []

  return tensions.length ? tensions : emptyTensions
}

function getAgreements(meeting: Meeting) {
  const agreements = meeting.sections
    .flatMap((section) => section.agreements)
    .map((agreement) => agreement.text.trim())
    .filter(Boolean)

  return agreements.length ? agreements : emptyAgreements
}

function getTasks(meeting: Meeting): MeetingSummaryTask[] {
  return meeting.sections.flatMap((section) =>
    section.tasks.map((task) => ({
      title: task.title,
      description: task.description,
      responsibilityType: task.responsibilityType,
      responsibleParticipantIds: task.responsibleParticipantIds,
      dueDate: task.dueDate,
      status: task.status,
    })),
  )
}

function getSuggestedNextMeetingFocus(
  meeting: Meeting,
  tasks: MeetingSummaryTask[],
) {
  const openTasks = tasks
    .filter((task) => task.status === 'open')
    .map((task) => `Check progress on "${task.title}".`)
  const plans = meeting.sections
    .find((section) => section.id === 'plans')
    ?.notes.map((note) => note.text.trim())
    .filter(Boolean)

  const focus = [...openTasks, ...(plans ?? [])]
  return focus.length ? focus : emptyFocus
}

function createShortSummary(
  mainTopics: string[],
  agreements: string[],
  tasks: MeetingSummaryTask[],
) {
  const topicLabel =
    mainTopics.length === 1 ? mainTopics[0] : mainTopics.slice(0, 3).join(', ')
  const agreementCount = agreements === emptyAgreements ? 0 : agreements.length

  return `This meeting covered ${topicLabel}. The notes show ${agreementCount} agreement${
    agreementCount === 1 ? '' : 's'
  } and ${tasks.length} task${tasks.length === 1 ? '' : 's'} to follow up.`
}

const localPlaceholderAiSummaryProvider: AiSummaryProvider = {
  async generateMeetingSummary(meeting) {
    const mainTopics = getMainTopics(meeting)
    const keyTensions = getKeyTensions(meeting)
    const agreements = getAgreements(meeting)
    const tasks = getTasks(meeting)

    return {
      id: createId('meeting-summary'),
      meetingId: meeting.id,
      shortSummary: createShortSummary(mainTopics, agreements, tasks),
      mainTopics,
      keyTensions,
      agreements,
      tasks,
      suggestedNextMeetingFocus: getSuggestedNextMeetingFocus(meeting, tasks),
      createdAt: new Date().toISOString(),
    }
  },
}

const backendAiSummaryProvider: AiSummaryProvider = {
  async generateMeetingSummary(meeting) {
    const response = await generateAiMeetingSummary({
      meeting,
      promptContract: aiSummaryPromptContract,
    })

    return response.summary
  },
}

let aiSummaryProvider: AiSummaryProvider | null = null

export function setAiSummaryProvider(provider: AiSummaryProvider) {
  aiSummaryProvider = provider
}

export function generateMeetingSummary(meeting: Meeting) {
  const provider =
    aiSummaryProvider ??
    (appConfig.isBackendApiEnabled
      ? backendAiSummaryProvider
      : localPlaceholderAiSummaryProvider)

  return provider.generateMeetingSummary(meeting)
}
