import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyServerOptions } from 'fastify';
import rawBody from 'fastify-raw-body';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import { env } from './config/env.js';
import { healthRoutes } from './routes/health.routes.js';
import { v1Routes } from './routes/v1.routes.js';
import { registerOpenApi } from './plugins/openapi.js';
import supabasePlugin from './plugins/supabase.js';
import { registerErrorHandler } from './shared/errors/index.js';
import { sensitiveLogRedaction } from './shared/logging/pino-options.js';

export async function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify({
    // Render terminates TLS at its edge proxy and forwards traffic with
    // X-Forwarded-For set; trust it so request.ip (and rate-limit keying)
    // reflects the real client address instead of the proxy.
    trustProxy: true,
    logger:
      env.NODE_ENV === 'production'
        ? {
            level: env.LOG_LEVEL,
            redact: sensitiveLogRedaction,
          }
        : {
            level: env.LOG_LEVEL,
            redact: sensitiveLogRedaction,
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'SYS:standard' },
            },
          },
    ...options,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(sensible);
  await app.register(helmet);
  await app.register(cors, {
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  await app.register(rawBody, {
    field: 'rawBody',
    global: false,
    runFirst: true,
  });
  await app.register(supabasePlugin);

  app.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id);
    done();
  });

  await registerOpenApi(app);
  await app.register(healthRoutes);
  await app.register(v1Routes, { prefix: '/v1' });

  return app;
}
