const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../utils/logger');

class SupabaseAuthStrategy {
  constructor(options = {}) {
    this.sessionName = options.sessionName || config.whatsapp.sessionName;
    this.tableName = 'whatsapp_sessions';
    this.supabaseUrl = config.supabase.url;
    this.supabaseKey = config.supabase.serviceRoleKey;
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase URL and Service Role Key are required for session storage');
    }
    
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    this.sessionData = null;
    this.authenticated = false;
    
    logger.info('SupabaseAuthStrategy initialized', { sessionName: this.sessionName });
  }

  async setup() {
    try {
      // Create table if it doesn't exist
      await this.createSessionTable();
      
      // Load existing session
      await this.loadSession();
      
      logger.info('Supabase auth strategy setup completed');
      return true;
    } catch (error) {
      logger.error('Error setting up Supabase auth strategy:', error);
      return false;
    }
  }

  async createSessionTable() {
    try {
      // Check if table exists
      const { data: tables, error: listError } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', this.tableName);

      if (listError && !listError.message.includes('relation "information_schema.tables" does not exist')) {
        throw listError;
      }

      // If table doesn't exist, create it
      if (!tables || tables.length === 0) {
        logger.info('Creating whatsapp_sessions table in Supabase...');
        
        // Note: In a real deployment, you should create this table manually in Supabase
        // or use migrations. This is a fallback for development.
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS ${this.tableName} (
            id SERIAL PRIMARY KEY,
            session_name VARCHAR(255) UNIQUE NOT NULL,
            session_data JSONB NOT NULL,
            authenticated BOOLEAN DEFAULT FALSE,
            last_seen TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_session_name ON ${this.tableName}(session_name);
        `;

        // Execute raw SQL (this requires elevated permissions)
        const { error: createError } = await this.supabase.rpc('exec_sql', {
          sql: createTableSQL
        });

        if (createError) {
          logger.warn('Could not create table automatically:', createError.message);
          logger.info('Please create the whatsapp_sessions table manually in Supabase');
        } else {
          logger.info('whatsapp_sessions table created successfully');
        }
      }
    } catch (error) {
      logger.warn('Table creation check failed, assuming table exists:', error.message);
    }
  }

  async loadSession() {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('session_name', this.sessionName)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        this.sessionData = data.session_data;
        this.authenticated = data.authenticated || false;
        
        logger.info('Session loaded from Supabase', {
          sessionName: this.sessionName,
          authenticated: this.authenticated,
          lastSeen: data.last_seen
        });

        // Update last seen
        await this.updateLastSeen();
      } else {
        logger.info('No existing session found in Supabase');
        this.sessionData = null;
        this.authenticated = false;
      }
    } catch (error) {
      logger.error('Error loading session from Supabase:', error);
      this.sessionData = null;
      this.authenticated = false;
    }
  }

  async saveSession(sessionData) {
    try {
      const sessionRecord = {
        session_name: this.sessionName,
        session_data: sessionData,
        authenticated: true,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Try to update first
      const { data: updateData, error: updateError } = await this.supabase
        .from(this.tableName)
        .update(sessionRecord)
        .eq('session_name', this.sessionName)
        .select();

      // If no rows were updated, insert new record
      if (!updateError && (!updateData || updateData.length === 0)) {
        sessionRecord.created_at = new Date().toISOString();
        
        const { error: insertError } = await this.supabase
          .from(this.tableName)
          .insert(sessionRecord);

        if (insertError) {
          throw insertError;
        }

        logger.info('New session saved to Supabase');
      } else if (updateError) {
        throw updateError;
      } else {
        logger.info('Session updated in Supabase');
      }

      this.sessionData = sessionData;
      this.authenticated = true;

    } catch (error) {
      logger.error('Error saving session to Supabase:', error);
      throw error;
    }
  }

  async deleteSession() {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('session_name', this.sessionName);

      if (error) {
        throw error;
      }

      this.sessionData = null;
      this.authenticated = false;

      logger.info('Session deleted from Supabase');
    } catch (error) {
      logger.error('Error deleting session from Supabase:', error);
      throw error;
    }
  }

  async updateLastSeen() {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .update({ 
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('session_name', this.sessionName);

      if (error) {
        logger.debug('Error updating last seen:', error.message);
      }
    } catch (error) {
      logger.debug('Error updating last seen:', error.message);
    }
  }

  async setAuthenticated(authenticated = true) {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .update({ 
          authenticated,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('session_name', this.sessionName);

      if (error) {
        throw error;
      }

      this.authenticated = authenticated;
      logger.info('Authentication status updated', { authenticated });
    } catch (error) {
      logger.error('Error updating authentication status:', error);
    }
  }

  // Required methods for whatsapp-web.js auth strategy

  async beforeBrowserInitialized() {
    logger.info('Initializing browser for WhatsApp client');
  }

  async logout() {
    try {
      await this.setAuthenticated(false);
      logger.info('Logged out from WhatsApp');
    } catch (error) {
      logger.error('Error during logout:', error);
    }
  }

  async destroy() {
    try {
      // Keep session data but mark as not authenticated
      await this.setAuthenticated(false);
      logger.info('Auth strategy destroyed');
    } catch (error) {
      logger.error('Error destroying auth strategy:', error);
    }
  }

  async getWebAuthSession() {
    return this.sessionData;
  }

  async setWebAuthSession(sessionData) {
    await this.saveSession(sessionData);
  }

  async hasWebAuthSession() {
    return this.sessionData !== null;
  }

  // Utility methods

  getSessionInfo() {
    return {
      sessionName: this.sessionName,
      authenticated: this.authenticated,
      hasSession: this.sessionData !== null,
      tableName: this.tableName
    };
  }

  async getAllSessions() {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('session_name, authenticated, last_seen, created_at')
        .order('last_seen', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting all sessions:', error);
      return [];
    }
  }

  async cleanupOldSessions(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .lt('last_seen', cutoffDate.toISOString());

      if (error) {
        throw error;
      }

      logger.info('Old sessions cleaned up', { daysOld });
    } catch (error) {
      logger.error('Error cleaning up old sessions:', error);
    }
  }
}

module.exports = SupabaseAuthStrategy;