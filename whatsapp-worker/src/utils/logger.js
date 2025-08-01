const winston = require('winston');
const path = require('path');
const config = require('../config');

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(logColors);

// Create log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// Create transports
const transports = [];

// Console transport
transports.push(
  new winston.transports.Console({
    level: config.logging.level,
    format: consoleFormat,
  })
);

// File transport
if (config.logging.file) {
  // Ensure logs directory exists
  const fs = require('fs');
  const logDir = path.dirname(config.logging.file);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  transports.push(
    new winston.transports.File({
      filename: config.logging.file,
      level: config.logging.level,
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: config.logging.file.replace('.log', '.error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  levels: logLevels,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Morgan stream for HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Add helper methods
logger.whatsapp = (message, meta = {}) => {
  logger.info(`[WhatsApp] ${message}`, meta);
};

logger.worker = (message, meta = {}) => {
  logger.info(`[Worker] ${message}`, meta);
};

logger.webservice = (message, meta = {}) => {
  logger.info(`[Webservice] ${message}`, meta);
};

logger.bot = (message, meta = {}) => {
  logger.info(`[Bot] ${message}`, meta);
};

logger.queue = (message, meta = {}) => {
  logger.info(`[Queue] ${message}`, meta);
};

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = logger;