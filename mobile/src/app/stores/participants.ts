import { defineStore } from 'pinia';
import { translate } from '@/features/localization/i18n';
import {
  readStorageSlice,
  writeStorageSlice,
} from '@/shared/services/storageService';
import { nowIso } from '@/shared/utils/dates';
import { createId } from '@/shared/utils/ids';
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
  currentParticipantId: string | null;
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
  serverRevision?: number;
  deletedAt?: string;
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

function getParticipantDisplayKey(participant: Participant) {
  return [
    participant.name.trim().toLocaleLowerCase(),
    participant.initials.trim().toLocaleUpperCase(),
    participant.avatarColor.trim().toLocaleLowerCase(),
    participant.type,
  ].join('|');
}

function uniqueParticipantsByDisplay(participants: Participant[]) {
  const seenKeys = new Set<string>();

  return participants.filter((participant) => {
    const key = getParticipantDisplayKey(participant);

    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
    return true;
  });
}

function isDefaultPlaceholderParticipant(participant: Participant) {
  if (participant.type !== 'adult') {
    return false;
  }

  const name = participant.name.trim().toLocaleLowerCase();

  return (
    name === translate('settings.defaultParticipant.me').toLocaleLowerCase() ||
    name ===
      translate('settings.defaultParticipant.partner').toLocaleLowerCase()
  );
}

function withoutStaleDefaultPlaceholders(participants: Participant[]) {
  const activeAdults = participants.filter(
    (participant) => participant.isActive && participant.type === 'adult'
  );
  const customAdultCount = activeAdults.filter(
    (participant) => !isDefaultPlaceholderParticipant(participant)
  ).length;
  const defaultPlaceholderCount = activeAdults.filter(
    isDefaultPlaceholderParticipant
  ).length;

  if (customAdultCount < 2 || defaultPlaceholderCount < 2) {
    return participants;
  }

  return participants.filter(
    (participant) => !isDefaultPlaceholderParticipant(participant)
  );
}

function createParticipant(
  name: string,
  type: ParticipantType,
  index: number
): Participant {
  const createdAt = nowIso();

  return {
    id: createId(),
    name,
    initials: getInitials(name),
    avatarColor: participantColors[index % participantColors.length],
    type,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  };
}

function createDefaultParticipantsState(): ParticipantsState {
  const me = createParticipant(
    translate('settings.defaultParticipant.me'),
    'adult',
    0
  );
  const partner = createParticipant(
    translate('settings.defaultParticipant.partner'),
    'adult',
    1
  );

  return {
    participants: [me, partner],
    currentParticipantId: me.id,
  };
}

function selectCurrentParticipantId(
  participants: Participant[],
  storedParticipantId?: string | null
) {
  const availableParticipants = participants.filter(
    (participant) => !participant.deletedAt
  );
  const storedParticipant = availableParticipants.find(
    (participant) => participant.id === storedParticipantId
  );

  if (storedParticipant) {
    return storedParticipant.id;
  }

  const meLabel = translate('settings.defaultParticipant.me')
    .trim()
    .toLocaleLowerCase();
  const namedMe = availableParticipants.find(
    (participant) =>
      participant.type === 'adult' &&
      participant.name.trim().toLocaleLowerCase() === meLabel
  );

  return (
    namedMe?.id ??
    availableParticipants.find(
      (participant) => participant.type === 'adult' && participant.isActive
    )?.id ??
    availableParticipants.find((participant) => participant.type === 'adult')
      ?.id ??
    null
  );
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
    id: participant.id ?? createId(),
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
    serverRevision: participant.serverRevision,
    deletedAt: participant.deletedAt,
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

    if (!legacyParticipants.length) {
      return createDefaultParticipantsState();
    }

    return {
      participants: legacyParticipants,
      currentParticipantId: selectCurrentParticipantId(legacyParticipants),
    };
  }

  const participants = Array.isArray(storedState.participants)
    ? storedState.participants
        .map(normalizeParticipant)
        .filter((participant): participant is Participant =>
          Boolean(participant)
        )
    : [];

  if (!participants.length) {
    return createDefaultParticipantsState();
  }

  return {
    participants,
    currentParticipantId: selectCurrentParticipantId(
      participants,
      storedState.currentParticipantId
    ),
  };
}

export const useParticipantsStore = defineStore('participants', {
  state: (): ParticipantsState => getStoredState(),
  getters: {
    householdParticipants: (state) => {
      const participants = state.participants.filter(
        (participant) => !participant.deletedAt
      );

      return [
        ...participants.filter((participant) => participant.isActive),
        ...participants.filter((participant) => !participant.isActive),
      ];
    },
    activeParticipants: (state) =>
      withoutStaleDefaultPlaceholders(
        uniqueParticipantsByDisplay(
          state.participants.filter(
            (participant) => participant.isActive && !participant.deletedAt
          )
        )
      ),
    getParticipantById: (state) => (participantId: string) =>
      state.participants.find(
        (participant) =>
          participant.id === participantId && !participant.deletedAt
      ) ?? null,
  },
  actions: {
    persist() {
      writeStorageSlice('participants', {
        participants: this.participants,
        currentParticipantId: this.currentParticipantId,
      });
    },
    ensureDefaultParticipants() {
      if (this.participants.length) {
        return;
      }

      const defaults = createDefaultParticipantsState();
      this.participants = defaults.participants;
      this.currentParticipantId = defaults.currentParticipantId;
      this.persist();
    },
    isCurrentParticipant(participantId: string) {
      return (
        Boolean(participantId) && this.currentParticipantId === participantId
      );
    },
    createParticipant(payload: CreateParticipantPayload) {
      const name = payload.name.trim();

      if (!name) {
        return null;
      }

      const createdAt = nowIso();
      const participant: Participant = {
        id: createId(),
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

      if (!participant || participant.deletedAt) {
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
      const participant = this.participants.find(
        (item) => item.id === participantId
      );

      if (!participant) {
        return;
      }

      const deletedAt = nowIso();
      participant.deletedAt = deletedAt;
      participant.updatedAt = deletedAt;
      participant.isActive = false;
      this.persist();
    },
  },
});
