const logger = require('../utils/logger');
const webserviceClient = require('../services/webserviceClient');
const queueService = require('../services/queueService');
const config = require('../config');

class MessageHandler {
  constructor() {
    this.handlers = new Map();
    this.setupHandlers();
  }

  // Setup message type handlers
  setupHandlers() {
    this.handlers.set('chat', this.handleTextMessage.bind(this));
    this.handlers.set('image', this.handleImageMessage.bind(this));
    this.handlers.set('video', this.handleVideoMessage.bind(this));
    this.handlers.set('audio', this.handleAudioMessage.bind(this));
    this.handlers.set('voice', this.handleVoiceMessage.bind(this));
    this.handlers.set('document', this.handleDocumentMessage.bind(this));
    this.handlers.set('sticker', this.handleStickerMessage.bind(this));
    this.handlers.set('location', this.handleLocationMessage.bind(this));
    this.handlers.set('contact_card', this.handleContactMessage.bind(this));
    this.handlers.set('contact_card_multi', this.handleMultiContactMessage.bind(this));
    this.handlers.set('revoked', this.handleRevokedMessage.bind(this));
    this.handlers.set('group_invite', this.handleGroupInviteMessage.bind(this));
    this.handlers.set('poll_creation', this.handlePollMessage.bind(this));
    this.handlers.set('unknown', this.handleUnknownMessage.bind(this));
  }

