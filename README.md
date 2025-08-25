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

## 🗄️ Database Schema

### Tables

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

### Debug Mode
```bash
# Enable debug logging
DEBUG=socket.io:* npm run dev

# Check server status
curl http://localhost:3000/health
```

## 📁 Project Structure

```
server/
├── server.js              # Main server file
├── supabase.js            # Supabase client and helpers
├── supabase-setup.sql     # Database schema setup
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

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review the Supabase documentation

---

**Built with ❤️ using Node.js, Express, and Socket.IO**
