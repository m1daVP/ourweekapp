import type { SubscriptionProviderDto } from './billing.schema.js';

export type RevenueCatEntitlement = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  product_identifier?: string | null;
  purchase_date?: string | null;
};

export type RevenueCatSubscriber = {
  entitlements?: Record<string, RevenueCatEntitlement>;
  management_url?: string | null;
  original_app_user_id?: string | null;
};

export type RevenueCatCustomerInfo = {
  request_date?: string;
  subscriber?: RevenueCatSubscriber;
};

export type PostReceiptInput = {
  appUserId: string;
  fetchToken: string;
  productId: string;
  provider: SubscriptionProviderDto;
};

export class RevenueCatClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'RevenueCatClientError';
  }
}

function platformForProvider(provider: SubscriptionProviderDto) {
  if (provider === 'google_play') {
    return 'android';
  }

  if (provider === 'app_store') {
    return 'ios';
  }

  return undefined;
}

function unwrapCustomerInfo(payload: unknown): RevenueCatCustomerInfo {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  if ('subscriber' in payload) {
    return payload as RevenueCatCustomerInfo;
  }

  if ('value' in payload) {
    const value = (payload as { value?: unknown }).value;

    if (value && typeof value === 'object') {
      return value as RevenueCatCustomerInfo;
    }
  }

  return {};
}

export class RevenueCatClient {
  constructor(
    private readonly apiKey = '',
    private readonly baseUrl = 'https://api.revenuecat.com/v1',
  ) {}

  get configured() {
    return this.apiKey.length > 0;
  }

  async getSubscriber(
    appUserId: string,
    provider?: SubscriptionProviderDto,
  ): Promise<RevenueCatCustomerInfo> {
    return this.request(`subscribers/${encodeURIComponent(appUserId)}`, {
      platform: provider ? platformForProvider(provider) : undefined,
    });
  }

  async postReceipt(input: PostReceiptInput): Promise<RevenueCatCustomerInfo> {
    return this.request('receipts', {
      method: 'POST',
      platform: platformForProvider(input.provider),
      body: {
        app_user_id: input.appUserId,
        fetch_token: input.fetchToken,
        product_id: input.productId,
      },
    });
  }

  private async request(
    path: string,
    options: {
      method?: 'GET' | 'POST';
      platform?: string;
      body?: Record<string, unknown>;
    } = {},
  ): Promise<RevenueCatCustomerInfo> {
    if (!this.configured) {
      throw new RevenueCatClientError('RevenueCat is not configured.');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (options.platform) {
      headers['X-Platform'] = options.platform;
    }

    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new RevenueCatClientError(
        `RevenueCat request failed with status ${response.status}.`,
        response.status,
      );
    }

    return unwrapCustomerInfo(await response.json());
  }
}
