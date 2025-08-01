const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Database connections
const { sequelize } = require('./models');
const { connectRedis } = require('./config/redis');

// Routes
const userRoutes = require('./routes/userRoutes');
const mainRoutes = require('./routes/mainRoutes');
const workerRoutes = require('./routes/workerRoutes');
const supabaseRoutes = require('./routes/supabaseRoutes');

// Swagger documentation
const { swaggerUi, specs } = require('./swagger');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Main routes
app.use('/', mainRoutes);

// API routes
app.use('/api', userRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/supabase', supabaseRoutes);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Health check endpoint with extended information
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: {
      sequelize: 'Connected',
      redis: process.env.REDIS_URL ? 'Configured' : 'Not configured',
      supabase: process.env.SUPABASE_URL ? 'Configured' : 'Not configured',
      worker: process.env.WORKER_API_URL ? 'Configured' : 'Not configured'
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

// Initialize connections and start server
const startServer = async () => {
  try {
    // Initialize Sequelize
    await sequelize.sync();
    console.log('✅ Sequelize connected and synced');

    // Initialize Redis connection if configured
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      await connectRedis();
      console.log('✅ Redis connected for background job processing');
    } else {
      console.log('⚠️  Redis not configured - background jobs will not work');
    }

    // Verify Supabase configuration
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      console.log('✅ Supabase configured');
    } else {
      console.log('⚠️  Supabase not configured - some features may not work');
    }

    // Verify Worker configuration
    if (process.env.WORKER_API_URL) {
      console.log('✅ Background worker API configured');
    } else {
      console.log('⚠️  Background worker API not configured');
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📚 Documentación API disponible en http://localhost:${PORT}/api-docs`);
      console.log(`🔍 Health check disponible en http://localhost:${PORT}/health`);
    });

  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  try {
    // Close database connections
    await sequelize.close();
    console.log('Sequelize connection closed');

    // Close queue connections
    const queueService = require('./services/queueService');
    await queueService.closeAll();
    console.log('Queue connections closed');

    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  
  try {
    await sequelize.close();
    const queueService = require('./services/queueService');
    await queueService.closeAll();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();




