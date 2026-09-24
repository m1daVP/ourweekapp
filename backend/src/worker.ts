import pino from 'pino';

import { workerEnv } from './config/worker-env.js';
import { BackgroundJobQueue } from './shared/jobs/job.queue.js';
import {
  FatalJobWorkerError,
  JobWorker,
  type JobHandler,
} from './shared/jobs/job.worker.js';
import { sensitiveLogRedaction } from './shared/logging/pino-options.js';
import { createServiceRoleSupabaseClient } from './shared/supabase/create-service-client.js';

const logger = pino({
  level: workerEnv.LOG_LEVEL,
  redact: sensitiveLogRedaction,
  ...(workerEnv.NODE_ENV === 'production'
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:standard' },
        },
      }),
});
const supabase = createServiceRoleSupabaseClient(
  workerEnv.SUPABASE_URL,
  workerEnv.SUPABASE_SERVICE_ROLE_KEY,
);
const handlers = new Map<string, JobHandler>();
const worker = new JobWorker({
  queue: new BackgroundJobQueue(supabase),
  handlers,
  logger,
  pollIntervalMs: workerEnv.QUEUE_POLL_INTERVAL_MS,
  visibilityTimeoutSeconds: workerEnv.QUEUE_VISIBILITY_TIMEOUT_SECONDS,
  maxAttempts: workerEnv.QUEUE_MAX_ATTEMPTS,
  maxConsecutiveQueueFailures: workerEnv.QUEUE_MAX_CONSECUTIVE_FAILURES,
  handlerTimeoutMs: workerEnv.QUEUE_HANDLER_TIMEOUT_SECONDS * 1_000,
  deadLetterRetentionMs:
    workerEnv.QUEUE_DEAD_LETTER_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
});
const abortController = new AbortController();

const requestShutdown = (signal: string) => {
  logger.info({ event: 'background_job_worker_shutdown_requested', signal }, 'Worker shutdown requested');
  abortController.abort();
};

process.once('SIGINT', requestShutdown);
process.once('SIGTERM', requestShutdown);

try {
  await worker.run(abortController.signal);
} catch (error) {
  logger.fatal(
    {
      event: 'background_job_worker_crashed',
      errorCode:
        error instanceof FatalJobWorkerError
          ? error.code
          : 'background_job_worker_crashed',
      operation:
        error instanceof FatalJobWorkerError ? error.operation : undefined,
    },
    'Background job worker crashed',
  );
  logger.flush();
  process.exit(1);
}
