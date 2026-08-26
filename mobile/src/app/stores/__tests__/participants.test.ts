import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useParticipantsStore } from '@/app/stores/participants';

const mocks = vi.hoisted(() => ({
  storedParticipants: null as unknown,
  writeStorageSlice: vi.fn(),
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) =>
    key === 'settings.defaultParticipant.me'
      ? 'Me'
      : key === 'settings.defaultParticipant.partner'
        ? 'Partner'
        : key,
}));

vi.mock('@/shared/services/storageService', () => ({
  readStorageSlice: (key: string, fallback: unknown) =>
    key === 'participants' ? (mocks.storedParticipants ?? fallback) : fallback,
  writeStorageSlice: mocks.writeStorageSlice,
}));

function participant(
  id: string,
  name: string,
  type: 'adult' | 'child' = 'adult',
  isActive = true
) {
  return {
    id,
    name,
    initials: name.slice(0, 1).toUpperCase(),
    avatarColor: '#496a8f',
    type,
    isActive,
    createdAt: '2026-08-12T08:00:00.000Z',
    updatedAt: '2026-08-12T08:00:00.000Z',
  };
}

beforeEach(() => {
  mocks.storedParticipants = null;
  mocks.writeStorageSlice.mockReset();
  setActivePinia(createPinia());
});

describe('participants store current participant identity', () => {
  it('keeps fresh state empty until backend hydration', () => {
    const store = useParticipantsStore();

    expect(store.participants).toEqual([]);
    expect(store.currentParticipantId).toBeNull();
  });

  it('applies hydrated participants and selects the first active adult', () => {
    const store = useParticipantsStore();
    const hydratedParticipants = [
      participant('self-1', 'Rita'),
      participant('adult-2', 'Alex'),
    ];

    store.applyParticipants(hydratedParticipants);

    expect(store.participants).toEqual(hydratedParticipants);
    expect(store.currentParticipantId).toBe('self-1');
    expect(store.participants.map(({ name }) => name)).toEqual([
      'Rita',
      'Alex',
    ]);
    expect(mocks.writeStorageSlice).toHaveBeenLastCalledWith('participants', {
      participants: hydratedParticipants,
      currentParticipantId: 'self-1',
    });
  });

  it('keeps a valid stored identity after the participant is renamed', () => {
    mocks.storedParticipants = {
      participants: [
        participant('self-1', 'Rita'),
        participant('adult-2', 'Alex'),
      ],
      currentParticipantId: 'self-1',
    };
    const store = useParticipantsStore();

    store.updateParticipant('self-1', { name: 'Rita Nowak' });

    expect(store.currentParticipantId).toBe('self-1');
    expect(store.isCurrentParticipant('self-1')).toBe(true);
    expect(mocks.writeStorageSlice).toHaveBeenLastCalledWith('participants', {
      participants: store.participants,
      currentParticipantId: 'self-1',
    });
  });

  it('migrates a missing identity to the localized Me profile', () => {
    mocks.storedParticipants = {
      participants: [
        participant('adult-2', 'Alex'),
        participant('self-1', 'Me'),
      ],
    };

    expect(useParticipantsStore().currentParticipantId).toBe('self-1');
  });

  it('falls back to the first active adult when Me was already renamed', () => {
    mocks.storedParticipants = {
      participants: [
        participant('inactive', 'Old profile', 'adult', false),
        participant('self-1', 'Rita'),
        participant('adult-2', 'Alex'),
      ],
    };

    expect(useParticipantsStore().currentParticipantId).toBe('self-1');
  });

  it('uses an inactive adult only when no active adult exists', () => {
    mocks.storedParticipants = {
      participants: [participant('adult-1', 'Rita', 'adult', false)],
    };

    expect(useParticipantsStore().currentParticipantId).toBe('adult-1');
  });

  it('uses no current participant for child-only state', () => {
    mocks.storedParticipants = {
      participants: [participant('child-1', 'Sam', 'child')],
    };
    const store = useParticipantsStore();

    expect(store.currentParticipantId).toBeNull();
    expect(store.isCurrentParticipant('child-1')).toBe(false);
  });
});

describe('participants store household management list', () => {
  it('keeps hidden participants manageable after active participants', () => {
    mocks.storedParticipants = {
      participants: [
        participant('active-1', 'Rita'),
        participant('hidden-1', 'Alex', 'adult', false),
        participant('active-2', 'Sam', 'child'),
        {
          ...participant('deleted-1', 'Deleted'),
          deletedAt: '2026-08-12T09:00:00.000Z',
        },
      ],
      currentParticipantId: 'active-1',
    };

    const store = useParticipantsStore();

    expect(store.householdParticipants.map(({ id }) => id)).toEqual([
      'active-1',
      'active-2',
      'hidden-1',
    ]);
  });

  it('moves a restored participant back into the active group and persists it', () => {
    mocks.storedParticipants = {
      participants: [
        participant('active-1', 'Rita'),
        participant('hidden-1', 'Alex', 'adult', false),
      ],
      currentParticipantId: 'active-1',
    };
    const store = useParticipantsStore();

    store.enableParticipant('hidden-1');

    expect(store.getParticipantById('hidden-1')?.isActive).toBe(true);
    expect(store.householdParticipants.map(({ id }) => id)).toEqual([
      'active-1',
      'hidden-1',
    ]);
    expect(mocks.writeStorageSlice).toHaveBeenCalledWith('participants', {
      participants: store.participants,
      currentParticipantId: 'active-1',
    });
  });
});
