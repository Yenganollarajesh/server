const { Pool } = require('pg');
require('dotenv').config({ path: './config.env' });

async function checkDatabase() {
  console.log('🔍 Checking database connection...');
  console.log('📋 Configuration:');
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Port: ${process.env.DB_PORT || 5432}`);
  console.log(`   Database: ${process.env.DB_NAME || 'mydb'}`);
  console.log(`   User: ${process.env.DB_USER || 'postgres'}`);
  console.log(`   Password: ${process.env.DB_PASSWORD ? '***' : 'password123'}`);
  
  const pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "mydb",
    password: process.env.DB_PASSWORD || "password123",
    port: process.env.DB_PORT || 5432,
  });

  try {
    // Test basic connection
    console.log('\n🔌 Testing connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connection successful:', result.rows[0].now);
    
    // Test if database exists and has tables
    console.log('\n📊 Checking database structure...');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('⚠️  No tables found in database');
    } else {
      console.log('✅ Tables found:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }
    
    // Check users table specifically
    try {
      const usersResult = await pool.query('SELECT COUNT(*) FROM users');
      console.log(`\n👥 Users table: ${usersResult.rows[0].count} users found`);
    } catch (err) {
      console.log('❌ Users table not accessible:', err.message);
    }
    
  } catch (err) {
    console.error('❌ Database check failed:', err.message);
    console.error('\n🔧 Troubleshooting steps:');
    console.error('1. Make sure PostgreSQL is running');
    console.error('2. Create database: CREATE DATABASE mydb;');
    console.error('3. Check credentials in config.env');
    console.error('4. Try: psql -U postgres -d mydb');
  } finally {
    await pool.end();
  }
}

checkDatabase();
