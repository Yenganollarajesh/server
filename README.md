# ChatApp Backend Server 🚀

A robust, scalable backend server for the ChatApp application featuring real-time messaging, user authentication, and Supabase database integration.

## ✨ Features

- **Real-time Communication** 🌐
  - Socket.IO server for instant messaging
  - Real-time typing indicators
  - Live user status updates
  - Message broadcasting

- **User Management** 👥
  - User registration and authentication
  - JWT token-based security
  - User online/offline tracking
  - Profile management

- **Database Integration** 🗄️
  - Supabase PostgreSQL database
  - Real-time database subscriptions
  - Row Level Security (RLS)
  - Optimized queries and indexing

- **Message System** 💬
  - Message storage and retrieval
  - Conversation management
  - Unread message tracking
  - Message read status

## 🚀 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time**: Socket.IO
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT
- **Environment**: dotenv
- **Process Management**: nodemon (development)

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account and project
- PostgreSQL knowledge (basic)
- Understanding of WebSockets

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Yenganollarajesh/server.git
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   - Copy `config.env.example` to `config.env`
   - Update with your Supabase credentials:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # Database Configuration (Legacy - Supabase is primary)
   DB_HOST=your_db_host
   DB_NAME=your_db_name
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   
   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key
   ```

4. **Database Setup**
   - Run the Supabase setup script:
   ```sql
   -- Execute this in your Supabase SQL editor
   \i supabase-setup.sql
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 🗄️ Database Setup & Usage

### Option 1: Supabase (Recommended) ☁️

Supabase is a cloud-based PostgreSQL service that provides:
- Managed PostgreSQL database
- Real-time subscriptions
- Built-in authentication
- Row Level Security (RLS)
- Automatic backups

#### Supabase Setup
1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Sign up/Login and create a new project
   - Wait for project initialization

2. **Get Credentials**
   - Go to Settings → API
   - Copy your project URL and API keys
   - Update `config.env` with these values

3. **Run Database Schema**
   ```sql
   -- In Supabase SQL Editor, run:
   \i supabase-setup.sql
   ```

4. **Configure RLS Policies**
   ```sql
   -- Enable RLS on tables
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
   ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
   
   -- Create policies (examples)
   CREATE POLICY "Users can view their own profile" ON users
     FOR SELECT USING (auth.uid() = id);
   
   CREATE POLICY "Users can view conversations they're part of" ON conversations
     FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
   ```

### Option 2: Local PostgreSQL 🖥️

For development or self-hosted environments, you can use local PostgreSQL.

#### Local PostgreSQL Installation

**Windows:**
1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user
4. Add PostgreSQL to your PATH environment variable

**macOS:**
```bash
# Using Homebrew
brew install postgresql
brew services start postgresql

# Or using Postgres.app
# Download from https://postgresapp.com/
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Local Database Setup
1. **Create Database and User**
   ```bash
   # Connect to PostgreSQL as postgres user
   sudo -u postgres psql
   
   # Create database and user
   CREATE DATABASE chatapp;
   CREATE USER chatapp_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE chatapp TO chatapp_user;
   
   # Exit psql
   \q
   ```

2. **Run Schema Scripts**
   ```bash
   # Connect to your database
   psql -h localhost -U chatapp_user -d chatapp
   
   # Run the setup script
   \i setup-db.sql
   ```

3. **Update Environment Variables**
   ```env
   # Local PostgreSQL Configuration
   DB_HOST=localhost
   DB_NAME=chatapp
   DB_USER=chatapp_user
   DB_PASSWORD=your_password
   DB_PORT=5432
   ```

#### PostgreSQL Management Commands

**Connect to Database:**
```bash
# Connect as specific user
psql -h localhost -U username -d database_name

# Connect as postgres user (Linux/macOS)
sudo -u postgres psql

# Connect to default database
psql
```

**Basic PostgreSQL Commands:**
```sql
-- List all databases
\l

-- Connect to a database
\c database_name

-- List all tables
\dt

-- Describe table structure
\d table_name

-- List all users
\du

-- Exit psql
\q
```

**Database Operations:**
```sql
-- Create a new database
CREATE DATABASE database_name;

-- Drop a database
DROP DATABASE database_name;

-- Backup database
pg_dump -h localhost -U username database_name > backup.sql