  // Main message processing method
  async processMessage(messageData) {
    try {
      logger.whatsapp(`Processing message type: ${messageData.type}`, {
        messageId: messageData.messageId,
        from: messageData.from,
      });

      // Get appropriate handler
      const handler = this.handlers.get(messageData.type) || this.handlers.get('unknown');
      
      // Process the message
      const result = await handler(messageData);
      
      // Log result to webservice
      await webserviceClient.logWhatsAppEvent('message_processed', {
        messageId: messageData.messageId,
        type: messageData.type,
        result,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      logger.error('Error processing message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Text message handler
  async handleTextMessage(messageData) {
    logger.whatsapp('Processing text message', {
      messageId: messageData.messageId,
      bodyLength: messageData.body?.length,
    });

    try {
      // Check for commands
      if (messageData.body.startsWith(config.bot.prefix)) {
        return await this.handleCommandMessage(messageData);
      }

      // Check for keywords or patterns
      const keywords = await this.extractKeywords(messageData.body);
      
      // Process with webservice
      const result = await webserviceClient.queueJob('process-text-message', {
        messageId: messageData.messageId,
        from: messageData.from,
        body: messageData.body,
        keywords,
        isGroup: messageData.isGroup,
        chatId: messageData.chatId,
      });

      // Auto-reply if configured
      if (config.bot.autoReplyEnabled && this.shouldAutoReply(messageData)) {
        await this.sendAutoReply(messageData);
      }

      return {
        success: true,
        type: 'text',
        processed: true,
        keywords,
        result,
      };
    } catch (error) {
      logger.error('Error handling text message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Image message handler
  async handleImageMessage(messageData) {
    logger.whatsapp('Processing image message', {
      messageId: messageData.messageId,
    });

    try {
      // Queue for media processing
      await queueService.addWhatsAppMediaJob({
        messageId: messageData.messageId,
        type: 'image',
        from: messageData.from,
        chatId: messageData.chatId,
        caption: messageData.body,
      });

      // Process with webservice
      const result = await webserviceClient.queueJob('process-image-message', {
        messageId: messageData.messageId,
        from: messageData.from,
        caption: messageData.body,
        isGroup: messageData.isGroup,
      });

      return {
        success: true,
        type: 'image',
        processed: true,
        queued: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling image message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Video message handler
  async handleVideoMessage(messageData) {
    logger.whatsapp('Processing video message', {
      messageId: messageData.messageId,
    });

    try {
      // Queue for media processing
      await queueService.addWhatsAppMediaJob({
        messageId: messageData.messageId,
        type: 'video',
        from: messageData.from,
        chatId: messageData.chatId,
        caption: messageData.body,
      });

      // Process with webservice
      const result = await webserviceClient.queueJob('process-video-message', {
        messageId: messageData.messageId,
        from: messageData.from,
        caption: messageData.body,
        isGroup: messageData.isGroup,
      });

      return {
        success: true,
        type: 'video',
        processed: true,
        queued: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling video message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Audio message handler
  async handleAudioMessage(messageData) {
    logger.whatsapp('Processing audio message', {
      messageId: messageData.messageId,
    });

    try {
      // Queue for media processing
      await queueService.addWhatsAppMediaJob({
        messageId: messageData.messageId,
        type: 'audio',
        from: messageData.from,
        chatId: messageData.chatId,
      });

      // Process with webservice
      const result = await webserviceClient.queueJob('process-audio-message', {
        messageId: messageData.messageId,
        from: messageData.from,
        isGroup: messageData.isGroup,
      });

      return {
        success: true,
        type: 'audio',
        processed: true,
        queued: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling audio message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Voice message handler
  async handleVoiceMessage(messageData) {
    logger.whatsapp('Processing voice message', {
      messageId: messageData.messageId,
    });

    try {
      // Queue for voice processing (could include transcription)
      await queueService.addWhatsAppMediaJob({
        messageId: messageData.messageId,
        type: 'voice',
        from: messageData.from,
        chatId: messageData.chatId,
        priority: 7, // Higher priority for voice messages
      });

      // Process with webservice
      const result = await webserviceClient.queueJob('process-voice-message', {
        messageId: messageData.messageId,
        from: messageData.from,
        isGroup: messageData.isGroup,
      });

      return {
        success: true,
        type: 'voice',
        processed: true,
        queued: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling voice message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Document message handler
  async handleDocumentMessage(messageData) {
    logger.whatsapp('Processing document message', {
      messageId: messageData.messageId,
    });

    try {
      // Queue for document processing
      await queueService.addWhatsAppMediaJob({
        messageId: messageData.messageId,
        type: 'document',
        from: messageData.from,
        chatId: messageData.chatId,
        filename: messageData.filename,
      });

      // Process with webservice
      const result = await webserviceClient.queueJob('process-document-message', {
        messageId: messageData.messageId,
        from: messageData.from,
        filename: messageData.filename,
        isGroup: messageData.isGroup,
      });

      return {
        success: true,
        type: 'document',
        processed: true,
        queued: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling document message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Sticker message handler
  async handleStickerMessage(messageData) {
    logger.whatsapp('Processing sticker message', {
      messageId: messageData.messageId,
    });

    try {
      // Process with webservice
      const result = await webserviceClient.queueJob('process-sticker-message', {
        messageId: messageData.messageId,
        from: messageData.from,
        isGroup: messageData.isGroup,
      });

      return {
        success: true,
        type: 'sticker',
        processed: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling sticker message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Location message handler
  async handleLocationMessage(messageData) {
    logger.whatsapp('Processing location message', {
      messageId: messageData.messageId,
    });

    try {
      // Extract location data if available
      const locationData = {
        messageId: messageData.messageId,
        from: messageData.from,
        isGroup: messageData.isGroup,
        // Location coordinates would be extracted from the actual message object
      };

      // Process with webservice
      const result = await webserviceClient.queueJob('process-location-message', locationData);

      return {
        success: true,
        type: 'location',
        processed: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling location message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Contact message handler
  async handleContactMessage(messageData) {
    logger.whatsapp('Processing contact message', {
      messageId: messageData.messageId,
    });

    try {
      // Process with webservice
      const result = await webserviceClient.queueJob('process-contact-message', {
        messageId: messageData.messageId,
        from: messageData.from,
        isGroup: messageData.isGroup,
      });

      return {
        success: true,
        type: 'contact',
        processed: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling contact message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Multiple contacts message handler
  async handleMultiContactMessage(messageData) {
    logger.whatsapp('Processing multi-contact message', {
      messageId: messageData.messageId,
    });

    try {
      // Process with webservice
      const result = await webserviceClient.queueJob('process-multi-contact-message', {
        messageId: messageData.messageId,
        from: messageData.from,
        isGroup: messageData.isGroup,
      });

      return {
        success: true,
        type: 'multi-contact',
        processed: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling multi-contact message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Revoked message handler
  async handleRevokedMessage(messageData) {
    logger.whatsapp('Processing revoked message', {
      messageId: messageData.messageId,
    });

    try {
      // Log revoked message event
      const result = await webserviceClient.logWhatsAppEvent('message_revoked', {
        messageId: messageData.messageId,
        from: messageData.from,
        isGroup: messageData.isGroup,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        type: 'revoked',
        processed: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling revoked message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Group invite message handler
  async handleGroupInviteMessage(messageData) {
    logger.whatsapp('Processing group invite message', {
      messageId: messageData.messageId,
    });

    try {
      // Process with webservice
      const result = await webserviceClient.queueJob('process-group-invite-message', {
        messageId: messageData.messageId,
        from: messageData.from,
        isGroup: messageData.isGroup,
      });

      return {
        success: true,
        type: 'group-invite',
        processed: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling group invite message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Poll message handler
  async handlePollMessage(messageData) {
    logger.whatsapp('Processing poll message', {
      messageId: messageData.messageId,
    });

    try {
      // Process with webservice
      const result = await webserviceClient.queueJob('process-poll-message', {
        messageId: messageData.messageId,
        from: messageData.from,
        isGroup: messageData.isGroup,
      });

      return {
        success: true,
        type: 'poll',
        processed: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling poll message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Unknown message type handler
  async handleUnknownMessage(messageData) {
    logger.whatsapp('Processing unknown message type', {
      messageId: messageData.messageId,
      type: messageData.type,
    });

    try {
      // Log unknown message type
      const result = await webserviceClient.logWhatsAppEvent('unknown_message_type', {
        messageId: messageData.messageId,
        type: messageData.type,
        from: messageData.from,
        isGroup: messageData.isGroup,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        type: 'unknown',
        processed: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling unknown message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Command message handler
  async handleCommandMessage(messageData) {
    const command = messageData.body.slice(config.bot.prefix.length).split(' ')[0].toLowerCase();
    const args = messageData.body.slice(config.bot.prefix.length).split(' ').slice(1);

    logger.bot(`Processing command: ${command}`, {
      messageId: messageData.messageId,
      args,
    });

    try {
      // Process command with webservice
      const result = await webserviceClient.queueJob('process-bot-command', {
        messageId: messageData.messageId,
        from: messageData.from,
        command,
        args,
        isGroup: messageData.isGroup,
      });

      return {
        success: true,
        type: 'command',
        command,
        args,
        processed: true,
        result,
      };
    } catch (error) {
      logger.error('Error handling command message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Utility methods
  async extractKeywords(text) {
    if (!text) return [];

    // Simple keyword extraction - can be enhanced with NLP
    const keywords = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10); // Limit to 10 keywords

    return keywords;
  }

  shouldAutoReply(messageData) {
    // Auto-reply logic - can be customized
    if (messageData.isGroup) return false; // No auto-reply in groups
    if (messageData.body.startsWith(config.bot.prefix)) return false; // No auto-reply to commands
    
    // Add more conditions as needed
    return true;
  }

  async sendAutoReply(messageData) {
    try {
      // Queue auto-reply job
      await queueService.addJob(config.queue.name, 'send-auto-reply', {
        to: messageData.from,
        originalMessageId: messageData.messageId,
        message: config.bot.welcomeMessage,
      });

      logger.bot('Auto-reply queued', { messageId: messageData.messageId });
    } catch (error) {
      logger.error('Error queuing auto-reply:', error);
    }
  }

  // Get handler statistics
  getHandlerStats() {
    return {
      totalHandlers: this.handlers.size,
      supportedTypes: Array.from(this.handlers.keys()),
    };
  }
}

module.exports = new MessageHandler();