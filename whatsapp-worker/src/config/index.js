require('dotenv').config();

const config = {
  // Server configuration
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Webservice API configuration
  webservice: {
    apiUrl: process.env.WEBSERVICE_API_URL || 'http://localhost:3000',
    apiToken: process.env.WEBSERVICE_API_TOKEN,
    timeout: 30000,
  },

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  },

  // Supabase configuration
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  // WhatsApp configuration
  whatsapp: {
    sessionName: process.env.WHATSAPP_SESSION_NAME || 'whatsapp-session',
    webhookUrl: process.env.WHATSAPP_WEBHOOK_URL,
    useSupabaseAuth: process.env.USE_SUPABASE_AUTH === 'true',
    clientOptions: {
      authStrategy: 'SupabaseAuth',
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--disable-background-networking',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-first-run',
          '--safebrowsing-disable-auto-update',
          '--disable-ipc-flooding-protection'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        timeout: 60000
      }
    }
  },

  // Worker configuration
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 5,
    maxRetries: parseInt(process.env.WORKER_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.WORKER_RETRY_DELAY) || 5000,
  },

  // Security configuration
  security: {
    apiSecretKey: process.env.API_SECRET_KEY,
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/worker.log',
  },

  // Queue configuration
  queue: {
    name: process.env.QUEUE_NAME || 'whatsapp-jobs',
    removeOnComplete: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE) || 10,
    removeOnFail: parseInt(process.env.QUEUE_REMOVE_ON_FAIL) || 5,
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },

  // Bot configuration
  bot: {
    prefix: process.env.BOT_PREFIX || '!',
    adminNumbers: process.env.BOT_ADMIN_NUMBERS?.split(',') || [],
    autoReplyEnabled: process.env.BOT_AUTO_REPLY_ENABLED === 'true',
    welcomeMessage: process.env.BOT_WELCOME_MESSAGE || '¡Hola! Soy un bot de WhatsApp. Envía !help para ver los comandos disponibles.',
  },
};

// Validation
const requiredEnvVars = [
  'WEBSERVICE_API_URL',
];

// Supabase variables are required if using Supabase auth
const supabaseAuthEnabled = process.env.USE_SUPABASE_AUTH === 'true';
if (supabaseAuthEnabled) {
  requiredEnvVars.push('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn('⚠️ Missing environment variables:', missingEnvVars.join(', '));
  console.warn('⚠️ Some features may not work correctly. Please check your .env file.');
}

if (supabaseAuthEnabled) {
  console.info('✅ Supabase authentication enabled for WhatsApp sessions');
} else {
  console.warn('⚠️ Using local file authentication - not suitable for Render deployment');
}

module.exports = config;