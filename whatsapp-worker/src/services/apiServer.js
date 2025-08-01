const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('../utils/logger');
const whatsappBot = require('./whatsappBot');
const queueService = require('./queueService');
const webserviceClient = require('./webserviceClient');
const messageHandler = require('../handlers/messageHandler');

class ApiServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  // Setup middleware
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false,
    }));

    // CORS
    this.app.use(cors({
      origin: config.security.allowedOrigins,
      credentials: true,
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    this.app.use(morgan('combined', { stream: logger.stream }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        error: 'Too many requests from this IP, please try again later.',
      },
    });
    this.app.use('/api/', limiter);
  }

  // Setup routes
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          whatsapp: whatsappBot.isHealthy(),
          queue: queueService.isHealthy(),
          webservice: 'connected', // Could add actual health check
        },
        memory: process.memoryUsage(),
        version: '1.0.0',
      };

      const overallHealthy = Object.values(health.services).every(service => 
        service === true || service === 'connected'
      );

      res.status(overallHealthy ? 200 : 503).json(health);
    });

    // Status endpoint
    this.app.get('/api/status', (req, res) => {
      const clientInfo = whatsappBot.getClientInfo();
      res.json({
        status: 'active',
        whatsapp: clientInfo,
        queue: queueService.isHealthy(),
        timestamp: new Date().toISOString(),
      });
    });

    // Get WhatsApp client info
    this.app.get('/api/whatsapp/info', (req, res) => {
      const clientInfo = whatsappBot.getClientInfo();
      res.json(clientInfo || { status: 'not_ready' });
    });

    // Get WhatsApp session info
    this.app.get('/api/whatsapp/session', (req, res) => {
      const sessionInfo = whatsappBot.getSessionInfo();
      res.json(sessionInfo);
    });

    // Delete WhatsApp session (logout)
    this.app.delete('/api/whatsapp/session', async (req, res) => {
      try {
        if (whatsappBot.useSupabaseAuth && whatsappBot.authStrategy) {
          await whatsappBot.authStrategy.deleteSession();
          res.json({ success: true, message: 'Session deleted from Supabase' });
        } else {
          res.json({ success: false, message: 'Local auth does not support remote session deletion' });
        }
      } catch (error) {
        logger.error('Error deleting session:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get all sessions (Supabase only)
    this.app.get('/api/whatsapp/sessions', async (req, res) => {
      try {
        if (whatsappBot.useSupabaseAuth && whatsappBot.authStrategy) {
          const sessions = await whatsappBot.authStrategy.getAllSessions();
          res.json({ success: true, sessions });
        } else {
          res.json({ success: false, message: 'Only available with Supabase authentication' });
        }
      } catch (error) {
        logger.error('Error getting sessions:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Send message endpoint
    this.app.post('/api/whatsapp/send', async (req, res) => {
      try {
        const { to, message, options } = req.body;

        if (!to || !message) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: to, message',
          });
        }

        const result = await whatsappBot.sendMessage(to, message, options);
        res.json(result);
      } catch (error) {
        logger.error('Error sending message:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Send media message endpoint
    this.app.post('/api/whatsapp/send-media', async (req, res) => {
      try {
        const { to, media, caption, options } = req.body;

        if (!to || !media) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: to, media',
          });
        }

        const result = await whatsappBot.sendMediaMessage(to, media, caption, options);
        res.json(result);
      } catch (error) {
        logger.error('Error sending media message:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Queue management endpoints
    this.app.get('/api/queue/stats', async (req, res) => {
      try {
        const stats = await queueService.getQueueStats();
        res.json(stats);
      } catch (error) {
        logger.error('Error getting queue stats:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    this.app.post('/api/queue/pause', async (req, res) => {
      try {
        const result = await queueService.pauseQueue();
        res.json(result);
      } catch (error) {
        logger.error('Error pausing queue:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    this.app.post('/api/queue/resume', async (req, res) => {
      try {
        const result = await queueService.resumeQueue();
        res.json(result);
      } catch (error) {
        logger.error('Error resuming queue:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    this.app.post('/api/queue/clean', async (req, res) => {
      try {
        const result = await queueService.cleanQueue();
        res.json(result);
      } catch (error) {
        logger.error('Error cleaning queue:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Job management endpoints
    this.app.post('/api/jobs', async (req, res) => {
      try {
        const { type, data, options } = req.body;

        if (!type || !data) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: type, data',
          });
        }

        const result = await queueService.addJob(config.queue.name, type, data, options);
        res.json(result);
      } catch (error) {
        logger.error('Error adding job:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    this.app.get('/api/jobs/:jobId/status', async (req, res) => {
      try {
        const { jobId } = req.params;
        const result = await queueService.getJobStatus(config.queue.name, jobId);
        res.json(result);
      } catch (error) {
        logger.error('Error getting job status:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Webhook endpoints for webservice communication
    this.app.post('/webhook/whatsapp', async (req, res) => {
      try {
        const webhookData = req.body;
        
        logger.whatsapp('Received webhook from webservice', webhookData);

        // Process webhook based on type
        switch (webhookData.type) {
          case 'send_message':
            await this.handleSendMessageWebhook(webhookData);
            break;
          case 'send_media':
            await this.handleSendMediaWebhook(webhookData);
            break;
          case 'queue_job':
            await this.handleQueueJobWebhook(webhookData);
            break;
          default:
            logger.warn('Unknown webhook type:', webhookData.type);
        }

        res.json({ success: true, received: true });
      } catch (error) {
        logger.error('Error processing webhook:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Message processing endpoint
    this.app.post('/api/process-message', async (req, res) => {
      try {
        const messageData = req.body;
        const result = await messageHandler.processMessage(messageData);
        res.json(result);
      } catch (error) {
        logger.error('Error processing message:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Process data endpoint (from webservice)
    this.app.post('/api/process-data', async (req, res) => {
      try {
        const data = req.body;
        
        // Queue for processing
        const result = await queueService.addJob(config.queue.name, 'process-data', data);
        
        res.json(result);
      } catch (error) {
        logger.error('Error processing data:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Send email endpoint (from webservice)
    this.app.post('/api/send-email', async (req, res) => {
      try {
        const emailData = req.body;
        
        // Queue for processing
        const result = await queueService.addJob(config.queue.name, 'send-email', emailData);
        
        res.json(result);
      } catch (error) {
        logger.error('Error sending email:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Process file endpoint (from webservice)
    this.app.post('/api/process-file', async (req, res) => {
      try {
        const fileData = req.body;
        
        // Queue for processing
        const result = await queueService.addJob(config.queue.name, 'process-file', fileData);
        
        res.json(result);
      } catch (error) {
        logger.error('Error processing file:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Send webhook endpoint (from webservice)
    this.app.post('/api/send-webhook', async (req, res) => {
      try {
        const webhookData = req.body;
        
        // Queue for processing
        const result = await queueService.addWebhookJob(webhookData);
        
        res.json(result);
      } catch (error) {
        logger.error('Error sending webhook:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Cleanup endpoint (from webservice)
    this.app.post('/api/cleanup', async (req, res) => {
      try {
        const cleanupData = req.body;
        
        // Queue for processing
        const result = await queueService.addJob(config.queue.name, 'cleanup-task', cleanupData);
        
        res.json(result);
      } catch (error) {
        logger.error('Error processing cleanup:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Stats endpoint
    this.app.get('/api/stats', (req, res) => {
      res.json({
        success: true,
        stats: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          whatsapp: whatsappBot.getClientInfo(),
          handlers: messageHandler.getHandlerStats(),
          timestamp: new Date().toISOString(),
        },
      });
    });

    // Default 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
      });
    });
  }

  // Webhook handlers
  async handleSendMessageWebhook(webhookData) {
    const { to, message, options } = webhookData.data;
    await whatsappBot.sendMessage(to, message, options);
  }

  async handleSendMediaWebhook(webhookData) {
    const { to, media, caption, options } = webhookData.data;
    await whatsappBot.sendMediaMessage(to, media, caption, options);
  }

  async handleQueueJobWebhook(webhookData) {
    const { jobType, jobData, options } = webhookData.data;
    await queueService.addJob(config.queue.name, jobType, jobData, options);
  }

  // Error handling
  setupErrorHandling() {
    // Global error handler
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error:', err);
      
      res.status(err.status || 500).json({
        success: false,
        error: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
        ...(config.nodeEnv === 'development' && { stack: err.stack }),
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  // Start server
  async start() {
    try {
      this.server = this.app.listen(config.port, () => {
        logger.info(`🚀 WhatsApp Worker API server started on port ${config.port}`);
        logger.info(`🔍 Health check available at http://localhost:${config.port}/health`);
        logger.info(`📊 Stats available at http://localhost:${config.port}/api/stats`);
      });

      // Handle server errors
      this.server.on('error', (error) => {
        logger.error('Server error:', error);
      });

      return true;
    } catch (error) {
      logger.error('Failed to start API server:', error);
      return false;
    }
  }

  // Stop server
  async stop() {
    try {
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        logger.info('API server stopped');
      }
    } catch (error) {
      logger.error('Error stopping API server:', error);
    }
  }

  // Get Express app (for testing)
  getApp() {
    return this.app;
  }
}

module.exports = new ApiServer();