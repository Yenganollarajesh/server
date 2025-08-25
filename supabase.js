const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config.env' });

// Supabase client configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test Supabase connection
async function testSupabaseConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    console.log('🔍 URL:', supabaseUrl);
    console.log('🔍 Service Key length:', supabaseServiceKey ? supabaseServiceKey.length : 'undefined');
    
    // Simple connection test - try to query a basic table
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection test failed:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (err) {
    console.error('❌ Supabase connection error:', err);
    return false;
  }
}

// Helper function to get Supabase client
function getSupabaseClient() {
  return supabase;
}

// Check if required tables exist
async function checkTablesExist() {
  try {
    const requiredTables = ['users', 'conversations', 'messages'];
    const existingTables = [];
    
    for (const tableName of requiredTables) {
      try {
        // Try to query each table to see if it exists
        const { data, error } = await supabase
          .from(tableName)
          .select('id')
          .limit(1);
        
        if (!error) {
          existingTables.push(tableName);
          console.log(`✅ Table '${tableName}' exists`);
        } else {
          console.log(`❌ Table '${tableName}' error:`, error.message);
        }
      } catch (err) {
        console.log(`❌ Table '${tableName}' not accessible:`, err.message);
      }
    }
    
    console.log('📊 Existing tables in Supabase:', existingTables);
    
    if (existingTables.length === requiredTables.length) {
      console.log('✅ All required tables exist');
      return true;
    } else {
      console.log('⚠️ Missing tables:', requiredTables.filter(t => !existingTables.includes(t)));
      return false;
    }
  } catch (err) {
    console.error('❌ Error checking tables:', err);
    return false;
  }
}

module.exports = {
  supabase,
  testSupabaseConnection,
  getSupabaseClient,
  checkTablesExist
};
