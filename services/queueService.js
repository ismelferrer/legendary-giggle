const Queue = require('bull');
const { redisConfig } = require('../config/redis');

class QueueService {
  constructor() {
    this.queues = {};
    this.redisConfig = redisConfig;
  }

  // Create or get a queue
  getQueue(queueName) {
    if (!this.queues[queueName]) {
      this.queues[queueName] = new Queue(queueName, {
        redis: this.redisConfig
      });

      // Add event listeners for queue monitoring
      this.queues[queueName].on('completed', (job, result) => {
        console.log(`Job ${job.id} completed in queue ${queueName}:`, result);
      });

      this.queues[queueName].on('failed', (job, err) => {
        console.error(`Job ${job.id} failed in queue ${queueName}:`, err);
      });

      this.queues[queueName].on('stalled', (job) => {
        console.warn(`Job ${job.id} stalled in queue ${queueName}`);
      });
    }

    return this.queues[queueName];
  }

  // Add a job to a queue
  async addJob(queueName, jobType, data, options = {}) {
    try {
      const queue = this.getQueue(queueName);
      const defaultOptions = {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      };

      const jobOptions = { ...defaultOptions, ...options };
      const job = await queue.add(jobType, data, jobOptions);
      
      console.log(`Job ${job.id} added to queue ${queueName}`);
      return { success: true, jobId: job.id, data: job.data };
    } catch (error) {
      console.error(`Error adding job to queue ${queueName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Process jobs in a queue
  processQueue(queueName, jobType, processor, concurrency = 1) {
    const queue = this.getQueue(queueName);
    queue.process(jobType, concurrency, processor);
    console.log(`Processing ${jobType} jobs in queue ${queueName} with concurrency ${concurrency}`);
  }

  // Get job status
  async getJobStatus(queueName, jobId) {
    try {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);
      
      if (!job) {
        return { success: false, error: 'Job not found' };
      }

      const state = await job.getState();
      return {
        success: true,
        job: {
          id: job.id,
          data: job.data,
          state,
          progress: job.progress(),
          failedReason: job.failedReason,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        }
      };
    } catch (error) {
      console.error(`Error getting job status from queue ${queueName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Get queue statistics
  async getQueueStats(queueName) {
    try {
      const queue = this.getQueue(queueName);
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      const delayed = await queue.getDelayed();

      return {
        success: true,
        stats: {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
        }
      };
    } catch (error) {
      console.error(`Error getting queue stats for ${queueName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Clean completed jobs
  async cleanQueue(queueName, olderThan = 24 * 60 * 60 * 1000) {
    try {
      const queue = this.getQueue(queueName);
      await queue.clean(olderThan, 'completed');
      await queue.clean(olderThan, 'failed');
      return { success: true };
    } catch (error) {
      console.error(`Error cleaning queue ${queueName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Pause/resume queue
  async pauseQueue(queueName) {
    try {
      const queue = this.getQueue(queueName);
      await queue.pause();
      return { success: true };
    } catch (error) {
      console.error(`Error pausing queue ${queueName}:`, error);
      return { success: false, error: error.message };
    }
  }

  async resumeQueue(queueName) {
    try {
      const queue = this.getQueue(queueName);
      await queue.resume();
      return { success: true };
    } catch (error) {
      console.error(`Error resuming queue ${queueName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Close all queues
  async closeAll() {
    try {
      const closePromises = Object.values(this.queues).map(queue => queue.close());
      await Promise.all(closePromises);
      console.log('All queues closed');
    } catch (error) {
      console.error('Error closing queues:', error);
    }
  }
}

module.exports = new QueueService();