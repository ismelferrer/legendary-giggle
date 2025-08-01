const { User } = require('../models');
const supabaseService = require('../services/supabaseService');
const workerService = require('../services/workerService');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

exports.register = async (req, res) => {
  try {
    // Create user in Sequelize (existing functionality)
    const user = await User.create(req.body);
    
    // Also save to Supabase
    const supabaseResult = await supabaseService.createUser({
      username: req.body.username,
      nombre: req.body.nombre,
      email: req.body.email,
      sequelize_id: user.id,
      created_at: new Date().toISOString()
    });

    // Queue welcome email in background
    if (req.body.email) {
      await workerService.queueEmailSend({
        to: req.body.email,
        type: 'welcome',
        userData: {
          username: req.body.username,
          nombre: req.body.nombre
        }
      });
    }

    // Queue user analytics processing
    await workerService.queueDataProcessing({
      event: 'user_registered',
      userId: user.id,
      timestamp: new Date().toISOString(),
      metadata: {
        username: req.body.username,
        source: req.headers['user-agent'] || 'unknown'
      }
    });

    res.status(201).json({ 
      message: 'Usuario registrado exitosamente', 
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre
      },
      supabase: supabaseResult.success 
    });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(400).json({ error: 'Error al registrar usuario', details: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Queue failed login attempt for security monitoring
      await workerService.queueDataProcessing({
        event: 'login_failed',
        username: username,
        ip: req.ip,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent']
      });
      
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    // Update last login in Supabase
    await supabaseService.update('users', user.id, {
      last_login: new Date().toISOString(),
      login_count: user.login_count ? user.login_count + 1 : 1
    });

    // Queue successful login analytics
    await workerService.queueDataProcessing({
      event: 'user_login',
      userId: user.id,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent']
    });

    res.json({ 
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre
      }
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.editUser = async (req, res) => {
  try {
    const { username, email, nombre } = req.body;
    const oldData = { ...req.user.dataValues };
    
    // Update in Sequelize
    req.user.username = username || req.user.username;
    req.user.email = email || req.user.email;
    req.user.nombre = nombre || req.user.nombre;
    await req.user.save();

    // Update in Supabase
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (nombre) updateData.nombre = nombre;
    updateData.updated_at = new Date().toISOString();

    const supabaseResult = await supabaseService.update('users', req.user.id, updateData);

    // Queue profile update notification
    if (email && email !== oldData.email) {
      await workerService.queueEmailSend({
        to: email,
        type: 'profile_updated',
        userData: {
          username: req.user.username,
          changes: Object.keys(updateData)
        }
      });
    }

    // Queue analytics for profile update
    await workerService.queueDataProcessing({
      event: 'user_profile_updated',
      userId: req.user.id,
      changes: updateData,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      message: 'Usuario actualizado exitosamente', 
      user: {
        id: req.user.id,
        username: req.user.username,
        nombre: req.user.nombre,
        email: req.user.email
      },
      supabase: supabaseResult.success
    });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Error al actualizar usuario', details: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const userData = { ...req.user.dataValues };

    // Queue account deletion notification email
    if (userData.email) {
      await workerService.queueEmailSend({
        to: userData.email,
        type: 'account_deleted',
        userData: {
          username: userData.username,
          nombre: userData.nombre
        }
      });
    }

    // Queue data cleanup tasks
    await workerService.queueCleanupTask({
      type: 'user_data_cleanup',
      userId: userId,
      timestamp: new Date().toISOString()
    });

    // Delete from Sequelize
    await req.user.destroy();

    // Delete from Supabase (soft delete)
    await supabaseService.update('users', userId, {
      deleted_at: new Date().toISOString(),
      status: 'deleted'
    });

    // Queue analytics for account deletion
    await workerService.queueDataProcessing({
      event: 'user_deleted',
      userId: userId,
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Error al eliminar usuario', details: err.message });
  }
};

// New controller methods for Supabase and worker integration

exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user data from Supabase
    const supabaseResult = await supabaseService.findById('users', userId);
    
    if (!supabaseResult.success) {
      return res.status(404).json({ error: 'Perfil no encontrado en Supabase' });
    }

    res.json({
      success: true,
      user: req.user,
      supabaseProfile: supabaseResult.data
    });
  } catch (err) {
    console.error('Error getting user profile:', err);
    res.status(500).json({ error: 'Error al obtener perfil de usuario' });
  }
};

exports.syncUserData = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Sync Sequelize data to Supabase
    const syncResult = await supabaseService.update('users', userId, {
      username: req.user.username,
      nombre: req.user.nombre,
      email: req.user.email,
      synced_at: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Datos sincronizados exitosamente',
      supabaseSync: syncResult.success
    });
  } catch (err) {
    console.error('Error syncing user data:', err);
    res.status(500).json({ error: 'Error al sincronizar datos' });
  }
};
