import { describe, expect, it } from 'vitest';
import {
  endpointContracts,
  type ApiMethod,
  type EndpointContract,
  type OpenApiFixture,
} from './contract/apiContractFixtures';

const apiBaseUrl = 'http://localhost:3030';

function getOperation(spec: OpenApiFixture, contract: EndpointContract) {
  const method = contract.method.toLowerCase() as Lowercase<ApiMethod>;

  return spec.paths[contract.path]?.[method];
}

function isStructuredError(value: unknown) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'code' in value &&
    'details' in value
  );
}

async function fetchOpenApiSpec() {
  const response = await fetch(`${apiBaseUrl}/openapi.json`);

  expect(response.ok).toBe(true);

  return (await response.json()) as OpenApiFixture;
}

describe('live API contract smoke checks', () => {
  it('exposes root health endpoints', async () => {
    const healthResponse = await fetch(`${apiBaseUrl}/health`);
    const liveResponse = await fetch(`${apiBaseUrl}/health/live`);
    const readyResponse = await fetch(`${apiBaseUrl}/health/ready`);

    expect(healthResponse.status).toBe(200);
    expect(liveResponse.status).toBe(200);
    expect([200, 503]).toContain(readyResponse.status);
  });

  it('matches frontend endpoint contracts against localhost OpenAPI', async () => {
    const spec = await fetchOpenApiSpec();

    for (const contract of endpointContracts) {
      const operation = getOperation(spec, contract);

      expect(
        operation,
        `${contract.method} ${contract.path} missing`
      ).toBeDefined();

      const statuses = Object.keys(operation?.responses ?? {});

      for (const status of contract.successStatuses) {
        expect(statuses, `${contract.method} ${contract.path}`).toContain(
          String(status)
        );
      }

      for (const status of contract.errorStatuses) {
        expect(statuses, `${contract.method} ${contract.path}`).toContain(
          String(status)
        );
      }

      if (contract.requiresAuth) {
        expect(
          operation?.security?.some((entry) =>
            Object.hasOwn(entry, 'bearerAuth')
          ),
          `${contract.method} ${contract.path} auth`
        ).toBe(true);
      }
    }
  });

  it('returns structured 401 errors for unauthenticated protected calls', async () => {
    const response = await fetch(`${apiBaseUrl}/v1/auth/me`, {
      headers: { Accept: 'application/json' },
    });
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(401);
    expect(isStructuredError(body)).toBe(true);
  });

  it('returns structured 422 errors for invalid auth input', async () => {
    const response = await fetch(`${apiBaseUrl}/v1/auth/sign-in`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: '', password: '' }),
    });
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(422);
    expect(isStructuredError(body)).toBe(true);
  });
});
