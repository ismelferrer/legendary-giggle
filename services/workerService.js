const axios = require('axios');
const queueService = require('./queueService');
require('dotenv').config();

class WorkerService {
  constructor() {
    this.workerApiUrl = process.env.WORKER_API_URL || 'http://localhost:4000';
    this.workerApiToken = process.env.WORKER_API_TOKEN;
    this.defaultQueue = 'background-tasks';
    
    this.setupJobProcessors();
  }

  // Setup job processors for different types of background tasks
  setupJobProcessors() {
    // Process data processing jobs
    queueService.processQueue(this.defaultQueue, 'process-data', async (job) => {
      return await this.processDataJob(job.data);
    });

    // Process email jobs
    queueService.processQueue(this.defaultQueue, 'send-email', async (job) => {
      return await this.sendEmailJob(job.data);
    });

    // Process file processing jobs
    queueService.processQueue(this.defaultQueue, 'process-file', async (job) => {
      return await this.processFileJob(job.data);
    });

    // Process webhook jobs
    queueService.processQueue(this.defaultQueue, 'send-webhook', async (job) => {
      return await this.sendWebhookJob(job.data);
    });

    // Process cleanup jobs
    queueService.processQueue(this.defaultQueue, 'cleanup-task', async (job) => {
      return await this.cleanupJob(job.data);
    });
  }

  // HTTP client with authentication
  getHttpClient() {
    const config = {
      baseURL: this.workerApiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (this.workerApiToken) {
      config.headers['Authorization'] = `Bearer ${this.workerApiToken}`;
    }

    return axios.create(config);
  }

  // Generic method to send HTTP requests to worker
  async sendToWorker(endpoint, data, method = 'POST') {
    try {
      const client = this.getHttpClient();
      const response = await client({
        method,
        url: endpoint,
        data: method !== 'GET' ? data : undefined,
        params: method === 'GET' ? data : undefined,
      });

      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error(`Error sending request to worker ${endpoint}:`, error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }

  // Queue job methods - add jobs to queue for background processing
  async queueDataProcessing(data, options = {}) {
    return await queueService.addJob(
      this.defaultQueue,
      'process-data',
      data,
      {
        priority: options.priority || 0,
        delay: options.delay || 0,
        ...options
      }
    );
  }

  async queueEmailSend(emailData, options = {}) {
    return await queueService.addJob(
      this.defaultQueue,
      'send-email',
      emailData,
      {
        priority: options.priority || 5,
        delay: options.delay || 0,
        ...options
      }
    );
  }

  async queueFileProcessing(fileData, options = {}) {
    return await queueService.addJob(
      this.defaultQueue,
      'process-file',
      fileData,
      {
        priority: options.priority || 3,
        delay: options.delay || 0,
        ...options
      }
    );
  }

  async queueWebhookSend(webhookData, options = {}) {
    return await queueService.addJob(
      this.defaultQueue,
      'send-webhook',
      webhookData,
      {
        priority: options.priority || 7,
        delay: options.delay || 0,
        ...options
      }
    );
  }

  async queueCleanupTask(cleanupData, options = {}) {
    return await queueService.addJob(
      this.defaultQueue,
      'cleanup-task',
      cleanupData,
      {
        priority: options.priority || 1,
        delay: options.delay || 0,
        ...options
      }
    );
  }

  // Job processors - these handle the actual work
  async processDataJob(data) {
    console.log('Processing data job:', data);
    return await this.sendToWorker('/api/process-data', data);
  }

  async sendEmailJob(emailData) {
    console.log('Processing email job:', emailData);
    return await this.sendToWorker('/api/send-email', emailData);
  }

  async processFileJob(fileData) {
    console.log('Processing file job:', fileData);
    return await this.sendToWorker('/api/process-file', fileData);
  }

  async sendWebhookJob(webhookData) {
    console.log('Processing webhook job:', webhookData);
    return await this.sendToWorker('/api/send-webhook', webhookData);
  }

  async cleanupJob(cleanupData) {
    console.log('Processing cleanup job:', cleanupData);
    return await this.sendToWorker('/api/cleanup', cleanupData);
  }

  // Direct API calls to worker (synchronous)
  async processDataSync(data) {
    return await this.sendToWorker('/api/process-data', data);
  }

  async sendEmailSync(emailData) {
    return await this.sendToWorker('/api/send-email', emailData);
  }

  async processFileSync(fileData) {
    return await this.sendToWorker('/api/process-file', fileData);
  }

  async getWorkerStatus() {
    return await this.sendToWorker('/api/status', {}, 'GET');
  }

  async getWorkerHealth() {
    return await this.sendToWorker('/api/health', {}, 'GET');
  }

  async getWorkerStats() {
    return await this.sendToWorker('/api/stats', {}, 'GET');
  }

  // Job management methods
  async getJobStatus(jobId) {
    return await queueService.getJobStatus(this.defaultQueue, jobId);
  }

  async getQueueStats() {
    return await queueService.getQueueStats(this.defaultQueue);
  }

  async pauseQueue() {
    return await queueService.pauseQueue(this.defaultQueue);
  }

  async resumeQueue() {
    return await queueService.resumeQueue(this.defaultQueue);
  }

  async cleanQueue() {
    return await queueService.cleanQueue(this.defaultQueue);
  }

  // Batch operations
  async queueBatchJobs(jobs) {
    const results = [];
    for (const job of jobs) {
      const { type, data, options } = job;
      let result;

      switch (type) {
        case 'process-data':
          result = await this.queueDataProcessing(data, options);
          break;
        case 'send-email':
          result = await this.queueEmailSend(data, options);
          break;
        case 'process-file':
          result = await this.queueFileProcessing(data, options);
          break;
        case 'send-webhook':
          result = await this.queueWebhookSend(data, options);
          break;
        case 'cleanup-task':
          result = await this.queueCleanupTask(data, options);
          break;
        default:
          result = { success: false, error: `Unknown job type: ${type}` };
      }

      results.push({ type, result });
    }

    return {
      success: true,
      results,
      totalJobs: jobs.length,
      successfulJobs: results.filter(r => r.result.success).length
    };
  }

  // Scheduled job helpers
  async scheduleRecurringJob(jobType, data, cronPattern, options = {}) {
    return await queueService.addJob(
      this.defaultQueue,
      jobType,
      data,
      {
        repeat: { cron: cronPattern },
        ...options
      }
    );
  }

  async scheduleDelayedJob(jobType, data, delayMs, options = {}) {
    return await queueService.addJob(
      this.defaultQueue,
      jobType,
      data,
      {
        delay: delayMs,
        ...options
      }
    );
  }
}

module.exports = new WorkerService();