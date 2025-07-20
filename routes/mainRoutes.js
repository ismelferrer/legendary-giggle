const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /:
 *   post:
 *     summary: Pagina inicial (despues carga el front)
 *     tags: [Main]
 */
router.get('/', (req, res) => {
  res.send('Hola Mundo desde la API!');
});

/**
 * @swagger
 * /health:
 *   post:
 *     summary: Pagina auxiliar, verifica la salud del server
 *     tags: [Main]
 */
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;