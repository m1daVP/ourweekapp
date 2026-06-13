export interface SyncableItem {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface ReviewDecisionLike {
  meetingId: string;
  sourceMeetingId: string;
  decidedAt: string;
}

function getItemTimestamp(item: SyncableItem) {
  return item.deletedAt ?? item.updatedAt ?? item.createdAt ?? '';
}

function isRemoteNewer<TItem extends SyncableItem>(
  localItem: TItem,
  remoteItem: TItem
) {
  return (
    new Date(getItemTimestamp(remoteItem)).getTime() >=
    new Date(getItemTimestamp(localItem)).getTime()
  );
}

function isDeletedNewer<TItem extends SyncableItem>(
  deletedItem: TItem,
  existingItem?: TItem
) {
  if (!deletedItem.deletedAt) {
    return false;
  }

  if (!existingItem) {
    return true;
  }

  return (
    new Date(deletedItem.deletedAt).getTime() >=
    new Date(getItemTimestamp(existingItem)).getTime()
  );
}

export function mergeSyncItems<TItem extends SyncableItem>(
  localItems: TItem[],
  remoteItems: TItem[]
) {
  const localById = new Map(localItems.map((item) => [item.id, item]));
  const remoteById = new Map(remoteItems.map((item) => [item.id, item]));
  const mergedItems: TItem[] = [];

  for (const id of new Set([...localById.keys(), ...remoteById.keys()])) {
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);

    if (remoteItem && isDeletedNewer(remoteItem, localItem)) {
      continue;
    }

    if (localItem?.deletedAt && isDeletedNewer(localItem, remoteItem)) {
      continue;
    }

    if (localItem && remoteItem) {
      mergedItems.push(
        isRemoteNewer(localItem, remoteItem) ? remoteItem : localItem
      );
      continue;
    }

    if (remoteItem) {
      mergedItems.push(remoteItem);
      continue;
    }

    if (localItem) {
      mergedItems.push(localItem);
    }
  }

  return mergedItems.filter((item) => !item.deletedAt);
}

export function mergeReviewDecisions<TDecision extends ReviewDecisionLike>(
  localItems: TDecision[],
  remoteItems: TDecision[]
) {
  const decisionsByKey = new Map<string, TDecision>();

  for (const decision of [...localItems, ...remoteItems]) {
    const key = `${decision.meetingId}:${decision.sourceMeetingId}`;
    const existingDecision = decisionsByKey.get(key);

    if (
      !existingDecision ||
      new Date(decision.decidedAt).getTime() >=
        new Date(existingDecision.decidedAt).getTime()
    ) {
      decisionsByKey.set(key, decision);
    }
  }

  return [...decisionsByKey.values()];
}
