import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubscriptionService } from '../src/modules/billing/billing.service.js';
import {
  assertFeatureAccess,
} from '../src/modules/billing/feature-access.js';
import { requireFeature } from '../src/modules/billing/require-feature.middleware.js';
import type {
  SubscriptionDto,
  SubscriptionRecord,
  UpsertSubscriptionInput,
} from '../src/modules/billing/subscriptions.repository.js';
import { RevenueCatClientError } from '../src/modules/billing/revenuecat.client.js';
import type { AuthContext } from '../src/shared/auth/index.js';

const now = '2026-06-06T10:00:00.000Z';
const future = '2026-07-06T10:00:00.000Z';
const past = '2026-05-06T10:00:00.000Z';
const staleCheckedAt = '2026-06-04T09:59:59.000Z';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
});

afterEach(() => {
  vi.useRealTimers();
});

const auth: AuthContext = {
  userId: 'user-1',
  sessionId: 'session-1',
  workspaceId: 'workspace-1',
  role: 'owner',
  planType: 'free',
};

const adultAuth: AuthContext = {
  ...auth,
  userId: 'adult-1',
  role: 'adult_member',
};

function subscription(
  overrides: Partial<SubscriptionDto> = {},
): SubscriptionDto {
  return {
    id: 'subscription-1',
    workspaceId: 'workspace-1',
    provider: 'revenuecat',
    planType: 'free',
    status: 'not_found',
    expiresAt: null,
    lastCheckedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakeSubscriptionRepository {
  public upserts: UpsertSubscriptionInput[] = [];

  constructor(
    public current: SubscriptionDto | null,
    private readonly byProvider = new Map<string, SubscriptionRecord>(),
  ) {}

  async findCurrentSubscriptionForWorkspace(_workspaceId: string) {
    return this.current;
  }

  async findProviderSubscriptionForWorkspace(
    _workspaceId: string,
    provider: SubscriptionRecord['provider'],
  ) {
    return this.byProvider.get(provider) ?? null;
  }

  async upsertSubscription(input: UpsertSubscriptionInput) {
    this.upserts.push(input);

    const saved: SubscriptionRecord = {
      id: input.id ?? 'subscription-1',
      workspaceId: input.workspaceId,
      provider: input.provider,
      providerCustomerId: input.providerCustomerId ?? null,
      providerEntitlementId: input.providerEntitlementId ?? null,
      planType: input.planType,
      status: input.status,
      expiresAt: input.expiresAt ?? null,
      lastCheckedAt: input.lastCheckedAt,
      createdAt: now,
      updatedAt: input.lastCheckedAt,
    };

    this.current = saved;
    this.byProvider.set(saved.provider, saved);

    return saved;
  }
}

class FakeRevenueCatClient {
  public getSubscriber = vi.fn();

  constructor(public configured: boolean) {}
}

function serviceWith(
  input: {
    repository?: FakeSubscriptionRepository;
    client?: FakeRevenueCatClient;
  } = {},
) {
  const repository = input.repository ?? new FakeSubscriptionRepository(null);
  const client = input.client ?? new FakeRevenueCatClient(false);

  return {
    repository,
    client,
    service: new SubscriptionService(repository, client, 'premium'),
  };
}

describe('SubscriptionService', () => {
  it('returns free features when no trusted entitlement exists', async () => {
    const { service } = serviceWith();

    const status = await service.getStatus(auth);

    expect(status).toMatchObject({
      planType: 'free',
      provider: null,
      expiresAt: null,
    });
    expect(status.enabledFeatures).toEqual([
      'basicMeetings',
      'defaultTemplate',
      'tasksAndAgreements',
      'manualResponsibility',
      'meetingHistory',
      'limitedHistory',
      'localReminders',
      'unlimitedHistory',
      'agreementReminders',
    ]);
    expect(status.features.aiSummary).toMatchObject({
      state: 'upgradeRequired',
      upgradeEligible: true,
    });
    expect(status.features.advancedStatistics).toMatchObject({
      state: 'upgradeRequired',
      upgradeEligible: true,
    });
    expect(status.enabledFeatures).not.toContain('aiSummary');
  });

  it('stores a workspace-level premium entitlement from RevenueCat', async () => {
    const client = new FakeRevenueCatClient(true);
    client.getSubscriber.mockResolvedValue({
      request_date: now,
      subscriber: {
        original_app_user_id: 'workspace-1',
        entitlements: {
          premium: {
            expires_date: future,
            product_identifier: 'weekly_us_premium_monthly',
            store: 'play_store',
          },
        },
      },
    });
    const { service, repository } = serviceWith({ client });

    const status = await service.getStatus(auth);

    expect(status).toMatchObject({
      planType: 'premium',
      provider: 'google_play',
      expiresAt: future,
      checkedAt: now,
    });
    expect(status.enabledFeatures).toContain('aiSummary');
    expect(repository.upserts).toEqual([
      expect.objectContaining({
        workspaceId: 'workspace-1',
        provider: 'google_play',
        providerCustomerId: 'workspace-1',
        providerEntitlementId: 'premium',
        planType: 'premium',
        status: 'active',
      }),
    ]);
  });

  it('downgrades expired RevenueCat entitlements to free features', async () => {
    const client = new FakeRevenueCatClient(true);
    client.getSubscriber.mockResolvedValue({
      request_date: now,
      subscriber: {
        original_app_user_id: 'workspace-1',
        entitlements: {
          premium: {
            expires_date: past,
            product_identifier: 'weekly_us_premium_monthly',
            store: 'app_store',
          },
        },
      },
    });
    const { service, repository } = serviceWith({ client });

    const status = await service.getStatus(auth);

    expect(status).toMatchObject({
      planType: 'free',
      provider: null,
      expiresAt: null,
      checkedAt: now,
    });
    expect(repository.upserts[0]).toMatchObject({
      provider: 'app_store',
      planType: 'free',
      status: 'expired',
      expiresAt: past,
    });
  });

  it('uses a recently checked cached premium record when status refresh fails', async () => {
    const client = new FakeRevenueCatClient(true);
    client.getSubscriber.mockRejectedValue(new Error('network unavailable'));
    const cached = subscription({
      provider: 'revenuecat',
      planType: 'premium',
      status: 'active',
      expiresAt: future,
      lastCheckedAt: now,
    });
    const { service } = serviceWith({
      client,
      repository: new FakeSubscriptionRepository(cached),
    });

    const status = await service.getStatus(auth);

    expect(status.planType).toBe('premium');
    expect(status.enabledFeatures).toContain('aiSummary');
  });

  it('returns free status instead of stale cached premium after the trust window', async () => {
    const cached = subscription({
      provider: 'revenuecat',
      planType: 'premium',
      status: 'active',
      expiresAt: future,
      lastCheckedAt: staleCheckedAt,
    });
    const { service } = serviceWith({
      repository: new FakeSubscriptionRepository(cached),
    });

    const status = await service.getStatus(auth);

    expect(status.planType).toBe('free');
    expect(status.enabledFeatures).toEqual(expect.arrayContaining([
      'meetingHistory',
      'limitedHistory',
      'unlimitedHistory',
    ]));
  });

  it('requires owner role for restore and manage actions', async () => {
    const { service, client } = serviceWith({
      client: new FakeRevenueCatClient(true),
    });

    await expect(
      service.restore(adultAuth, { provider: 'google_play' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'subscription_owner_required',
    });
    await expect(service.getManageUrl(adultAuth)).rejects.toMatchObject({
      statusCode: 403,
      code: 'subscription_owner_required',
    });
    expect(client.getSubscriber).not.toHaveBeenCalled();
  });

  it('maps RevenueCat restore outages to a safe provider error', async () => {
    const client = new FakeRevenueCatClient(true);
    client.getSubscriber.mockRejectedValue(
      new RevenueCatClientError('provider unavailable', 500),
    );
    const { service } = serviceWith({ client });

    await expect(
      service.restore(auth, { provider: 'google_play' }),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: 'subscription_provider_unavailable',
    });
  });

  it('returns free status when RevenueCat has no subscriber to restore', async () => {
    const client = new FakeRevenueCatClient(true);
    client.getSubscriber.mockRejectedValue(
      new RevenueCatClientError('subscriber not found', 404),
    );
    const { service, repository } = serviceWith({ client });

    await expect(
      service.restore(auth, { provider: 'google_play' }),
    ).resolves.toMatchObject({ planType: 'free', provider: null });
    expect(repository.upserts).toEqual([]);
  });

  it('restores and stores premium by workspace identity', async () => {
    const client = new FakeRevenueCatClient(true);
    client.getSubscriber.mockResolvedValue({
      request_date: now,
      subscriber: {
        original_app_user_id: 'workspace-1',
        entitlements: {
          premium: { expires_date: future, store: 'play_store' },
        },
      },
    });
    const { service, repository } = serviceWith({ client });

    await expect(
      service.restore(auth, { provider: 'google_play' }),
    ).resolves.toMatchObject({
      planType: 'premium',
      provider: 'google_play',
    });
    expect(client.getSubscriber).toHaveBeenCalledWith(
      'workspace-1',
      'google_play',
    );
    expect(repository.upserts[0]).toMatchObject({
      workspaceId: 'workspace-1',
      planType: 'premium',
    });
  });
});

describe('syncEntitlementForWorkspace', () => {
  const webhookNow = '2026-08-10T10:00:00.000Z';
  const webhookFuture = '2026-09-10T10:00:00.000Z';

  it('does nothing when RevenueCat is unconfigured', async () => {
    vi.setSystemTime(new Date(webhookNow));
    const { service, repository, client } = serviceWith();

    await expect(
      service.syncEntitlementForWorkspace('workspace-webhook'),
    ).resolves.toBeNull();
    expect(client.getSubscriber).not.toHaveBeenCalled();
    expect(repository.upserts).toEqual([]);
  });

  it('stores an active premium entitlement for the supplied workspace', async () => {
    vi.setSystemTime(new Date(webhookNow));
    const client = new FakeRevenueCatClient(true);
    client.getSubscriber.mockResolvedValue({
      request_date: webhookNow,
      subscriber: {
        original_app_user_id: 'workspace-webhook',
        entitlements: {
          premium: { expires_date: webhookFuture, store: 'play_store' },
        },
      },
    });
    const { service, repository } = serviceWith({ client });

    const status =
      await service.syncEntitlementForWorkspace('workspace-webhook');

    expect(status).toMatchObject({
      planType: 'premium',
      provider: 'google_play',
    });
    expect(repository.upserts[0]).toMatchObject({
      workspaceId: 'workspace-webhook',
      planType: 'premium',
      status: 'active',
    });
  });

  it('stores free status when no entitlement exists', async () => {
    vi.setSystemTime(new Date(webhookNow));
    const client = new FakeRevenueCatClient(true);
    client.getSubscriber.mockResolvedValue({
      request_date: webhookNow,
      subscriber: {
        original_app_user_id: 'workspace-webhook',
        entitlements: {},
      },
    });
    const { service, repository } = serviceWith({ client });

    const status =
      await service.syncEntitlementForWorkspace('workspace-webhook');

    expect(status).toMatchObject({ planType: 'free', provider: null });
    expect(repository.upserts[0]).toMatchObject({
      workspaceId: 'workspace-webhook',
      planType: 'free',
      status: 'not_found',
    });
  });
});
describe('requireFeature middleware helper', () => {
  it('allows recently verified premium entitlements', async () => {
    const repository = new FakeSubscriptionRepository(
      subscription({
        planType: 'premium',
        status: 'active',
        expiresAt: future,
        lastCheckedAt: now,
      }),
    );

    await expect(
      assertFeatureAccess(repository, auth, 'aiSummary', new Date(now)),
    ).resolves.toMatchObject({
      workspaceId: 'workspace-1',
    });
  });

  it('rejects viewers before checking premium feature entitlement', async () => {
    const repository = new FakeSubscriptionRepository(
      subscription({
        planType: 'premium',
        status: 'active',
        expiresAt: future,
        lastCheckedAt: now,
      }),
    );
    const middleware = requireFeature(repository, 'aiSummary');
    const lookup = vi.spyOn(repository, 'findCurrentSubscriptionForWorkspace');

    await expect(
      middleware(
        { auth: { ...auth, role: 'viewer' } } as Parameters<
          typeof middleware
        >[0],
        {} as Parameters<typeof middleware>[1],
        vi.fn(),
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'feature_role_restricted',
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('rejects adult members without trusted premium feature entitlement', async () => {
    const repository = new FakeSubscriptionRepository(null);
    const middleware = requireFeature(repository, 'aiSummary');

    await expect(
      middleware(
        { auth: adultAuth } as Parameters<typeof middleware>[0],
        {} as Parameters<typeof middleware>[1],
        vi.fn(),
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'premium_required',
    });
  });

  it('rejects stale premium auth contexts when entitlement is not recently verified', async () => {
    const repository = new FakeSubscriptionRepository(
      subscription({
        planType: 'premium',
        status: 'active',
        expiresAt: future,
        lastCheckedAt: staleCheckedAt,
      }),
    );

    await expect(
      assertFeatureAccess(
        repository,
        { ...auth, planType: 'premium' },
        'aiSummary',
        new Date(now),
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'premium_required',
    });
  });
});
