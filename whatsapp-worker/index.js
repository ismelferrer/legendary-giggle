#!/usr/bin/env node

const config = require('./src/config');
const logger = require('./src/utils/logger');
const whatsappBot = require('./src/services/whatsappBot');
const queueService = require('./src/services/queueService');
const webserviceClient = require('./src/services/webserviceClient');
const apiServer = require('./src/services/apiServer');
const messageHandler = require('./src/handlers/messageHandler');

class WhatsAppWorker {
  constructor() {
    this.isRunning = false;
    this.services = {
      queue: queueService,
      whatsapp: whatsappBot,
      api: apiServer,
      webservice: webserviceClient,
    };
    
    this.setupProcessHandlers();
  }

  // Setup process signal handlers for graceful shutdown
  setupProcessHandlers() {
    // Graceful shutdown on SIGTERM
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    // Graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.emergencyShutdown();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
      this.emergencyShutdown();
    });
  }

  // Initialize all services
  async initialize() {
    try {
      logger.info('🚀 Starting WhatsApp Worker...');
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Port: ${config.port}`);
      logger.info(`Queue: ${config.queue.name}`);

      // Test webservice connection first
      logger.info('Testing connection to webservice...');
      const webserviceConnected = await webserviceClient.testConnection();
      
      if (!webserviceConnected) {
        logger.warn('⚠️  Could not connect to webservice, continuing anyway...');
      }

      // Initialize Redis queue service
      logger.info('Initializing queue service...');
      const queueInitialized = await queueService.initialize();
      
      if (!queueInitialized) {
        throw new Error('Failed to initialize queue service');
      }

      // Start API server
      logger.info('Starting API server...');
      const apiStarted = await apiServer.start();
      
      if (!apiStarted) {
        throw new Error('Failed to start API server');
      }

      // Initialize WhatsApp bot
      logger.info('Initializing WhatsApp bot...');
      const whatsappInitialized = await whatsappBot.initialize();
      
      if (!whatsappInitialized) {
        throw new Error('Failed to initialize WhatsApp bot');
      }

      // Setup job processors
      this.setupJobProcessors();

      // Mark as running
      this.isRunning = true;

      logger.info('✅ WhatsApp Worker started successfully!');
      logger.info('📱 WhatsApp bot is initializing, check logs for QR code...');
      logger.info(`🌐 API server running on http://localhost:${config.port}`);
      logger.info(`🔍 Health check: http://localhost:${config.port}/health`);
      logger.info(`📊 Stats: http://localhost:${config.port}/api/stats`);

      // Register worker with webservice
      if (webserviceConnected) {
        await this.registerWithWebservice();
      }

      // Start periodic tasks
      this.startPeriodicTasks();

      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize WhatsApp Worker:', error);
      await this.shutdown();
      return false;
    }
  }

  // Setup background job processors
  setupJobProcessors() {
    logger.info('Setting up job processors...');

    // Process WhatsApp messages
    queueService.processQueue(config.queue.name, 'whatsapp-message', async (job) => {
      const messageData = job.data;
      return await messageHandler.processMessage(messageData);
    });

    // Process WhatsApp media
    queueService.processQueue(config.queue.name, 'whatsapp-media', async (job) => {
      const mediaData = job.data;
      
      // Download and process media
      try {
        const result = await whatsappBot.processMediaMessage(mediaData);
        
        // Send to webservice for further processing
        await webserviceClient.queueJob('process-media', {
          ...mediaData,
          result,
        });

        return result;
      } catch (error) {
        logger.error('Error processing media job:', error);
        throw error;
      }
    });

    // Process webhooks
    queueService.processQueue(config.queue.name, 'webhook', async (job) => {
      const webhookData = job.data;
      
      try {
        // Forward webhook to webservice
        const result = await webserviceClient.post('/api/webhook', webhookData);
        return result;
      } catch (error) {
        logger.error('Error processing webhook job:', error);
        throw error;
      }
    });

    // Process data sync
    queueService.processQueue(config.queue.name, 'data-sync', async (job) => {
      const syncData = job.data;
      
      try {
        // Sync data with webservice
        const result = await webserviceClient.syncToSupabase(syncData.table, syncData.data);
        return result;
      } catch (error) {
        logger.error('Error processing data sync job:', error);
        throw error;
      }
    });

    // Process auto-replies
    queueService.processQueue(config.queue.name, 'send-auto-reply', async (job) => {
      const replyData = job.data;
      
      try {
        const result = await whatsappBot.sendMessage(replyData.to, replyData.message);
        
        // Log to webservice
        await webserviceClient.logWhatsAppEvent('auto_reply_sent', {
          to: replyData.to,
          originalMessageId: replyData.originalMessageId,
          replyMessageId: result.messageId,
          timestamp: new Date().toISOString(),
        });

        return result;
      } catch (error) {
        logger.error('Error processing auto-reply job:', error);
        throw error;
      }
    });

    // Generic job processors for webservice communication
    queueService.processQueue(config.queue.name, 'process-data', async (job) => {
      const data = job.data;
      logger.worker('Processing data job', { jobId: job.id });
      
      // Custom data processing logic here
      return { success: true, processed: true, data };
    });

    queueService.processQueue(config.queue.name, 'send-email', async (job) => {
      const emailData = job.data;
      logger.worker('Processing email job', { jobId: job.id });
      
      // Email sending logic here (could integrate with email service)
      return { success: true, sent: true, emailData };
    });

    queueService.processQueue(config.queue.name, 'process-file', async (job) => {
      const fileData = job.data;
      logger.worker('Processing file job', { jobId: job.id });
      
      // File processing logic here
      return { success: true, processed: true, fileData };
    });

    queueService.processQueue(config.queue.name, 'cleanup-task', async (job) => {
      const cleanupData = job.data;
      logger.worker('Processing cleanup job', { jobId: job.id });
      
      // Cleanup logic here
      return { success: true, cleaned: true, cleanupData };
    });

    logger.info('✅ Job processors set up successfully');
  }

  // Register worker with webservice
  async registerWithWebservice() {
    try {
      const workerInfo = {
        name: 'WhatsApp Bot Worker',
        version: '1.0.0',
        type: 'whatsapp-bot',
        port: config.port,
        pid: process.pid,
        startTime: new Date().toISOString(),
        capabilities: [
          'whatsapp-messaging',
          'media-processing',
          'queue-processing',
          'webhook-handling',
          'auto-replies',
          'bot-commands',
        ],
      };

      const result = await webserviceClient.registerWorker(workerInfo);
      
      if (result.success) {
        logger.info('✅ Successfully registered with webservice');
      } else {
        logger.warn('⚠️  Failed to register with webservice:', result.error);
      }
    } catch (error) {
      logger.error('Error registering with webservice:', error);
    }
  }

  // Start periodic tasks
  startPeriodicTasks() {
    // Health check with webservice every 30 seconds
    setInterval(async () => {
      try {
        if (this.isRunning) {
          await webserviceClient.updateWorkerStatus('active', {
            whatsapp: whatsappBot.getClientInfo(),
            queue: await queueService.getQueueStats(),
            memory: process.memoryUsage(),
            uptime: process.uptime(),
          });
        }
      } catch (error) {
        logger.debug('Error updating worker status:', error.message);
      }
    }, 30000);

    // Queue cleanup every hour
    setInterval(async () => {
      try {
        if (this.isRunning) {
          await queueService.cleanQueue();
          logger.info('Queue cleanup completed');
        }
      } catch (error) {
        logger.error('Error cleaning queue:', error);
      }
    }, 60 * 60 * 1000);

    // Memory usage monitoring every 5 minutes
    setInterval(() => {
      if (this.isRunning) {
        const memUsage = process.memoryUsage();
        const memUsageMB = {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
        };

        logger.info('Memory usage (MB):', memUsageMB);

        // Alert if memory usage is high
        if (memUsageMB.heapUsed > 500) {
          logger.warn('⚠️  High memory usage detected:', memUsageMB);
        }
      }
    }, 5 * 60 * 1000);

    logger.info('✅ Periodic tasks started');
  }

  // Get worker status
  getStatus() {
    return {
      isRunning: this.isRunning,
      services: {
        queue: queueService.isHealthy(),
        whatsapp: whatsappBot.isHealthy(),
        api: apiServer.server ? true : false,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
    };
  }

  // Graceful shutdown
  async shutdown() {
    if (!this.isRunning) {
      return;
    }

    logger.info('🔄 Shutting down WhatsApp Worker...');
    this.isRunning = false;

    try {
      // Notify webservice
      await webserviceClient.updateWorkerStatus('shutting_down');

      // Stop API server
      logger.info('Stopping API server...');
      await apiServer.stop();

      // Shutdown WhatsApp bot
      logger.info('Shutting down WhatsApp bot...');
      await whatsappBot.shutdown();

      // Shutdown queue service
      logger.info('Shutting down queue service...');
      await queueService.shutdown();

      logger.info('✅ WhatsApp Worker shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }

  // Emergency shutdown (for unhandled errors)
  emergencyShutdown() {
    logger.error('🚨 Emergency shutdown initiated');
    
    setTimeout(() => {
      process.exit(1);
    }, 5000); // Force exit after 5 seconds

    this.shutdown().catch((error) => {
      logger.error('Error during emergency shutdown:', error);
      process.exit(1);
    });
  }
}

// Main execution
async function main() {
  const worker = new WhatsAppWorker();
  
  const initialized = await worker.initialize();
  
  if (!initialized) {
    logger.error('Failed to initialize worker, exiting...');
    process.exit(1);
  }

  // Keep the process running
  process.stdin.resume();
  
  // Log startup completion
  logger.info('🎉 WhatsApp Worker is now running!');
  logger.info('Press Ctrl+C to stop the worker');
}

// Start the worker if this is the main module
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = WhatsAppWorker;