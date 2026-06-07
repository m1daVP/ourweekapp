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

const sensitiveLogPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-supabase-auth"]',
  'req.headers["x-revenuecat-signature"]',
  'req.headers["x-webhook-signature"]',
  'res.headers["set-cookie"]',
  'authorization',
  'cookie',
  'accessToken',
  'refreshToken',
  'password',
  'passwordHash',
  'token',
  '*.accessToken',
  '*.refreshToken',
  '*.password',
  '*.passwordHash',
  '*.token',
];

export async function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'production'
        ? {
            level: env.LOG_LEVEL,
            redact: {
              paths: sensitiveLogPaths,
              censor: '[redacted]',
            },
          }
        : {
            level: env.LOG_LEVEL,
            redact: {
              paths: sensitiveLogPaths,
              censor: '[redacted]',
            },
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
