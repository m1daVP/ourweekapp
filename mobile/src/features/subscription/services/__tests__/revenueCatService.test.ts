import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configure: vi.fn(),
  getCustomerInfo: vi.fn(),
  logIn: vi.fn(),
  logOut: vi.fn(),
  presentCustomerCenter: vi.fn(),
  presentPaywallIfNeeded: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
  setLogLevel: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
    isNativePlatform: () => true,
  },
}));

vi.mock('@revenuecat/purchases-capacitor', () => ({
  LOG_LEVEL: { DEBUG: 'DEBUG', INFO: 'INFO' },
  PAYWALL_RESULT: { PURCHASED: 'PURCHASED', RESTORED: 'RESTORED' },
  Purchases: {
    configure: mocks.configure,
    getCustomerInfo: mocks.getCustomerInfo,
    logIn: mocks.logIn,
    logOut: mocks.logOut,
    purchasePackage: mocks.purchasePackage,
    restorePurchases: mocks.restorePurchases,
    setLogLevel: mocks.setLogLevel,
  },
}));

vi.mock('@revenuecat/purchases-capacitor-ui', () => ({
  RevenueCatUI: {
    presentCustomerCenter: mocks.presentCustomerCenter,
    presentPaywallIfNeeded: mocks.presentPaywallIfNeeded,
  },
}));

vi.mock('@/shared/config/env', () => ({
  appConfig: {
    revenueCatAndroidApiKey: 'android-public-key',
    revenueCatIosApiKey: '',
    revenueCatEntitlementId: 'OurWeek Premium',
  },
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

async function loadService() {
  return import('@/features/subscription/services/revenueCatService');
}

describe('RevenueCat customer identity', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.configure.mockResolvedValue(undefined);
    mocks.setLogLevel.mockResolvedValue(undefined);
  });

  it('waits for workspace login before purchasing', async () => {
    const login = deferred<void>();
    mocks.logIn.mockReturnValue(login.promise);
    mocks.purchasePackage.mockResolvedValue({});
    const service = await loadService();

    const identity = service.logInRevenueCat(
      '11111111-1111-4111-8111-111111111111'
    );
    await vi.waitFor(() => expect(mocks.logIn).toHaveBeenCalledOnce());

    const purchase = service.purchasePackage({
      product: { identifier: 'yearly' },
    } as never);
    await Promise.resolve();
    expect(mocks.purchasePackage).not.toHaveBeenCalled();

    login.resolve();
    await identity;
    await purchase;
    expect(mocks.purchasePackage).toHaveBeenCalledOnce();
  });

  it('does not purchase when workspace login fails', async () => {
    mocks.logIn.mockRejectedValue(new Error('identity unavailable'));
    const service = await loadService();
    const identity = service.logInRevenueCat(
      '11111111-1111-4111-8111-111111111111'
    );

    await expect(identity).rejects.toThrow('identity unavailable');
    await expect(
      service.purchasePackage({
        product: { identifier: 'yearly' },
      } as never)
    ).rejects.toThrow('identity unavailable');
    expect(mocks.purchasePackage).not.toHaveBeenCalled();
  });

  it('gates restore, customer info, paywall, and customer center', async () => {
    const login = deferred<void>();
    mocks.logIn.mockReturnValue(login.promise);
    mocks.restorePurchases.mockResolvedValue({});
    mocks.getCustomerInfo.mockResolvedValue({ customerInfo: {} });
    mocks.presentPaywallIfNeeded.mockResolvedValue({ result: 'PURCHASED' });
    mocks.presentCustomerCenter.mockResolvedValue(undefined);
    const service = await loadService();

    const identity = service.logInRevenueCat(
      '11111111-1111-4111-8111-111111111111'
    );
    await vi.waitFor(() => expect(mocks.logIn).toHaveBeenCalledOnce());

    const operations = [
      service.restoreRevenueCatPurchases(),
      service.getRevenueCatCustomerInfo(),
      service.presentPremiumPaywall(),
      service.presentRevenueCatCustomerCenter(),
    ];
    await Promise.resolve();
    expect(mocks.restorePurchases).not.toHaveBeenCalled();
    expect(mocks.getCustomerInfo).not.toHaveBeenCalled();
    expect(mocks.presentPaywallIfNeeded).not.toHaveBeenCalled();
    expect(mocks.presentCustomerCenter).not.toHaveBeenCalled();

    login.resolve();
    await identity;
    await Promise.all(operations);
    expect(mocks.restorePurchases).toHaveBeenCalledOnce();
    expect(mocks.getCustomerInfo).toHaveBeenCalledOnce();
    expect(mocks.presentPaywallIfNeeded).toHaveBeenCalledOnce();
    expect(mocks.presentCustomerCenter).toHaveBeenCalledOnce();
  });

  it('waits for the newest workspace identity across logout and login', async () => {
    const logout = deferred<void>();
    const secondLogin = deferred<void>();
    mocks.logIn
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(secondLogin.promise);
    mocks.logOut.mockReturnValue(logout.promise);
    mocks.purchasePackage.mockResolvedValue({});
    const service = await loadService();

    await service.logInRevenueCat('11111111-1111-4111-8111-111111111111');
    const logoutOperation = service.logOutRevenueCat();
    const nextIdentity = service.logInRevenueCat(
      '22222222-2222-4222-8222-222222222222'
    );
    const purchase = service.purchasePackage({
      product: { identifier: 'yearly' },
    } as never);

    await vi.waitFor(() => expect(mocks.logOut).toHaveBeenCalledOnce());
    logout.resolve();
    await logoutOperation;
    await vi.waitFor(() => expect(mocks.logIn).toHaveBeenCalledTimes(2));
    expect(mocks.purchasePackage).not.toHaveBeenCalled();

    secondLogin.resolve();
    await nextIdentity;
    await purchase;
    expect(mocks.purchasePackage).toHaveBeenCalledOnce();
  });
});
