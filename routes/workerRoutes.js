const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const workerService = require('../services/workerService');

/**
 * @swagger
 * api/worker/jobs:
 *   post:
 *     summary: Encola un trabajo en el background worker
 *     tags: [Worker]
 */
router.post('/jobs', auth, async (req, res) => {
  try {
    const { type, data, options } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({ error: 'Tipo de trabajo y datos son requeridos' });
    }

    let result;
    switch (type) {
      case 'process-data':
        result = await workerService.queueDataProcessing(data, options);
        break;
      case 'send-email':
        result = await workerService.queueEmailSend(data, options);
        break;
      case 'process-file':
        result = await workerService.queueFileProcessing(data, options);
        break;
      case 'send-webhook':
        result = await workerService.queueWebhookSend(data, options);
        break;
      case 'cleanup-task':
        result = await workerService.queueCleanupTask(data, options);
        break;
      default:
        return res.status(400).json({ error: `Tipo de trabajo no válido: ${type}` });
    }

    res.json(result);
  } catch (error) {
    console.error('Error queueing job:', error);
    res.status(500).json({ error: 'Error al encolar trabajo' });
  }
});

/**
 * @swagger
 * api/worker/jobs/batch:
 *   post:
 *     summary: Encola múltiples trabajos en batch
 *     tags: [Worker]
 */
router.post('/jobs/batch', auth, async (req, res) => {
  try {
    const { jobs } = req.body;
    
    if (!jobs || !Array.isArray(jobs)) {
      return res.status(400).json({ error: 'Array de trabajos es requerido' });
    }

    const result = await workerService.queueBatchJobs(jobs);
    res.json(result);
  } catch (error) {
    console.error('Error queueing batch jobs:', error);
    res.status(500).json({ error: 'Error al encolar trabajos en batch' });
  }
});

/**
 * @swagger
 * api/worker/jobs/{jobId}/status:
 *   get:
 *     summary: Obtiene el estado de un trabajo específico
 *     tags: [Worker]
 */
router.get('/jobs/:jobId/status', auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await workerService.getJobStatus(jobId);
    res.json(result);
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({ error: 'Error al obtener estado del trabajo' });
  }
});

/**
 * @swagger
 * api/worker/queue/stats:
 *   get:
 *     summary: Obtiene estadísticas de la cola de trabajos
 *     tags: [Worker]
 */
router.get('/queue/stats', auth, async (req, res) => {
  try {
    const result = await workerService.getQueueStats();
    res.json(result);
  } catch (error) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de la cola' });
  }
});

/**
 * @swagger
 * api/worker/queue/pause:
 *   post:
 *     summary: Pausa la cola de trabajos
 *     tags: [Worker]
 */
router.post('/queue/pause', auth, async (req, res) => {
  try {
    const result = await workerService.pauseQueue();
    res.json(result);
  } catch (error) {
    console.error('Error pausing queue:', error);
    res.status(500).json({ error: 'Error al pausar la cola' });
  }
});

/**
 * @swagger
 * api/worker/queue/resume:
 *   post:
 *     summary: Reanuda la cola de trabajos
 *     tags: [Worker]
 */
router.post('/queue/resume', auth, async (req, res) => {
  try {
    const result = await workerService.resumeQueue();
    res.json(result);
  } catch (error) {
    console.error('Error resuming queue:', error);
    res.status(500).json({ error: 'Error al reanudar la cola' });
  }
});

/**
 * @swagger
 * api/worker/queue/clean:
 *   post:
 *     summary: Limpia trabajos completados de la cola
 *     tags: [Worker]
 */
router.post('/queue/clean', auth, async (req, res) => {
  try {
    const result = await workerService.cleanQueue();
    res.json(result);
  } catch (error) {
    console.error('Error cleaning queue:', error);
    res.status(500).json({ error: 'Error al limpiar la cola' });
  }
});

/**
 * @swagger
 * api/worker/status:
 *   get:
 *     summary: Obtiene el estado del worker externo
 *     tags: [Worker]
 */
router.get('/status', auth, async (req, res) => {
  try {
    const result = await workerService.getWorkerStatus();
    res.json(result);
  } catch (error) {
    console.error('Error getting worker status:', error);
    res.status(500).json({ error: 'Error al obtener estado del worker' });
  }
});

/**
 * @swagger
 * api/worker/health:
 *   get:
 *     summary: Verifica la salud del worker externo
 *     tags: [Worker]
 */
router.get('/health', auth, async (req, res) => {
  try {
    const result = await workerService.getWorkerHealth();
    res.json(result);
  } catch (error) {
    console.error('Error getting worker health:', error);
    res.status(500).json({ error: 'Error al verificar salud del worker' });
  }
});

/**
 * @swagger
 * api/worker/schedule:
 *   post:
 *     summary: Programa un trabajo recurrente
 *     tags: [Worker]
 */
router.post('/schedule', auth, async (req, res) => {
  try {
    const { jobType, data, cronPattern, options } = req.body;
    
    if (!jobType || !data || !cronPattern) {
      return res.status(400).json({ 
        error: 'Tipo de trabajo, datos y patrón cron son requeridos' 
      });
    }

    const result = await workerService.scheduleRecurringJob(jobType, data, cronPattern, options);
    res.json(result);
  } catch (error) {
    console.error('Error scheduling job:', error);
    res.status(500).json({ error: 'Error al programar trabajo' });
  }
});

/**
 * @swagger
 * api/worker/delay:
 *   post:
 *     summary: Programa un trabajo con retraso
 *     tags: [Worker]
 */
router.post('/delay', auth, async (req, res) => {
  try {
    const { jobType, data, delayMs, options } = req.body;
    
    if (!jobType || !data || !delayMs) {
      return res.status(400).json({ 
        error: 'Tipo de trabajo, datos y tiempo de retraso son requeridos' 
      });
    }

    const result = await workerService.scheduleDelayedJob(jobType, data, delayMs, options);
    res.json(result);
  } catch (error) {
    console.error('Error scheduling delayed job:', error);
    res.status(500).json({ error: 'Error al programar trabajo con retraso' });
  }
});

module.exports = router;