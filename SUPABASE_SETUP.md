# 🚀 Supabase Setup Guide for ChatApp

## 📋 Prerequisites
- Supabase account and project created
- Your project URL and API keys

## 🔧 Step-by-Step Setup

### 1. Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://omirgqdtwdawuaajfpnl.supabase.co
2. Navigate to **Settings** → **Database**
3. Copy the **Database Password**
4. Go to **Settings** → **API**
5. Copy the **service_role** key (not the anon key)

### 2. Update Your Configuration

Edit `server/config.env` and replace these values:

```env
# Database Configuration - Supabase
DB_USER=postgres
DB_HOST=db.omirgqdtwdawuaajfpnl.supabase.co
DB_NAME=postgres
DB_PASSWORD=YOUR_ACTUAL_DATABASE_PASSWORD_HERE
DB_PORT=5432

# Supabase Configuration
SUPABASE_URL=https://omirgqdtwdawuaajfpnl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taXJncWR0d2Rhd3VhYWpmcG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMzQ2NjcsImV4cCI6MjA3MTcxMDY2N30.g6kZllo5vd59AIlaPnCcrBJD5LimZU1y09i8OYukhes
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
```

### 3. Set Up Database Tables

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase-setup.sql`
4. Click **Run** to execute the script

### 4. Install Dependencies

```bash
cd server
npm install @supabase/supabase-js
```

### 5. Test the Connection

Start your server:

```bash
npm start
```

You should see:
```
✅ Supabase connection successful - using Supabase as primary database
🚀 Using Supabase as primary database
📊 Supabase tables will be created via SQL script
```

## 🔍 Troubleshooting

### Connection Issues
- Verify your database password is correct
- Check that your IP is not blocked by Supabase
- Ensure the service role key is correct

### Table Creation Issues
- Make sure you're running the SQL script in the correct database
- Check that you have the necessary permissions
- Verify the SQL syntax is correct

### Server Issues
- Check that all environment variables are set
- Verify the Supabase package is installed
- Check the server logs for specific error messages

## 📊 What's Different with Supabase

1. **Row Level Security (RLS)**: Tables have built-in security policies
2. **Automatic Backups**: Supabase handles database backups
3. **Real-time Subscriptions**: Can use Supabase real-time features
4. **Built-in Auth**: Can integrate with Supabase Auth system
5. **API Access**: REST and GraphQL APIs available

## 🎯 Next Steps

After successful setup:
1. Test user registration and login
2. Test message sending and receiving
3. Verify real-time features work
4. Consider migrating to Supabase Auth for better security

## 📞 Support

If you encounter issues:
1. Check Supabase logs in the dashboard
2. Verify your connection details
3. Test with a simple query first
4. Check the server console for error messages