-- Restore database
psql -h localhost -U username database_name < backup.sql
```

### Database Schema

#### Tables

#### Users Table
```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_online BOOLEAN DEFAULT FALSE
);
```

#### Conversations Table
```sql
CREATE TABLE conversations (
  id BIGSERIAL PRIMARY KEY,
  user1_id BIGINT REFERENCES users(id),
  user2_id BIGINT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message TEXT,
  last_message_time TIMESTAMP,
  last_message_sender_id BIGINT REFERENCES users(id)
);
```

#### Messages Table
```sql
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT REFERENCES conversations(id),
  sender_id BIGINT REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP
);
```

#### Indexes for Performance
```sql
-- Create indexes for better query performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_conversations_users ON conversations(user1_id, user2_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at);
```

#### Database Functions
```sql
-- Function to update conversation last message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET last_message = NEW.content,
      last_message_time = NEW.created_at,
      last_message_sender_id = NEW.sender_id
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update conversation
CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();
```

### Database Connection Testing

#### Test Local PostgreSQL Connection
```bash
# Test connection
psql -h localhost -U username -d database_name -c "SELECT version();"

# Test from Node.js
node check-db.js
```

#### Test Supabase Connection
```bash
# Test using the provided script
node test-connection.js
```

### Database Monitoring & Maintenance

#### Performance Monitoring
```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE tablename IN ('users', 'conversations', 'messages');

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes;
```

#### Regular Maintenance
```sql
-- Analyze tables for better query planning
ANALYZE users;
ANALYZE conversations;
ANALYZE messages;

-- Vacuum tables to reclaim storage
VACUUM ANALYZE users;
VACUUM ANALYZE conversations;
VACUUM ANALYZE messages;
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user profile

### Conversations
- `GET /api/conversations` - Get user conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/:id` - Get conversation details

### Messages
- `GET /api/messages/:conversationId` - Get conversation messages
- `POST /api/messages` - Send new message
- `PUT /api/messages/:id/read` - Mark message as read

## 🌐 Socket.IO Events

### Client to Server
- `typing:start` - User started typing
- `typing:stop` - User stopped typing
- `message:send` - Send new message
- `message:read` - Mark messages as read
- `conversation:opened` - User opened conversation

### Server to Client
- `user_typing_status` - Global typing status update
- `new_message` - New message received
- `user_status_change` - User online/offline status
- `conversation_updated` - Conversation data updated

## 🔧 Configuration

### Supabase Setup
1. Create a new Supabase project
2. Run the SQL scripts from `supabase-setup.sql`
3. Configure Row Level Security policies
4. Set up real-time subscriptions

### Environment Variables
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Public API key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key
- `JWT_SECRET`: Secret key for JWT tokens

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production Deployment
1. **Build the application**
   ```bash
   npm run build
   ```

2. **Environment setup**
   - Set production environment variables
   - Configure production database
   - Set up SSL certificates

3. **Process management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start server.js --name "chatapp-server"
   
   # Using Docker
   docker build -t chatapp-server .
   docker run -p 3000:3000 chatapp-server
   ```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📊 Performance & Scaling

### Optimization Strategies
- Connection pooling for database
- Message queuing for high load
- Redis caching for user sessions
- Load balancing for multiple instances

### Monitoring
- Health check endpoints
- Performance metrics
- Error logging and tracking
- Real-time server status

## 🔒 Security Features

- JWT token authentication
- Password hashing (bcrypt)
- Row Level Security (RLS)
- Input validation and sanitization
- CORS configuration
- Rate limiting

## 🐛 Troubleshooting

### Common Issues

1. **Supabase Connection Failed**
   - Verify credentials in config.env
   - Check network connectivity
   - Ensure database is accessible

2. **Socket.IO Connection Issues**
   - Check client configuration
   - Verify server URL
   - Check firewall settings

3. **Database Errors**
   - Run database setup scripts
   - Check table permissions
   - Verify RLS policies

4. **PostgreSQL Connection Issues**
   - Verify PostgreSQL service is running
   - Check connection credentials
   - Ensure database exists
   - Check firewall settings

### Debug Mode
```bash
# Enable debug logging
DEBUG=socket.io:* npm run dev

# Check server status
curl http://localhost:3000/health

# Test database connection
node check-db.js
```

## 📁 Project Structure

```
server/
├── server.js              # Main server file
├── supabase.js            # Supabase client and helpers
├── supabase-setup.sql     # Database schema setup
├── setup-db.sql           # Local PostgreSQL setup
├── check-db.js            # Database connection test
├── SUPABASE_SETUP.md      # Setup documentation
├── config.env             # Environment variables
├── package.json           # Dependencies
└── README.md              # This file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- **Repository**: https://github.com/Yenganollarajesh/server.git
- **Frontend Mobile**: https://github.com/Yenganollarajesh/mobile.git
- **Supabase**: https://supabase.com/
- **Socket.IO**: https://socket.io/
- **PostgreSQL**: https://www.postgresql.org/

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review the Supabase documentation
- Check PostgreSQL documentation for database issues

---

**Built with ❤️ using Node.js, Express, and Socket.IO**
