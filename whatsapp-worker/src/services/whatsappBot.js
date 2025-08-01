const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const config = require('../config');
const logger = require('../utils/logger');
const webserviceClient = require('./webserviceClient');
const queueService = require('./queueService');

class WhatsAppBot {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.isConnected = false;
    this.qrCode = null;
    this.sessionPath = `.wwebjs_auth/${config.whatsapp.sessionName}`;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 10000; // 10 seconds
  }

  // Initialize WhatsApp client
  async initialize() {
    try {
      logger.whatsapp('Initializing WhatsApp client...');

      this.client = new Client({
        authStrategy: new LocalAuth({ 
          clientId: config.whatsapp.sessionName,
          dataPath: this.sessionPath,
        }),
        puppeteer: config.whatsapp.clientOptions.puppeteer,
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
      });

      this.setupEventHandlers();
      
      await this.client.initialize();
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client:', error);
      return false;
    }
  }

  // Setup event handlers
  setupEventHandlers() {
    // QR Code event
    this.client.on('qr', async (qr) => {
      logger.whatsapp('QR Code received, scan it with your phone');
      
      // Display QR in terminal
      qrcode.generate(qr, { small: true });
      
      // Generate QR code data URL for web interface
      try {
        this.qrCode = await QRCode.toDataURL(qr);
        logger.whatsapp('QR Code generated for web interface');
        
        // Notify webservice about QR code
        await webserviceClient.logWhatsAppEvent('qr_generated', {
          qrCode: this.qrCode,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Error generating QR code:', error);
      }
    });

    // Ready event
    this.client.on('ready', async () => {
      logger.whatsapp('✅ WhatsApp client is ready!');
      this.isReady = true;
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.qrCode = null;

      // Get client info
      const clientInfo = this.client.info;
      logger.whatsapp(`Connected as: ${clientInfo.pushname} (${clientInfo.wid.user})`);

      // Register with webservice
      await this.registerWithWebservice();

      // Start processing message queue
      this.startMessageProcessing();
    });

    // Authentication event
    this.client.on('authenticated', () => {
      logger.whatsapp('WhatsApp client authenticated');
    });

    // Auth failure event
    this.client.on('auth_failure', async (message) => {
      logger.error('WhatsApp authentication failed:', message);
      this.isReady = false;
      this.isConnected = false;
      
      await webserviceClient.logWhatsAppEvent('auth_failure', {
        message,
        timestamp: new Date().toISOString(),
      });
    });

    // Disconnected event
    this.client.on('disconnected', async (reason) => {
      logger.warn('WhatsApp client disconnected:', reason);
      this.isReady = false;
      this.isConnected = false;
      
      await webserviceClient.logWhatsAppEvent('disconnected', {
        reason,
        timestamp: new Date().toISOString(),
      });

      // Attempt to reconnect
      this.attemptReconnect();
    });

    // Message event
    this.client.on('message', async (message) => {
      try {
        await this.handleIncomingMessage(message);
      } catch (error) {
        logger.error('Error handling incoming message:', error);
      }
    });

    // Message ack event
    this.client.on('message_ack', async (message, ack) => {
      // Log message status changes
      const ackStatus = this.getAckStatus(ack);
      logger.whatsapp(`Message ${message.id.id} status: ${ackStatus}`);
      
      // Sync with webservice
      await webserviceClient.logWhatsAppEvent('message_ack', {
        messageId: message.id.id,
        status: ackStatus,
        timestamp: new Date().toISOString(),
      });
    });

    // Group join event
    this.client.on('group_join', async (notification) => {
      logger.whatsapp('Someone joined a group:', notification);
      await this.handleGroupJoin(notification);
    });

    // Group leave event
    this.client.on('group_leave', async (notification) => {
      logger.whatsapp('Someone left a group:', notification);
      await this.handleGroupLeave(notification);
    });
  }

  // Handle incoming messages
  async handleIncomingMessage(message) {
    const contact = await message.getContact();
    const chat = await message.getChat();
    
    logger.whatsapp(`Message received from ${contact.name || contact.pushname || contact.number}`, {
      messageId: message.id.id,
      from: contact.number,
      type: message.type,
      body: message.body?.substring(0, 100) + (message.body?.length > 100 ? '...' : ''),
      isGroup: chat.isGroup,
    });

    // Add to processing queue
    await queueService.addWhatsAppMessageJob({
      messageId: message.id.id,
      from: contact.number,
      fromName: contact.name || contact.pushname,
      body: message.body,
      type: message.type,
      timestamp: message.timestamp,
      isGroup: chat.isGroup,
      chatId: chat.id._serialized,
      chatName: chat.name,
      hasMedia: message.hasMedia,
      isForwarded: message.isForwarded,
      mentionedIds: message.mentionedIds,
    });

    // Process bot commands if enabled
    if (config.bot.autoReplyEnabled && message.body.startsWith(config.bot.prefix)) {
      await this.handleBotCommand(message);
    }

    // Sync with webservice
    await webserviceClient.logWhatsAppEvent('message_received', {
      messageId: message.id.id,
      from: contact.number,
      type: message.type,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle bot commands
  async handleBotCommand(message) {
    const command = message.body.slice(config.bot.prefix.length).split(' ')[0].toLowerCase();
    const args = message.body.slice(config.bot.prefix.length).split(' ').slice(1);

    logger.bot(`Processing command: ${command}`, { args });

    try {
      switch (command) {
        case 'help':
          await this.sendHelpMessage(message);
          break;
        case 'status':
          await this.sendStatusMessage(message);
          break;
        case 'ping':
          await message.reply('🏓 Pong!');
          break;
        case 'info':
          await this.sendInfoMessage(message);
          break;
        default:
          await message.reply(`❌ Comando desconocido: ${command}\nEnvía ${config.bot.prefix}help para ver los comandos disponibles.`);
      }
    } catch (error) {
      logger.error('Error processing bot command:', error);
      await message.reply('❌ Error procesando el comando. Intenta de nuevo más tarde.');
    }
  }

  // Bot command handlers
  async sendHelpMessage(message) {
    const helpText = `
🤖 *Bot de WhatsApp - Comandos Disponibles*

${config.bot.prefix}help - Muestra esta ayuda
${config.bot.prefix}status - Estado del bot
${config.bot.prefix}ping - Prueba de conectividad
${config.bot.prefix}info - Información del bot

*Desarrollado con whatsapp-web.js*
    `.trim();

    await message.reply(helpText);
  }

  async sendStatusMessage(message) {
    const stats = await queueService.getQueueStats();
    const statusText = `
🔄 *Estado del Bot*

✅ Estado: Activo
⏰ Tiempo activo: ${this.getUptime()}
📱 Conectado a WhatsApp: ${this.isConnected ? '✅' : '❌'}
📊 Trabajos en cola: ${stats.success ? stats.stats.waiting : 'N/A'}
📈 Trabajos procesados: ${stats.success ? stats.stats.completed : 'N/A'}
❌ Trabajos fallidos: ${stats.success ? stats.stats.failed : 'N/A'}
    `.trim();

    await message.reply(statusText);
  }

  async sendInfoMessage(message) {
    const contact = await message.getContact();
    const chat = await message.getChat();
    
    const infoText = `
ℹ️ *Información del Mensaje*

👤 De: ${contact.name || contact.pushname || contact.number}
💬 Chat: ${chat.isGroup ? `Grupo: ${chat.name}` : 'Chat privado'}
📅 Fecha: ${new Date(message.timestamp * 1000).toLocaleString()}
🆔 ID del mensaje: ${message.id.id}
📱 Tipo: ${message.type}
    `.trim();

    await message.reply(infoText);
  }

  // Group event handlers
  async handleGroupJoin(notification) {
    if (config.bot.autoReplyEnabled) {
      const chat = await this.client.getChatById(notification.chatId);
      await chat.sendMessage(`👋 ¡Bienvenido al grupo!\n\n${config.bot.welcomeMessage}`);
    }
  }

  async handleGroupLeave(notification) {
    logger.whatsapp('User left group', { chatId: notification.chatId });
  }

  // Message processing
  startMessageProcessing() {
    // Process WhatsApp messages
    queueService.processQueue(config.queue.name, 'whatsapp-message', async (job) => {
      const messageData = job.data;
      
      // Process message with webservice
      const result = await webserviceClient.queueJob('process-whatsapp-message', messageData);
      
      if (result.success) {
        logger.whatsapp('Message processed successfully', { messageId: messageData.messageId });
      } else {
        logger.error('Failed to process message', { messageId: messageData.messageId, error: result.error });
      }

      return result;
    });

    // Process media messages
    queueService.processQueue(config.queue.name, 'whatsapp-media', async (job) => {
      const mediaData = job.data;
      
      // Download and process media
      const result = await this.processMediaMessage(mediaData);
      
      return result;
    });

    // Process webhook jobs
    queueService.processQueue(config.queue.name, 'webhook', async (job) => {
      const webhookData = job.data;
      
      // Send webhook to webservice
      const result = await webserviceClient.queueJob('send-webhook', webhookData);
      
      return result;
    });

    logger.whatsapp('Message processing started');
  }

  // Process media messages
  async processMediaMessage(mediaData) {
    try {
      const message = await this.client.getMessageById(mediaData.messageId);
      
      if (!message.hasMedia) {
        return { success: false, error: 'Message has no media' };
      }

      const media = await message.downloadMedia();
      
      // Send media to webservice for processing
      const result = await webserviceClient.queueJob('process-media', {
        messageId: mediaData.messageId,
        mediaType: media.mimetype,
        mediaSize: media.data.length,
        mediaData: media.data,
        filename: media.filename,
      });

      return result;
    } catch (error) {
      logger.error('Error processing media message:', error);
      return { success: false, error: error.message };
    }
  }

  // Send message methods
  async sendMessage(to, message, options = {}) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready');
      }

      const chatId = to.includes('@') ? to : `${to}@c.us`;
      const result = await this.client.sendMessage(chatId, message, options);
      
      logger.whatsapp(`Message sent to ${to}`, { messageId: result.id.id });
      
      return {
        success: true,
        messageId: result.id.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      logger.error('Error sending message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendMediaMessage(to, media, caption = '', options = {}) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready');
      }

      const chatId = to.includes('@') ? to : `${to}@c.us`;
      const messageMedia = MessageMedia.fromFilePath(media);
      
      const result = await this.client.sendMessage(chatId, messageMedia, {
        caption,
        ...options,
      });
      
      logger.whatsapp(`Media message sent to ${to}`, { messageId: result.id.id });
      
      return {
        success: true,
        messageId: result.id.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      logger.error('Error sending media message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Utility methods
  getAckStatus(ack) {
    switch (ack) {
      case 0: return 'pending';
      case 1: return 'sent';
      case 2: return 'received';
      case 3: return 'read';
      case 4: return 'played';
      default: return 'unknown';
    }
  }

  getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  // Register with webservice
  async registerWithWebservice() {
    try {
      const clientInfo = this.client.info;
      const result = await webserviceClient.registerWorker({
        name: 'WhatsApp Bot Worker',
        version: '1.0.0',
        whatsappNumber: clientInfo.wid.user,
        whatsappName: clientInfo.pushname,
        capabilities: ['messaging', 'media', 'groups', 'status'],
        status: 'active',
      });

      if (result.success) {
        logger.whatsapp('Successfully registered with webservice');
      } else {
        logger.error('Failed to register with webservice:', result.error);
      }
    } catch (error) {
      logger.error('Error registering with webservice:', error);
    }
  }

  // Reconnection logic
  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    logger.whatsapp(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        logger.error('Reconnection failed:', error);
        this.attemptReconnect();
      }
    }, this.reconnectDelay);
  }

  // Health check
  isHealthy() {
    return this.isReady && this.isConnected;
  }

  // Get client info
  getClientInfo() {
    if (!this.client || !this.isReady) {
      return null;
    }

    return {
      isReady: this.isReady,
      isConnected: this.isConnected,
      number: this.client.info?.wid?.user,
      name: this.client.info?.pushname,
      platform: this.client.info?.platform,
      qrCode: this.qrCode,
    };
  }

  // Graceful shutdown
  async shutdown() {
    try {
      logger.whatsapp('Shutting down WhatsApp client...');
      
      if (this.client) {
        await this.client.destroy();
      }
      
      logger.whatsapp('WhatsApp client shut down successfully');
    } catch (error) {
      logger.error('Error shutting down WhatsApp client:', error);
    }
  }
}

module.exports = new WhatsAppBot();