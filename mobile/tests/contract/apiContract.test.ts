import { describe, expect, it } from 'vitest';
import {
  endpointContracts,
  type ApiMethod,
  type EndpointContract,
  type OpenApiFixture,
} from './apiContractFixtures';
import { openApiSnapshot } from './openApiSnapshot';

const targetErrorStatuses = [401, 403, 409, 422, 500];

function getOperation(fixture: OpenApiFixture, contract: EndpointContract) {
  const method = contract.method.toLowerCase() as Lowercase<ApiMethod>;

  return fixture.paths[contract.path]?.[method];
}

describe('API endpoint contract fixture', () => {
  it('documents frontend API paths without using billing aliases', () => {
    const paths = endpointContracts.map((contract) => contract.path);

    expect(paths).toContain('/v1/subscriptions/status');
    expect(paths).toContain('/v1/subscriptions/restore');
    expect(paths).toContain('/v1/subscriptions/manage');
    expect(paths.some((path) => path.startsWith('/v1/billing/'))).toBe(false);
  });

  it('has an OpenAPI operation for every documented endpoint', () => {
    for (const contract of endpointContracts) {
      expect(
        getOperation(openApiSnapshot, contract),
        `${contract.method} ${contract.path}`
      ).toBeDefined();
    }
  });

  it('keeps expected success statuses in the OpenAPI fixture', () => {
    for (const contract of endpointContracts) {
      const operation = getOperation(openApiSnapshot, contract);
      const statuses = Object.keys(operation?.responses ?? {});

      for (const status of contract.successStatuses) {
        expect(statuses, `${contract.method} ${contract.path}`).toContain(
          String(status)
        );
      }
    }
  });

  it('keeps expected error statuses in the OpenAPI fixture', () => {
    for (const contract of endpointContracts) {
      const operation = getOperation(openApiSnapshot, contract);
      const statuses = Object.keys(operation?.responses ?? {});

      for (const status of contract.errorStatuses) {
        expect(statuses, `${contract.method} ${contract.path}`).toContain(
          String(status)
        );
      }
    }
  });

  it('declares bearer auth on protected endpoints only', () => {
    for (const contract of endpointContracts) {
      const operation = getOperation(openApiSnapshot, contract);
      const hasBearerAuth = operation?.security?.some((entry) =>
        Object.hasOwn(entry, 'bearerAuth')
      );

      expect(
        Boolean(hasBearerAuth),
        `${contract.method} ${contract.path}`
      ).toBe(contract.requiresAuth);
    }
  });

  it('provides request examples for all OpenAPI root required fields', () => {
    for (const contract of endpointContracts) {
      const operation = getOperation(openApiSnapshot, contract);
      const requiredFields =
        operation?.requestBody?.content?.['application/json']?.schema
          ?.required ?? [];

      for (const field of requiredFields) {
        expect(
          contract.requestExample,
          `${contract.method} ${contract.path} example`
        ).toHaveProperty(field);
      }
    }
  });

  it('covers target API failure statuses where they are exposed by endpoints', () => {
    const coveredStatuses = new Set(
      endpointContracts.flatMap((contract) => contract.errorStatuses)
    );

    for (const status of targetErrorStatuses) {
      expect(coveredStatuses.has(status), `status ${status}`).toBe(true);
    }
  });
});
