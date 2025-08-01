const Queue = require('bull');
const Redis = require('redis');
const config = require('../config');
const logger = require('../utils/logger');

class QueueService {
  constructor() {
    this.queues = {};
    this.redisClient = null;
    this.isConnected = false;
    this.processors = new Map();
  }

  // Initialize Redis connection
  async initialize() {
    try {
      const redisConfig = config.redis;
      
      if (redisConfig.url) {
        this.redisClient = Redis.createClient({ url: redisConfig.url });
      } else {
        this.redisClient = Redis.createClient({
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
        });
      }

      // Redis event handlers
      this.redisClient.on('connect', () => {
        logger.queue('Connecting to Redis...');
      });

      this.redisClient.on('ready', () => {
        logger.queue('✅ Redis connection ready');
        this.isConnected = true;
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis connection error:', err);
        this.isConnected = false;
      });

      this.redisClient.on('end', () => {
        logger.queue('Redis connection ended');
        this.isConnected = false;
      });

      await this.redisClient.connect();
      
      // Initialize default queue
      this.getQueue(config.queue.name);
      
      logger.queue('Queue service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize queue service:', error);
      return false;
    }
  }

  // Get or create a queue
  getQueue(queueName = config.queue.name) {
    if (!this.queues[queueName]) {
      const queueOptions = {
        redis: config.redis,
        defaultJobOptions: {
          removeOnComplete: config.queue.removeOnComplete,
          removeOnFail: config.queue.removeOnFail,
          attempts: config.worker.maxRetries,
          backoff: {
            type: 'exponential',
            delay: config.worker.retryDelay,
          },
        },
      };

      this.queues[queueName] = new Queue(queueName, queueOptions);

      // Add event listeners
      this.setupQueueEventListeners(this.queues[queueName], queueName);
    }

    return this.queues[queueName];
  }

