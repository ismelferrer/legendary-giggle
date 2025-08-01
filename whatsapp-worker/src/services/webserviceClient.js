const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class WebserviceClient {
  constructor() {
    this.baseURL = config.webservice.apiUrl;
    this.apiToken = config.webservice.apiToken;
    this.timeout = config.webservice.timeout;
    
    this.client = this.createClient();
  }

  createClient() {
    const clientConfig = {
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp-Worker/1.0.0',
      },
    };

    // Add authorization header if token is provided
    if (this.apiToken) {
      clientConfig.headers['Authorization'] = `Bearer ${this.apiToken}`;
    }

    const client = axios.create(clientConfig);

    // Request interceptor
    client.interceptors.request.use(
      (config) => {
        logger.webservice(`Making ${config.method.toUpperCase()} request to ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    client.interceptors.response.use(
      (response) => {
        logger.webservice(`Response received: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error(`API Error: ${error.response.status} - ${error.response.statusText}`, {
            url: error.config?.url,
            data: error.response.data,
          });
        } else if (error.request) {
          logger.error('Network Error: No response received', {
            url: error.config?.url,
          });
        } else {
          logger.error('Request setup error:', error.message);
        }
        return Promise.reject(error);
      }
    );

    return client;
  }

  // Generic HTTP methods
  async get(endpoint, params = {}) {
    try {
      const response = await this.client.get(endpoint, { params });
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async post(endpoint, data = {}) {
    try {
      const response = await this.client.post(endpoint, data);
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async put(endpoint, data = {}) {
    try {
      const response = await this.client.put(endpoint, data);
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete(endpoint) {
    try {
      const response = await this.client.delete(endpoint);
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Worker-specific API methods
  async registerWorker(workerInfo) {
    return await this.post('/api/worker/register', {
      type: 'whatsapp-bot',
      status: 'active',
      capabilities: ['message-processing', 'file-handling', 'webhook-processing'],
      ...workerInfo,
    });
  }

  async updateWorkerStatus(status, details = {}) {
    return await this.post('/api/worker/status', {
      status,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  async reportWorkerHealth() {
    return await this.get('/api/worker/health');
  }

  // Job management API methods
  async queueJob(jobType, jobData, options = {}) {
    return await this.post('/api/worker/jobs', {
      type: jobType,
      data: jobData,
      options,
    });
  }

  async getJobStatus(jobId) {
    return await this.get(`/api/worker/jobs/${jobId}/status`);
  }

  async queueBatchJobs(jobs) {
    return await this.post('/api/worker/jobs/batch', { jobs });
  }

  async getQueueStats() {
    return await this.get('/api/worker/queue/stats');
  }

  // WhatsApp-specific API methods
  async sendWhatsAppMessage(to, message, options = {}) {
    return await this.post('/api/whatsapp/send', {
      to,
      message,
      ...options,
    });
  }

  async logWhatsAppEvent(eventType, eventData) {
    return await this.post('/api/whatsapp/events', {
      type: eventType,
      data: eventData,
      timestamp: new Date().toISOString(),
    });
  }

  async getWhatsAppSettings() {
    return await this.get('/api/whatsapp/settings');
  }

  // User and data management
  async getUser(userId) {
    return await this.get(`/api/users/${userId}`);
  }

  async createUser(userData) {
    return await this.post('/api/users', userData);
  }

  async updateUser(userId, userData) {
    return await this.put(`/api/users/${userId}`, userData);
  }

  // Supabase integration methods
  async syncToSupabase(table, data) {
    return await this.post('/api/supabase/sync', {
      table,
      data,
      source: 'whatsapp-worker',
    });
  }

  async querySupabase(table, filters = {}) {
    return await this.post('/api/supabase/query', {
      table,
      filters,
    });
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.get('/health');
      return response.success && response.status === 200;
    } catch (error) {
      logger.error('Health check failed:', error.message);
      return false;
    }
  }

  // Error handler
  handleError(error) {
    const errorResponse = {
      success: false,
      error: error.message,
      status: error.response?.status,
    };

    if (error.response?.data) {
      errorResponse.details = error.response.data;
    }

    return errorResponse;
  }

  // Connection test
  async testConnection() {
    logger.webservice('Testing connection to webservice...');
    
    const isHealthy = await this.healthCheck();
    
    if (isHealthy) {
      logger.webservice('✅ Connection to webservice established successfully');
      return true;
    } else {
      logger.error('❌ Failed to connect to webservice');
      return false;
    }
  }
}

module.exports = new WebserviceClient();