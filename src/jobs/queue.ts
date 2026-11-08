import { Queue, Worker, Job } from 'bullmq';
import { logger } from '../lib/logger';

type JobData = {
  type: 'schedule-send' | 'tiktok-extract' | 'growth-trigger' | 'webhook-process' | 'cleanup';
  payload: Record<string, unknown>;
  createdAt: string;
};

type QueueEventsInstance = InstanceType<typeof import('bullmq').QueueEvents>;

let messageQueue: Queue<JobData> | null = null;
let events: QueueEventsInstance | undefined = undefined;

/**
 * Get or create the main message queue
 */
export function getMessageQueue(): Queue<JobData> {
  if (messageQueue) return messageQueue;

  messageQueue = new Queue<JobData>('revolution-x-jobs', {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },
  });

  return messageQueue;
}

/**
 * Get the queue events for monitoring
 * Note: BullMQ 11+ uses QueueEvents directly (QueueScheduler removed)
 */
export function getQueueEvents(): QueueEventsInstance | undefined {
  if (events) return events;

  const { QueueEvents } = require('bullmq');
  const qe = new QueueEvents('revolution-x-jobs', {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },
  });

  events = qe; // inicializa antes de usar

  // Log job events
  qe.on('completed', ({ jobId }: { jobId: string }) => {
    logger.info({ jobId }, 'Job completed');
  });

  qe.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    logger.error({ jobId, failedReason }, 'Job failed');
  });

  qe.on('drained', () => {
    logger.info('Queue drained');
  });

  return events;
}

/**
 * Add a job to the queue
 */
export async function addJob(
  type: JobData['type'],
  payload: Record<string, unknown>
): Promise<Job<JobData>> {
  const queue = getMessageQueue();

  const job = await queue.add(type, {
    type,
    payload,
    createdAt: new Date().toISOString(),
  });

  logger.info({ jobId: job.id, type }, 'Job added to queue');
  return job;
}

/**
 * Create a worker for processing jobs
 */
export function createWorker(
  name: string,
  processor: (job: Job<JobData>) => Promise<void>
): Worker<JobData> {
  const queue = getMessageQueue();

  const worker = new Worker<JobData>(
    'revolution-x-jobs',
    async (job) => {
      logger.debug({ jobId: job.id, type: job.data.type }, 'Processing job');
      await processor(job);
      logger.info({ jobId: job.id, type: job.data.type }, 'Job processed successfully');
    },
    {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    }
  );

  worker.on('error', (err: Error) => {
    logger.error({ err, worker: name }, 'Worker error');
  });

  worker.on('failed', (job: Job<JobData> | undefined, err: Error) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Job processing failed');
  });

  return worker;
}

/**
 * Initialize queue events for monitoring (call once at startup)
 */
export function initQueueEvents(): QueueEventsInstance | undefined {
  return getQueueEvents();
}

// Initialize events on module load (server-side only)
if (typeof window === 'undefined') {
  initQueueEvents();
}