  // Setup queue event listeners
  setupQueueEventListeners(queue, queueName) {
    queue.on('completed', (job, result) => {
      logger.queue(`Job ${job.id} completed in queue ${queueName}`, {
        jobId: job.id,
        jobType: job.name,
        processingTime: job.finishedOn - job.processedOn,
        result: typeof result === 'object' ? JSON.stringify(result) : result,
      });
    });

    queue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} failed in queue ${queueName}`, {
        jobId: job.id,
        jobType: job.name,
        error: err.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
      });
    });

    queue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} stalled in queue ${queueName}`, {
        jobId: job.id,
        jobType: job.name,
      });
    });

    queue.on('progress', (job, progress) => {
      logger.queue(`Job ${job.id} progress: ${progress}%`, {
        jobId: job.id,
        jobType: job.name,
        progress,
      });
    });

    queue.on('active', (job) => {
      logger.queue(`Job ${job.id} started processing`, {
        jobId: job.id,
        jobType: job.name,
      });
    });

    queue.on('waiting', (jobId) => {
      logger.queue(`Job ${jobId} is waiting to be processed`);
    });

    queue.on('error', (error) => {
      logger.error(`Queue ${queueName} error:`, error);
    });
  }

  // Add a job to a queue
  async addJob(queueName, jobType, data, options = {}) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis is not connected');
      }

      const queue = this.getQueue(queueName);
      const defaultOptions = {
        priority: 0,
        delay: 0,
        attempts: config.worker.maxRetries,
        backoff: {
          type: 'exponential',
          delay: config.worker.retryDelay,
        },
      };

      const jobOptions = { ...defaultOptions, ...options };
      const job = await queue.add(jobType, data, jobOptions);

      logger.queue(`Job ${job.id} (${jobType}) added to queue ${queueName}`, {
        jobId: job.id,
        jobType,
        priority: jobOptions.priority,
        delay: jobOptions.delay,
      });

      return {
        success: true,
        jobId: job.id,
        queueName,
        jobType,
        data: job.data,
      };
    } catch (error) {
      logger.error(`Error adding job to queue ${queueName}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Process jobs in a queue
  processQueue(queueName, jobType, processor, concurrency = config.worker.concurrency) {
    const queue = this.getQueue(queueName);
    
    // Store processor reference for cleanup
    const processorKey = `${queueName}:${jobType}`;
    this.processors.set(processorKey, { processor, concurrency });

    queue.process(jobType, concurrency, async (job) => {
      try {
        logger.queue(`Processing job ${job.id} (${jobType})`, {
          jobId: job.id,
          jobType,
          data: job.data,
        });

        const result = await processor(job);
        
        logger.queue(`Job ${job.id} (${jobType}) completed successfully`, {
          jobId: job.id,
          result: typeof result === 'object' ? JSON.stringify(result) : result,
        });

        return result;
      } catch (error) {
        logger.error(`Job ${job.id} (${jobType}) processing failed:`, error);
        throw error;
      }
    });

    logger.queue(`Processing ${jobType} jobs in queue ${queueName} with concurrency ${concurrency}`);
  }

  // WhatsApp-specific job types
  async addWhatsAppMessageJob(messageData, options = {}) {
    return await this.addJob(config.queue.name, 'whatsapp-message', messageData, {
      priority: 5,
      ...options,
    });
  }

  async addWhatsAppMediaJob(mediaData, options = {}) {
    return await this.addJob(config.queue.name, 'whatsapp-media', mediaData, {
      priority: 3,
      ...options,
    });
  }

  async addWebhookJob(webhookData, options = {}) {
    return await this.addJob(config.queue.name, 'webhook', webhookData, {
      priority: 7,
      ...options,
    });
  }

  async addDataSyncJob(syncData, options = {}) {
    return await this.addJob(config.queue.name, 'data-sync', syncData, {
      priority: 2,
      ...options,
    });
  }

  // Job management methods
  async getJobStatus(queueName, jobId) {
    try {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (!job) {
        return {
          success: false,
          error: 'Job not found',
        };
      }

      const state = await job.getState();
      return {
        success: true,
        job: {
          id: job.id,
          name: job.name,
          data: job.data,
          state,
          progress: job.progress(),
          failedReason: job.failedReason,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          createdAt: new Date(job.timestamp),
          attempts: job.attemptsMade,
          maxAttempts: job.opts.attempts,
        },
      };
    } catch (error) {
      logger.error(`Error getting job status from queue ${queueName}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getQueueStats(queueName = config.queue.name) {
    try {
      const queue = this.getQueue(queueName);
      
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      return {
        success: true,
        queueName,
        stats: {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          total: waiting.length + active.length + completed.length + failed.length + delayed.length,
        },
      };
    } catch (error) {
      logger.error(`Error getting queue stats for ${queueName}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async pauseQueue(queueName = config.queue.name) {
    try {
      const queue = this.getQueue(queueName);
      await queue.pause();
      logger.queue(`Queue ${queueName} paused`);
      return { success: true };
    } catch (error) {
      logger.error(`Error pausing queue ${queueName}:`, error);
      return { success: false, error: error.message };
    }
  }

  async resumeQueue(queueName = config.queue.name) {
    try {
      const queue = this.getQueue(queueName);
      await queue.resume();
      logger.queue(`Queue ${queueName} resumed`);
      return { success: true };
    } catch (error) {
      logger.error(`Error resuming queue ${queueName}:`, error);
      return { success: false, error: error.message };
    }
  }

  async cleanQueue(queueName = config.queue.name, olderThan = 24 * 60 * 60 * 1000) {
    try {
      const queue = this.getQueue(queueName);
      await queue.clean(olderThan, 'completed');
      await queue.clean(olderThan, 'failed');
      logger.queue(`Queue ${queueName} cleaned`);
      return { success: true };
    } catch (error) {
      logger.error(`Error cleaning queue ${queueName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Graceful shutdown
  async shutdown() {
    try {
      logger.queue('Shutting down queue service...');
      
      const closePromises = Object.values(this.queues).map(queue => queue.close());
      await Promise.all(closePromises);
      
      if (this.redisClient && this.isConnected) {
        await this.redisClient.quit();
      }
      
      logger.queue('Queue service shut down successfully');
    } catch (error) {
      logger.error('Error shutting down queue service:', error);
    }
  }

  // Health check
  isHealthy() {
    return this.isConnected && this.redisClient?.isReady;
  }
}

module.exports = new QueueService();