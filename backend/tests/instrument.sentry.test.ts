import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ init: vi.fn() }));
const runtimeEnv = vi.hoisted(() => ({
  APP_ENV: "test",
  SENTRY_DSN: undefined as string | undefined,
}));

vi.mock("@sentry/node", () => sentry);
vi.mock("../src/config/env.js", () => ({ env: runtimeEnv }));

describe("Sentry instrumentation", () => {
  beforeEach(() => {
    sentry.init.mockReset();
    runtimeEnv.APP_ENV = "test";
    runtimeEnv.SENTRY_DSN = undefined;
    vi.resetModules();
  });

  it("does not initialize when the DSN is absent", async () => {
    await import("../src/instrument.js");

    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("initializes once with final event and breadcrumb filtering when configured", async () => {
    runtimeEnv.SENTRY_DSN = "https://example.invalid/123";

    await import("../src/instrument.js");

    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeBreadcrumb: expect.any(Function),
        beforeSend: expect.any(Function),
        dsn: runtimeEnv.SENTRY_DSN,
        environment: "test",
        includeLocalVariables: false,
        tracesSampleRate: 0,
      }),
    );
    expect(sentry.init.mock.calls[0][0].beforeBreadcrumb({})).toBeNull();
  });
});
