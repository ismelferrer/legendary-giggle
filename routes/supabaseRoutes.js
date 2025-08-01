const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');

/**
 * @swagger
 * api/supabase/tables/{table}/records:
 *   get:
 *     summary: Obtiene registros de una tabla de Supabase
 *     tags: [Supabase]
 */
router.get('/tables/:table/records', auth, async (req, res) => {
  try {
    const { table } = req.params;
    const { limit = 100, offset = 0, orderBy = 'created_at', order = 'desc' } = req.query;
    
    const filters = {};
    Object.keys(req.query).forEach(key => {
      if (!['limit', 'offset', 'orderBy', 'order'].includes(key)) {
        filters[key] = req.query[key];
      }
    });

    const result = await supabaseService.findAll(table, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy,
      order,
      filters
    });

    res.json(result);
  } catch (error) {
    console.error('Error getting records:', error);
    res.status(500).json({ error: 'Error al obtener registros' });
  }
});

/**
 * @swagger
 * api/supabase/tables/{table}/records:
 *   post:
 *     summary: Crea un nuevo registro en una tabla de Supabase
 *     tags: [Supabase]
 */
router.post('/tables/:table/records', auth, async (req, res) => {
  try {
    const { table } = req.params;
    const data = {
      ...req.body,
      created_by: req.user.id,
      created_at: new Date().toISOString()
    };

    const result = await supabaseService.create(table, data);
    res.json(result);
  } catch (error) {
    console.error('Error creating record:', error);
    res.status(500).json({ error: 'Error al crear registro' });
  }
});

/**
 * @swagger
 * api/supabase/tables/{table}/records/{id}:
 *   get:
 *     summary: Obtiene un registro específico por ID
 *     tags: [Supabase]
 */
router.get('/tables/:table/records/:id', auth, async (req, res) => {
  try {
    const { table, id } = req.params;
    const result = await supabaseService.findById(table, id);
    res.json(result);
  } catch (error) {
    console.error('Error getting record:', error);
    res.status(500).json({ error: 'Error al obtener registro' });
  }
});

/**
 * @swagger
 * api/supabase/tables/{table}/records/{id}:
 *   put:
 *     summary: Actualiza un registro específico
 *     tags: [Supabase]
 */
router.put('/tables/:table/records/:id', auth, async (req, res) => {
  try {
    const { table, id } = req.params;
    const data = {
      ...req.body,
      updated_by: req.user.id,
      updated_at: new Date().toISOString()
    };

    const result = await supabaseService.update(table, id, data);
    res.json(result);
  } catch (error) {
    console.error('Error updating record:', error);
    res.status(500).json({ error: 'Error al actualizar registro' });
  }
});

/**
 * @swagger
 * api/supabase/tables/{table}/records/{id}:
 *   delete:
 *     summary: Elimina un registro específico
 *     tags: [Supabase]
 */
router.delete('/tables/:table/records/:id', auth, async (req, res) => {
  try {
    const { table, id } = req.params;
    const result = await supabaseService.delete(table, id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting record:', error);
    res.status(500).json({ error: 'Error al eliminar registro' });
  }
});

/**
 * @swagger
 * api/supabase/auth/signup:
 *   post:
 *     summary: Registra un usuario usando Supabase Auth
 *     tags: [Supabase Auth]
 */
router.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, userData } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const result = await supabaseService.signUp(email, password, userData);
    res.json(result);
  } catch (error) {
    console.error('Error signing up:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

/**
 * @swagger
 * api/supabase/auth/signin:
 *   post:
 *     summary: Inicia sesión usando Supabase Auth
 *     tags: [Supabase Auth]
 */
router.post('/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const result = await supabaseService.signIn(email, password);
    res.json(result);
  } catch (error) {
    console.error('Error signing in:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

/**
 * @swagger
 * api/supabase/auth/signout:
 *   post:
 *     summary: Cierra sesión usando Supabase Auth
 *     tags: [Supabase Auth]
 */
router.post('/auth/signout', auth, async (req, res) => {
  try {
    const result = await supabaseService.signOut();
    res.json(result);
  } catch (error) {
    console.error('Error signing out:', error);
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

/**
 * @swagger
 * api/supabase/auth/user:
 *   get:
 *     summary: Obtiene el usuario actual de Supabase Auth
 *     tags: [Supabase Auth]
 */
router.get('/auth/user', auth, async (req, res) => {
  try {
    const result = await supabaseService.getCurrentUser();
    res.json(result);
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({ error: 'Error al obtener usuario actual' });
  }
});

/**
 * @swagger
 * api/supabase/subscribe/{table}:
 *   post:
 *     summary: Establece una suscripción en tiempo real a una tabla
 *     tags: [Supabase Real-time]
 */
router.post('/subscribe/:table', auth, async (req, res) => {
  try {
    const { table } = req.params;
    const { filter } = req.body;
    
    // Note: This is a demonstration. In a real application, you'd need to handle
    // WebSocket connections properly for real-time subscriptions
    res.json({
      success: true,
      message: `Subscription to table ${table} would be established here`,
      table,
      filter
    });
  } catch (error) {
    console.error('Error setting up subscription:', error);
    res.status(500).json({ error: 'Error al establecer suscripción' });
  }
});

module.exports = router;