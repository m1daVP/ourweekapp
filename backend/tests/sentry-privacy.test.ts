import { describe, expect, it } from "vitest";

import { sanitizeSentryEvent } from "../src/shared/logging/sentry-privacy.js";

describe("sanitizeSentryEvent", () => {
  it("removes secrets from exception, request, user, breadcrumbs, and extras", () => {
    const circularExtra: Record<string, unknown> = {};
    circularExtra.self = circularExtra;

    const output = sanitizeSentryEvent({
      breadcrumbs: [{ message: "private-note-SECRET" }],
      exception: {
        values: [
          {
            type: "Error",
            value: "private-note-SECRET",
            stacktrace: {
              frames: [
                {
                  filename:
                    "https://example.invalid/callback?code=oauth-SECRET",
                  function: "safeFunction",
                  lineno: 12,
                  vars: { email: "secret@example.invalid" },
                },
              ],
            },
          },
        ],
      },
      extra: { payload: { note: "private-note-SECRET" }, circularExtra },
      request: { url: "https://example.invalid/callback?code=oauth-SECRET" },
      tags: {
        "http.method": "GET",
        "http.route": "/v1/calendar/:connectionId",
        householdId: "household-SECRET",
      },
      type: undefined,
      user: { email: "secret@example.invalid" },
    });

    expect(JSON.stringify(output)).not.toContain("SECRET");
    expect(JSON.stringify(output)).not.toContain("secret@example.invalid");
    expect(output).toMatchObject({
      exception: {
        values: [
          {
            type: "Error",
            value: "Unhandled application error",
            stacktrace: { frames: [{ lineno: 12 }] },
          },
        ],
      },
      tags: {
        "http.method": "GET",
        "http.route": "/v1/calendar/:connectionId",
      },
    });
  });

  it("does not throw when a provider supplies malformed exception data", () => {
    expect(() =>
      sanitizeSentryEvent({
        exception: { values: "private-note-SECRET" as never },
        type: undefined,
      }),
    ).not.toThrow();
  });

  it("uses a generic message when an event has no exception", () => {
    expect(
      sanitizeSentryEvent({ message: "private-note-SECRET", type: undefined }),
    ).toEqual({
      message: "Unhandled application error",
      type: undefined,
    });
  });
});
