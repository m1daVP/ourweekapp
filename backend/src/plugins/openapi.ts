import swagger, { type SwaggerTransform } from '@fastify/swagger';
import type { FastifyInstance, FastifySchema } from 'fastify';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
} from 'fastify-type-provider-zod';

import { env } from '../config/env.js';

const bearerAuthSecurity = [{ bearerAuth: [] }];

type OpenApiSchema = FastifySchema & {
  security?: Array<Record<string, string[]>>;
  tags?: string[];
};

type OpenApiRouteConfig = {
  authRequired?: boolean;
};

function tagFromUrl(url: string) {
  if (url === '/health' || url.startsWith('/health/')) {
    return 'health';
  }

  const [, versionOrSegment, segment] = url.split('/');

  if (versionOrSegment === 'v1' && segment) {
    return segment;
  }

  return versionOrSegment ?? 'default';
}

function routeRequiresAuth(route: Parameters<SwaggerTransform>[0]['route']) {
  return Boolean((route.config as OpenApiRouteConfig | undefined)?.authRequired);
}

const openApiTransform: SwaggerTransform = (input) => {
  const transformed = jsonSchemaTransform(input) as {
    schema: OpenApiSchema;
    url: string;
  };

  if (transformed.schema.hide) {
    return transformed;
  }

  transformed.schema.tags ??= [tagFromUrl(transformed.url)];

  if (routeRequiresAuth(input.route)) {
    transformed.schema.security ??= bearerAuthSecurity;
  }

  return transformed;
};

export async function registerOpenApi(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Weekly Us API',
        description: 'Backend API for weekly family and couple meeting workflows.',
        version: '0.0.1',
      },
      servers: [
        {
          url: env.PUBLIC_API_BASE_URL,
          description: env.APP_ENV,
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    transform: openApiTransform,
    transformObject: jsonSchemaTransformObject,
  });

  if (env.NODE_ENV === 'production') {
    return;
  }

  app.get('/openapi.json', {
    schema: {
      hide: true,
    },
  }, async () => app.swagger());

  app.get('/docs', {
    schema: {
      hide: true,
    },
  }, async (_request, reply) => {
    reply
      .type('text/html; charset=utf-8')
      .header(
        'content-security-policy',
        "default-src 'none'; script-src https://cdn.redoc.ly; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'self'",
      );

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Weekly Us API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <redoc spec-url="/openapi.json"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`;
  });
}
