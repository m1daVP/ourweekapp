import './instrument.js';

import * as Sentry from '@sentry/node';

import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = await buildApp();

const close = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();

  try {
    await Sentry.close(2000);
  } catch {
    // Never let Sentry flushing block shutdown.
  }

  process.exit(0);
};

process.once('SIGINT', close);
process.once('SIGTERM', close);

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
