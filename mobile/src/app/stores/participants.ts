import { defineStore } from 'pinia';
import { translate } from '@/features/localization/i18n';
import {
  readStorageSlice,
  writeStorageSlice,
} from '@/shared/services/storageService';
import type {
  Participant,
  ParticipantType,
} from '@/features/participants/types';

export const participantColors = [
  '#496a8f',
  '#6b8f71',
  '#9b6b52',
  '#8a6f9b',
  '#b07a48',
  '#5f7f82',
];

interface ParticipantsState {
  participants: Participant[];
}

interface CreateParticipantPayload {
  name: string;
  initials?: string;
  avatarColor?: string;
  type: ParticipantType;
}

interface UpdateParticipantPayload {
  name?: string;
  initials?: string;
  avatarColor?: string;
  type?: ParticipantType;
  isActive?: boolean;
}

interface LegacyParticipant {
  id?: string;
  name?: string;
  initials?: string;
  avatarColor?: string;
  type?: ParticipantType;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  void prefix;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (!words.length) {
    return '?';
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function createParticipant(
  name: string,
  type: ParticipantType,
  index: number
): Participant {
  const createdAt = nowIso();

  return {
    id: createId('person'),
    name,
    initials: getInitials(name),
    avatarColor: participantColors[index % participantColors.length],
    type,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  };
}

function createDefaultParticipants() {
  return [
    createParticipant(translate('settings.defaultParticipant.me'), 'adult', 0),
    createParticipant(
      translate('settings.defaultParticipant.partner'),
      'adult',
      1
    ),
  ];
}

function normalizeParticipant(
  participant: LegacyParticipant,
  index: number
): Participant | null {
  const name = participant.name?.trim();

  if (!name) {
    return null;
  }

  const createdAt = participant.createdAt ?? nowIso();

  return {
    id: participant.id ?? createId('person'),
    name,
    initials: (participant.initials?.trim() || getInitials(name))
      .slice(0, 3)
      .toUpperCase(),
    avatarColor:
      participant.avatarColor ??
      participantColors[index % participantColors.length],
    type: participant.type ?? 'adult',
    isActive: participant.isActive ?? true,
    createdAt,
    updatedAt: participant.updatedAt ?? createdAt,
  };
}

function getLegacyMeetingParticipants() {
  const meetingsState = readStorageSlice<{
    meetings?: Array<{ participants?: LegacyParticipant[] }>;
  }>('meetings', {});
  const participantsById = new Map<string, LegacyParticipant>();

  for (const meeting of meetingsState.meetings ?? []) {
    for (const participant of meeting.participants ?? []) {
      if (participant.id && participant.name) {
        participantsById.set(participant.id, participant);
      }
    }
  }

  return [...participantsById.values()];
}

function getStoredState(): ParticipantsState {
  const storedState = readStorageSlice<Partial<ParticipantsState> | null>(
    'participants',
    null
  );

  if (!storedState) {
    const legacyParticipants = getLegacyMeetingParticipants()
      .map(normalizeParticipant)
      .filter((participant): participant is Participant =>
        Boolean(participant)
      );

    return {
      participants: legacyParticipants.length
        ? legacyParticipants
        : createDefaultParticipants(),
    };
  }

  const participants = Array.isArray(storedState.participants)
    ? storedState.participants
        .map(normalizeParticipant)
        .filter((participant): participant is Participant =>
          Boolean(participant)
        )
    : [];

  return {
    participants: participants.length
      ? participants
      : createDefaultParticipants(),
  };
}

export const useParticipantsStore = defineStore('participants', {
  state: (): ParticipantsState => getStoredState(),
  getters: {
    activeParticipants: (state) =>
      state.participants.filter((participant) => participant.isActive),
    getParticipantById: (state) => (participantId: string) =>
      state.participants.find(
        (participant) => participant.id === participantId
      ) ?? null,
  },
  actions: {
    persist() {
      writeStorageSlice('participants', { participants: this.participants });
    },
    ensureDefaultParticipants() {
      if (this.participants.length) {
        return;
      }

      this.participants = createDefaultParticipants();
      this.persist();
    },
    createParticipant(payload: CreateParticipantPayload) {
      const name = payload.name.trim();

      if (!name) {
        return null;
      }

      const createdAt = nowIso();
      const participant: Participant = {
        id: createId('person'),
        name,
        initials: (payload.initials?.trim() || getInitials(name))
          .slice(0, 3)
          .toUpperCase(),
        avatarColor:
          payload.avatarColor ??
          participantColors[
            this.participants.length % participantColors.length
          ],
        type: payload.type,
        isActive: true,
        createdAt,
        updatedAt: createdAt,
      };

      this.participants.push(participant);
      this.persist();
      return participant;
    },
    updateParticipant(
      participantId: string,
      payload: UpdateParticipantPayload
    ) {
      const participant = this.participants.find(
        (item) => item.id === participantId
      );

      if (!participant) {
        return null;
      }

      const name = payload.name?.trim();
      const initials = payload.initials?.trim();

      if (payload.name !== undefined) {
        if (!name) {
          return null;
        }

        participant.name = name;
        participant.initials = initials
          ? initials.slice(0, 3).toUpperCase()
          : getInitials(name);
      }

      if (payload.initials !== undefined && payload.name === undefined) {
        participant.initials = (initials || getInitials(participant.name))
          .slice(0, 3)
          .toUpperCase();
      }

      if (payload.avatarColor !== undefined) {
        participant.avatarColor = payload.avatarColor;
      }

      if (payload.type !== undefined) {
        participant.type = payload.type;
      }

      if (payload.isActive !== undefined) {
        participant.isActive = payload.isActive;
      }

      participant.updatedAt = nowIso();
      this.persist();
      return participant;
    },
    disableParticipant(participantId: string) {
      return this.updateParticipant(participantId, { isActive: false });
    },
    enableParticipant(participantId: string) {
      return this.updateParticipant(participantId, { isActive: true });
    },
    removeParticipant(participantId: string) {
      const originalLength = this.participants.length;
      this.participants = this.participants.filter(
        (participant) => participant.id !== participantId
      );

      if (this.participants.length !== originalLength) {
        this.persist();
      }
    },
  },
});
