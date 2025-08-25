const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const http = require("http");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");
const { supabase, testSupabaseConnection, checkTablesExist } = require("./supabase");

// Load environment variables
require("dotenv").config({ path: "./config.env" });

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 5000;
const host = process.env.HOST || "0.0.0.0";

// Middleware
app.use(cors());
app.use(express.json());

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET || "fallback-secret", (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "mydb",
  password: process.env.DB_PASSWORD || "password123",
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Test database connections on startup
async function testDBConnection() {
  console.log('🔍 Testing database connections...');
  
  // Test Supabase connection first
  try {
    const supabaseConnected = await testSupabaseConnection();
    if (supabaseConnected) {
      console.log('✅ Supabase connection successful - checking tables...');
      
      // Check if required tables exist
      const tablesExist = await checkTablesExist();
      if (tablesExist) {
        console.log('✅ All required tables exist - using Supabase as primary database');
        return { type: 'supabase', connected: true, tablesReady: true };
      } else {
        console.log('⚠️ Supabase connected but tables missing - need to run setup script');
        return { type: 'supabase', connected: true, tablesReady: false };
      }
    }
  } catch (err) {
    console.log('⚠️ Supabase connection failed:', err.message);
  }
  
  // Don't fall back to local PostgreSQL - force Supabase usage
  console.error('❌ Supabase connection required - local PostgreSQL fallback disabled');
  console.error('❌ Please ensure Supabase is properly configured and tables exist');
  return { type: 'none', connected: false };
}

// ✅ Function to create tables automatically
async function initDB() {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(255),
        is_online BOOLEAN DEFAULT false,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Conversations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user1_id, user2_id)
      );
    `);

    // Messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text',
        is_delivered BOOLEAN DEFAULT false,
        is_read BOOLEAN DEFAULT false,
        delivered_at TIMESTAMP,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Reset all users to offline when server starts
    await pool.query("UPDATE users SET is_online = false");

    // Create sample users only if they don't exist
    await createSampleUsers();

    console.log("✅ Database tables are ready");
  } catch (err) {
    console.error("❌ Error creating tables", err);
  }
}

// ✅ Function to create sample users for testing
async function createSampleUsers() {
  try {
    // Check if users already exist
    const existingUsers = await pool.query("SELECT COUNT(*) FROM users");
    if (existingUsers.rows[0].count > 0) {
      console.log(`✅ Users already exist (${existingUsers.rows[0].count} users found)`);
      return;
    }

    const sampleUsers = [
      {
        name: "Alice Johnson",
        email: "alice@example.com",
        password: "password123"
      },
      {
        name: "Bob Smith",
        email: "bob@example.com",
        password: "password123"
      },
      {
        name: "Carol Davis",
        email: "carol@example.com",
        password: "password123"
      },
      {
        name: "David Wilson",
        email: "david@example.com",
        password: "password123"
      },
      {
        name: "Emma Brown",
        email: "emma@example.com",
        password: "password123"
      }
    ];

    for (const user of sampleUsers) {
      // Check if user already exists
      const existing = await pool.query("SELECT id FROM users WHERE email = $1", [user.email]);
      if (existing.rows.length === 0) {
        // Hash password and create user
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await pool.query(
          "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
          [user.name, user.email, hashedPassword]
        );
        console.log(`✅ Created user: ${user.name}`);
      }
    }

    console.log("✅ Sample users are ready");
  } catch (err) {
    console.error("❌ Error creating sample users:", err);
  }
}

// Socket.IO connection handling
const connectedUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId
const userHeartbeats = new Map(); // userId -> last heartbeat time
const userTypingStatus = new Map(); // userId -> { conversationId, timestamp }

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // Authenticate socket connection
  socket.on('authenticate', async (token) => {
    try {
      console.log(`🔐 Authenticating socket ${socket.id} with token`);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback-secret");
      const userId = decoded.userId;
      
      console.log(`✅ User ${userId} authenticated on socket ${socket.id}`);
      
      // Clean up any existing connections for this user to prevent conflicts
      const existingSocketId = connectedUsers.get(userId);
      if (existingSocketId && existingSocketId !== socket.id) {
        console.log(`🔄 Cleaning up existing connection for user ${userId} (socket: ${existingSocketId})`);
        // Remove old socket from tracking
        userSockets.delete(existingSocketId);
        // Mark old socket as disconnected
        const oldSocket = io.sockets.sockets.get(existingSocketId);
        if (oldSocket) {
          oldSocket.disconnect();
        }
      }
      
      connectedUsers.set(userId, socket.id);
      userSockets.set(socket.id, userId);
      userHeartbeats.set(userId, Date.now());
      
      // Update user online status
      await pool.query(
        "UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1",
        [userId]
      );

      console.log(`🟢 User ${userId} marked as ONLINE`);

      // Deliver any pending messages for this user
      await deliverPendingMessages(userId);

              // Send updated conversation data to the user who just connected
        console.log(`🔄 User ${userId} just connected - sending updated conversation data...`);
        await sendUpdatedConversationData(userId);

      // Notify all clients about status change immediately
      io.emit('user_status_change', { userId, isOnline: true });

      socket.emit('authenticated', { success: true });
      
      // Join user to their personal room
      socket.join(`user_${userId}`);
      
      // Log connection state for debugging
      logConnectionState();
      
    } catch (error) {
      console.log('❌ Socket authentication failed:', error.message);
      socket.emit('authentication_error', { message: 'Invalid token' });
    }
  });

  // Handle heartbeat from client
  socket.on('heartbeat', async () => {
    const userId = userSockets.get(socket.id);
    if (userId) {
      userHeartbeats.set(userId, Date.now());
      await pool.query(
        "UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1",
        [userId]
      );
    }
  });

  // Handle app state changes
  socket.on('app_state_change', async (data) => {
    const userId = userSockets.get(socket.id);
    if (userId) {
      const { state } = data; // 'active', 'background', 'inactive'
      
      if (state === 'active') {
        // App became active, mark user as online
        await pool.query(
          "UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1",
          [userId]
        );
        console.log(`🟢 User ${userId} app became ACTIVE, marked ONLINE`);
        
        // Deliver any pending messages for this user
        await deliverPendingMessages(userId);
        
        // Send updated conversation data to the user who just came online
        await sendUpdatedConversationData(userId);
        
        // Notify all clients immediately
        io.emit('user_status_change', { userId, isOnline: true });
      } else if (state === 'background' || state === 'inactive') {
        // App went to background, mark user as offline
        await pool.query(
          "UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1",
          [userId]
        );
        console.log(`🔴 User ${userId} app went to BACKGROUND, marked OFFLINE`);
        
        // Notify all clients immediately
        io.emit('user_status_change', { userId, isOnline: false });
      }
    }
  });

  // Handle typing indicators
  socket.on('typing:start', async (data) => {
    const { conversationId, userId } = data;
    
    // Store typing status globally
    userTypingStatus.set(userId, { conversationId, timestamp: Date.now() });
    
    // Emit to other users in the conversation
    socket.to(conversationId).emit('typing:start', { userId, conversationId });
    
    // Emit typing status to all users who have conversations with this user
    await emitTypingStatusToRelevantUsers(userId, conversationId, true);
  });

  socket.on('typing:stop', async (data) => {
    const { conversationId, userId } = data;
    
    // Remove typing status
    userTypingStatus.delete(userId);
    
    // Emit to other users in the conversation
    socket.to(conversationId).emit('typing:stop', { userId, conversationId });
    
    // Emit typing status to all users who have conversations with this user
    await emitTypingStatusToRelevantUsers(userId, conversationId, false);
  });

  // Handle new messages
  socket.on('message:send', async (data) => {
    try {
      const { conversationId, content, senderId } = data;
      
      // Save message to database
      const result = await pool.query(
        "INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *",
        [conversationId, senderId, content]
      );
      
      const message = result.rows[0];
      
      // Get conversation details to emit to both users
      const convResult = await pool.query(
        "SELECT user1_id, user2_id FROM conversations WHERE id = $1",
        [conversationId]
      );
      
      if (convResult.rows.length > 0) {
        const conv = convResult.rows[0];
        const otherUserId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;
        
        // Check if other user is online - check both socket connection and database status
        const socketOnline = connectedUsers.has(otherUserId);
        
        // Double-check with database to ensure accuracy
        const userStatusResult = await pool.query(
          "SELECT is_online FROM users WHERE id = $1",
          [otherUserId]
        );
        const otherUserOnline = userStatusResult.rows.length > 0 && userStatusResult.rows[0].is_online;
        
        console.log(`🔍 User ${otherUserId} online status - Socket: ${socketOnline}, Database: ${otherUserOnline}`);
        
        // Emit to sender with appropriate delivery status
        if (otherUserOnline) {
          // Other user is online - message will be delivered immediately
          // First, mark message as delivered in database
          await pool.query(
            "UPDATE messages SET is_delivered = true, delivered_at = CURRENT_TIMESTAMP WHERE id = $1",
            [message.id]
          );
          
          // Fetch the updated message with delivery status
          const updatedMessageResult = await pool.query(
            "SELECT * FROM messages WHERE id = $1",
            [message.id]
          );
          const updatedMessage = updatedMessageResult.rows[0];
          
          console.log(`📤 Sending message ${message.id} to sender with 'delivered' status (double tick) - user is online`);
          socket.emit('message:new', {
            ...updatedMessage,
            conversationId,
            deliveryStatus: 'delivered' // Double tick immediately since user is online
          });
          
          // Emit to other user immediately
          const otherUserSocketId = connectedUsers.get(otherUserId);
          console.log(`📨 Sending message ${message.id} to recipient ${otherUserId} with 'delivered' status (double tick)`);
          io.to(otherUserSocketId).emit('message:new', {
            ...updatedMessage,
            conversationId,
            deliveryStatus: 'delivered' // Double tick - delivered
          });
          
          // No delay needed - message is delivered instantly to online user
          console.log(`✅ Message ${message.id} delivered instantly to online user ${otherUserId}`);
          
        } else {
          // Other user is offline - message stays as single tick
          console.log(`📤 Sending message ${message.id} to sender with 'sent' status (single tick) - user is offline`);
          socket.emit('message:new', {
            ...message,
            conversationId,
            deliveryStatus: 'sent' // Single tick - sent but not delivered
          });
          
          // Message remains undelivered until user comes online
          console.log(`⏳ Message ${message.id} will remain undelivered until user ${otherUserId} comes online`);
        }
      }
      
      console.log(`💬 Message sent in conversation ${conversationId}: ${content}`);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      socket.emit('message:error', { message: 'Failed to send message' });
    }
  });

  // Handle message read receipts
  socket.on('message:read', async (data) => {
    try {
      const { conversationId, userId } = data;
      
      console.log(`📖 User ${userId} marking messages as read in conversation ${conversationId}`);
      
      // Mark messages as read
      const result = await pool.query(
        "UPDATE messages SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false RETURNING id",
        [conversationId, userId]
      );
      
      if (result.rows.length > 0) {
        const messageIds = result.rows.map(row => row.id);
        console.log(`✅ Marked ${messageIds.length} messages as read:`, messageIds);
        
        // Get conversation details to find the other user
        const convResult = await pool.query(
          "SELECT user1_id, user2_id FROM conversations WHERE id = $1",
          [conversationId]
        );
        
        if (convResult.rows.length > 0) {
          const conv = convResult.rows[0];
          const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
          
          // Notify the other user (message sender) that their messages were read
          const otherUserSocketId = connectedUsers.get(otherUserId);
          if (otherUserSocketId) {
            io.to(otherUserSocketId).emit('message:read', { 
              conversationId, 
              messageIds,
              readBy: userId 
            });
          }
        }
      }
      
      // Emit read receipt to all connected users (so conversation list can update)
      io.emit('message:read', { conversationId, userId });
      
      console.log(`✅ Messages marked as read in conversation ${conversationId}`);
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
    }
  });

  // Handle conversation opened event
  socket.on('conversation_opened', async (data) => {
    try {
      const { conversationId, userId } = data;
      console.log(`📱 User ${userId} opened conversation ${conversationId}`);
      
      // Notify all users that this conversation was opened (to clear unread count)
      io.emit('conversation_opened', { conversationId, userId });
      
      console.log(`✅ Conversation opened event emitted for conversation ${conversationId}`);
    } catch (error) {
      console.error('❌ Error handling conversation opened event:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    const userId = userSockets.get(socket.id);
    
    if (userId) {
      // Update user offline status
      await pool.query(
        "UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1",
        [userId]
      );
      
      console.log(`🔴 User ${userId} marked as OFFLINE`);
      
      // Remove from tracking maps
      connectedUsers.delete(userId);
      userSockets.delete(socket.id);
      userHeartbeats.delete(userId);
      
      // Clean up typing status
      if (userTypingStatus.has(userId)) {
        const typingData = userTypingStatus.get(userId);
        userTypingStatus.delete(userId);
        
        // Notify other users that typing has stopped
        if (typingData) {
          emitTypingStatusToRelevantUsers(userId, typingData.conversationId, false);
        }
      }
      
      // Notify all clients about status change immediately
      io.emit('user_status_change', { userId, isOnline: false });
      console.log(`🔌 User ${userId} disconnected`);
      
      // Log connection state for debugging
      logConnectionState();
    }
    
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Routes
app.get("/", (req, res) => {
  res.send("🚀 Chat Server is running...");
});

// Test database connection
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) as user_count FROM users");
    console.log("🔍 Database test successful, user count:", result.rows[0].user_count);
    res.json({ 
      success: true, 
      message: "Database connection working", 
      userCount: result.rows[0].user_count 
    });
  } catch (err) {
    console.error("❌ Database test failed:", err);
    res.status(500).json({ 
      success: false, 
      message: "Database connection failed", 
      error: err.message 
    });
  }
});

// Register new user
app.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at",
      [name, email, hashedPassword]
    );

    const user = result.rows[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "fallback-secret",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({ 
      success: true, 
      user,
      token 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Login user
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  try {
    // Find user by email
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const user = result.rows[0];
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Update last_seen but NOT is_online (online status is set by socket connection)
    await pool.query(
      "UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1",
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "fallback-secret",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
    
    // Don't send password in response
    delete user.password;
    
    res.json({ 
      success: true, 
      user,
      token 
    });
  } catch (err) {
    console.error("❌ Database error during login:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all users (excluding current user)
app.get("/users", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, avatar, is_online, last_seen FROM users WHERE id != $1 ORDER BY name",
      [req.user.userId]
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Get all users (for testing - no auth required)
app.get("/test/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, avatar, is_online, last_seen, created_at FROM users ORDER BY name"
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error("❌ Error fetching test users:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Get or create conversation between two users
app.get("/conversations/:otherUserId", authenticateToken, async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const currentUserId = req.user.userId;

    console.log(`🔍 Looking for conversation between user ${currentUserId} and ${otherUserId}`);

    // Check if conversation exists
    let result = await pool.query(
      `SELECT * FROM conversations 
       WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
      [currentUserId, otherUserId]
    );

    let conversation;
    if (result.rows.length === 0) {
      console.log(`📝 Creating new conversation between user ${currentUserId} and ${otherUserId}`);
      // Create new conversation
      result = await pool.query(
        "INSERT INTO conversations (user1_id, user2_id) VALUES ($1, $2) RETURNING *",
        [currentUserId, otherUserId]
      );
      conversation = result.rows[0];
      console.log(`✅ Created conversation ${conversation.id}`);
    } else {
      conversation = result.rows[0];
      console.log(`✅ Found existing conversation ${conversation.id}`);
    }

    res.json({ success: true, conversation });
  } catch (err) {
    console.error("❌ Error with conversation:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Get messages for a conversation
app.get("/conversations/:conversationId/messages", authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user.userId;

    console.log(`🔍 Fetching messages for conversation ${conversationId} by user ${currentUserId}`);

    // Verify user is part of conversation
    const convCheck = await pool.query(
      "SELECT * FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)",
      [conversationId, currentUserId]
    );

    console.log(`🔍 Conversation check result:`, convCheck.rows);

    if (convCheck.rows.length === 0) {
      console.log(`❌ Access denied: User ${currentUserId} not part of conversation ${conversationId}`);
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Get messages
    const result = await pool.query(
      `SELECT m.*, u.name as sender_name 
       FROM messages m 
       JOIN users u ON m.sender_id = u.id 
       WHERE m.conversation_id = $1 
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    console.log(`✅ Found ${result.rows.length} messages for conversation ${conversationId}`);
    res.json({ success: true, messages: result.rows });
  } catch (err) {
    console.error("❌ Error fetching messages:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Get user conversations with last message
app.get("/conversations", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    const result = await pool.query(
      `SELECT 
        c.id as conversation_id,
        CASE 
          WHEN c.user1_id = $1 THEN c.user2_id 
          ELSE c.user1_id 
        END as other_user_id,
        u.name as other_user_name,
        u.email as other_user_email,
        u.avatar as other_user_avatar,
        u.is_online as other_user_online,
        u.last_seen as other_user_last_seen,
        last_msg.content as last_message,
        last_msg.created_at as last_message_time,
        last_msg.sender_id as last_message_sender_id,
        last_msg.is_delivered as last_message_delivered,
        last_msg.is_read as last_message_read,
        unread_count.count as unread_count
       FROM conversations c
       JOIN users u ON (
         CASE 
           WHEN c.user1_id = $1 THEN c.user2_id 
           ELSE c.user1_id 
         END = u.id
       )
       LEFT JOIN LATERAL (
         SELECT content, created_at, sender_id, is_delivered, is_read
         FROM messages 
         WHERE conversation_id = c.id 
         ORDER BY created_at DESC 
         LIMIT 1
       ) last_msg ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) as count
         FROM messages 
         WHERE conversation_id = c.id 
         AND sender_id != $1 
         AND is_read = false
       ) unread_count ON true
       WHERE c.user1_id = $1 OR c.user2_id = $1
       ORDER BY last_msg.created_at DESC NULLS LAST`,
      [currentUserId]
    );

    res.json({ success: true, conversations: result.rows });
  } catch (err) {
    console.error("❌ Error fetching conversations:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Get database status (for debugging)
app.get("/db/status", async (req, res) => {
  try {
    const usersCount = await pool.query("SELECT COUNT(*) FROM users");
    const conversationsCount = await pool.query("SELECT COUNT(*) FROM conversations");
    const messagesCount = await pool.query("SELECT COUNT(*) FROM messages");
    
    res.json({
      success: true,
      database: {
        users: usersCount.rows[0].count,
        conversations: conversationsCount.rows[0].count,
        messages: messagesCount.rows[0].count
      }
    });
  } catch (err) {
    console.error("❌ Error getting DB status:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Get current online status of all users (for debugging)
app.get("/debug/online-status", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, is_online, last_seen, 
             CASE 
               WHEN is_online THEN '🟢 ONLINE'
               ELSE '🔴 OFFLINE'
             END as status
      FROM users 
      ORDER BY is_online DESC, name
    `);
    
    res.json({
      success: true,
      onlineUsers: result.rows.filter(u => u.is_online),
      offlineUsers: result.rows.filter(u => !u.is_online),
      totalUsers: result.rows.length,
      users: result.rows
    });
  } catch (err) {
    console.error("❌ Error getting online status:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Start server
server.listen(port, host, async () => {
  console.log(`✅ Chat Server running on http://localhost:${port}`);
  console.log(`✅ Server also accessible on your local IP address: http://10.160.204.181:${port}`);
  console.log(`✅ Server listening on all network interfaces (${host}:${port})`);
  
  try {
    // Test database connections first
    const dbResult = await testDBConnection();
    if (!dbResult.connected) {
      console.log('⚠️  Server started but database connection failed');
      console.log('⚠️  Some features may not work properly');
      return;
    }
    
    if (dbResult.type === 'supabase') {
      if (dbResult.tablesReady) {
        console.log('🚀 Using Supabase as primary database - all tables ready');
      } else {
        console.log('🚀 Using Supabase as primary database - tables need setup');
        console.log('📋 Please run the SQL script in Supabase SQL Editor:');
        console.log('📋 Copy contents of server/supabase-setup.sql and run it');
        console.log('⚠️  Server will start but features may not work until tables are created');
      }
    } else {
      console.error('❌ Supabase connection failed - server cannot start');
      console.error('❌ Please check your Supabase configuration and ensure tables exist');
      process.exit(1);
    }
    
    // Start heartbeat cleanup job
    startHeartbeatCleanup();
  } catch (error) {
    console.error('❌ Error during startup:', error);
    console.log('⚠️  Server started but with errors');
  }
});

// Heartbeat cleanup job - runs every 30 seconds
function startHeartbeatCleanup() {
  setInterval(async () => {
    try {
      const now = Date.now();
      const HEARTBEAT_TIMEOUT = 30000; // 30 seconds timeout (more responsive)
      
      for (const [userId, lastHeartbeat] of userHeartbeats.entries()) {
        if (now - lastHeartbeat > HEARTBEAT_TIMEOUT) {
          // User is offline
          await pool.query(
            "UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1",
            [userId]
          );
          
          console.log(`🔴 User ${userId} marked as OFFLINE due to heartbeat timeout`);
          
          // Get the socket ID for this user before cleanup
          const socketId = connectedUsers.get(userId);
          
          // Remove from connected users
          connectedUsers.delete(userId);
          
          // Remove from userSockets using the correct socketId
          if (socketId) {
            userSockets.delete(socketId);
          }
          
          userHeartbeats.delete(userId);
          
          // Notify all clients about status change
          io.emit('user_status_change', { userId, isOnline: false });
        }
      }
      
      // Log connection state after cleanup for debugging
      if (userHeartbeats.size === 0) {
        console.log('📊 All users cleaned up, no active connections');
      }
    } catch (error) {
      console.error('❌ Error in heartbeat cleanup:', error);
    }
  }, 10000); // Check every 10 seconds (more frequent checks)
}

// Helper function to log current connection state for debugging
function logConnectionState() {
  console.log('📊 Current Connection State:');
  console.log(`  Connected Users: ${connectedUsers.size}`);
  console.log(`  User Sockets: ${userSockets.size}`);
  console.log(`  User Heartbeats: ${userHeartbeats.size}`);
  
  if (connectedUsers.size > 0) {
    console.log('  Active Users:');
    for (const [userId, socketId] of connectedUsers.entries()) {
      const lastHeartbeat = userHeartbeats.get(userId);
      const timeSinceHeartbeat = lastHeartbeat ? Date.now() - lastHeartbeat : 'N/A';
      console.log(`    User ${userId} -> Socket ${socketId} (Last heartbeat: ${timeSinceHeartbeat}ms ago)`);
    }
  }
}

// Function to deliver pending messages when user comes online
async function deliverPendingMessages(userId) {
  try {
    // Find all undelivered messages for this user
    const result = await pool.query(`
      SELECT m.*, c.user1_id, c.user2_id 
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE (c.user1_id = $1 OR c.user2_id = $1)
      AND m.sender_id != $1
      AND m.is_delivered = false
    `, [userId]);
    
    if (result.rows.length > 0) {
      console.log(`📬 Found ${result.rows.length} pending messages for user ${userId}:`);
      for (const message of result.rows) {
        console.log(`  - Message ${message.id}: "${message.content}" from user ${message.sender_id}`);
      }
      
      for (const message of result.rows) {
        // Mark message as delivered
        await pool.query(
          "UPDATE messages SET is_delivered = true, delivered_at = CURRENT_TIMESTAMP WHERE id = $1",
          [message.id]
        );
        
        // Find the sender
        const senderId = message.sender_id;
        const senderSocketId = connectedUsers.get(senderId);
        
        if (senderSocketId) {
          // Notify sender that their message was delivered
          console.log(`📬 Notifying sender ${senderId} that message ${message.id} was delivered to user ${userId}`);
          io.to(senderSocketId).emit('message:delivered', { 
            messageId: message.id,
            conversationId: message.conversation_id
          });
        } else {
          console.log(`⚠️ Sender ${senderId} is not online, cannot notify about message delivery`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error delivering pending messages:', error);
  }
}

// Function to emit typing status to all users who have conversations with the typing user
async function emitTypingStatusToRelevantUsers(typingUserId, conversationId, isTyping) {
  try {
    // Get all users who have conversations with the typing user
    const result = await pool.query(`
      SELECT 
        CASE 
          WHEN c.user1_id = $1 THEN c.user2_id
          WHEN c.user2_id = $1 THEN c.user1_id
        END as other_user_id
      FROM conversations c
      WHERE c.user1_id = $1 OR c.user2_id = $1
    `, [typingUserId]);
    
    if (result.rows.length > 0) {
      // Emit typing status to all relevant users
      result.rows.forEach(async (row) => {
        const otherUserId = row.other_user_id;
        const otherUserSocketId = connectedUsers.get(otherUserId);
        
        if (otherUserSocketId) {
          // Get the typing user's name
          const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [typingUserId]);
          const userName = userResult.rows[0]?.name || 'Unknown User';
          
          console.log(`⌨️ Emitting typing status: ${isTyping ? 'start' : 'stop'} for user ${typingUserId} (${userName}) to user ${otherUserId}`);
          
          io.to(otherUserSocketId).emit('user_typing_status', {
            userId: typingUserId,
            userName: userName,
            conversationId: conversationId,
            isTyping: isTyping
          });
        }
      });
    }
  } catch (error) {
    console.error('❌ Error emitting typing status to relevant users:', error);
  }
}

// Function to send updated conversation data to user who just came online
async function sendUpdatedConversationData(userId) {
  try {
    console.log(`📊 Sending updated conversation data to user ${userId} who just came online`);
    console.log(`🔍 Fetching conversations for user ${userId}...`);
    
    // Use Supabase instead of local PostgreSQL
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        user1_id,
        user2_id,
        created_at
      `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
    
    if (convError) {
      console.error('❌ Error fetching conversations from Supabase:', convError);
      return;
    }
    
    if (conversations && conversations.length > 0) {
      console.log(`📊 Found ${conversations.length} conversations for user ${userId}`);
      
      // For each conversation, get the other user's info
      const conversationData = [];
      
      for (const conv of conversations) {
        const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
        
        // Get other user's info
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, name, email, avatar, is_online, last_seen, created_at')
          .eq('id', otherUserId)
          .single();
        
        if (userError) {
          console.error(`❌ Error fetching user ${otherUserId}:`, userError);
          continue;
        }
        
        // Create conversation object with default values for missing columns
        const convData = {
          conversation_id: conv.id,
          last_message: '', // Default empty since column doesn't exist yet
          last_message_time: conv.created_at,
          last_message_sender_id: 0,
          last_message_delivered: false,
          last_message_read: false,
          unread_count: 0,
          other_user_id: userData.id,
          other_user_name: userData.name,
          other_user_email: userData.email,
          other_user_avatar: userData.avatar || '',
          other_user_last_seen: userData.last_seen || userData.created_at,
          other_user_online: userData.is_online || false
        };
        
        conversationData.push(convData);
        
        console.log(`  📱 Conversation ${conv.id}:`);
        console.log(`    - ID: ${conv.id}`);
        console.log(`    - Other user: ${userData.name} (${userData.id})`);
        console.log(`    - Other user online: ${userData.is_online || false}`);
      }
      
      // Get the user's socket ID
      const userSocketId = connectedUsers.get(userId);
      if (userSocketId) {
        // Send updated conversation data
        const dataToSend = {
          conversations: conversationData,
          userId: userId
        };
        console.log(`📤 Sending conversations_updated event to user ${userId}:`);
        console.log(`📤 Event data:`, JSON.stringify(dataToSend, null, 2));
        
        io.to(userSocketId).emit('conversations_updated', dataToSend);
        console.log(`✅ Sent updated conversation data to user ${userId}`);
      } else {
        console.log(`⚠️ User ${userId} socket not found, cannot send conversation updates`);
      }
    }
  } catch (error) {
    console.error('❌ Error sending updated conversation data:', error);
  }
}
