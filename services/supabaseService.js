const { supabase, supabaseAdmin } = require('../config/supabase');

class SupabaseService {
  constructor() {
    this.client = supabase;
    this.admin = supabaseAdmin;
  }

  // User operations
  async createUser(userData) {
    try {
      const { data, error } = await this.client
        .from('users')
        .insert([userData])
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserById(id) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting user:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserByUsername(username) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting user by username:', error);
      return { success: false, error: error.message };
    }
  }

  async updateUser(id, updateData) {
    try {
      const { data, error } = await this.client
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteUser(id) {
    try {
      const { error } = await this.client
        .from('users')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: error.message };
    }
  }

  async getAllUsers(limit = 100, offset = 0) {
    try {
      const { data, error, count } = await this.client
        .from('users')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1);
      
      if (error) throw error;
      return { success: true, data, count };
    } catch (error) {
      console.error('Error getting users:', error);
      return { success: false, error: error.message };
    }
  }

  // Generic CRUD operations for any table
  async create(table, data) {
    try {
      const { data: result, error } = await this.client
        .from(table)
        .insert([data])
        .select();
      
      if (error) throw error;
      return { success: true, data: result[0] };
    } catch (error) {
      console.error(`Error creating record in ${table}:`, error);
      return { success: false, error: error.message };
    }
  }

  async findById(table, id) {
    try {
      const { data, error } = await this.client
        .from(table)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error(`Error finding record in ${table}:`, error);
      return { success: false, error: error.message };
    }
  }

  async update(table, id, updateData) {
    try {
      const { data, error } = await this.client
        .from(table)
        .update(updateData)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      console.error(`Error updating record in ${table}:`, error);
      return { success: false, error: error.message };
    }
  }

  async delete(table, id) {
    try {
      const { error } = await this.client
        .from(table)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error(`Error deleting record in ${table}:`, error);
      return { success: false, error: error.message };
    }
  }

  async findAll(table, options = {}) {
    try {
      const { limit = 100, offset = 0, orderBy = 'created_at', order = 'desc', filters = {} } = options;
      
      let query = this.client
        .from(table)
        .select('*', { count: 'exact' });

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      // Apply ordering and pagination
      const { data, error, count } = await query
        .order(orderBy, { ascending: order === 'asc' })
        .range(offset, offset + limit - 1);
      
      if (error) throw error;
      return { success: true, data, count };
    } catch (error) {
      console.error(`Error finding records in ${table}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Real-time subscriptions
  subscribeToTable(table, callback, filter = null) {
    let subscription = this.client
      .channel(`${table}_changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback);

    if (filter) {
      subscription = subscription.on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table, 
        filter 
      }, callback);
    }

    subscription.subscribe();
    return subscription;
  }

  // Authentication helpers
  async signUp(email, password, userData = {}) {
    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error signing up:', error);
      return { success: false, error: error.message };
    }
  }

  async signIn(email, password) {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error signing in:', error);
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    try {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      return { success: false, error: error.message };
    }
  }

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await this.client.auth.getUser();
      if (error) throw error;
      return { success: true, data: user };
    } catch (error) {
      console.error('Error getting current user:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SupabaseService();