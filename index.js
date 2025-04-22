const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

// ✅ Only use admin SDK here
const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY).replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// In-memory map to track online users
const onlineUsers = new Map(); // userId => socket.id

// CORS configuration (update with actual frontend URLs if needed)
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:8081'],
  methods: ['GET', 'POST'],
  credentials: true,
}));

// Initialize Socket.IO
const io = socketIO(server, {
  cors: {
    origin: ['http://localhost:8080', 'http://localhost:8081'],
    methods: ['GET', 'POST'],
  }
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log(`🟢 New client connected: ${socket.id}`);

  // Handle user registration
  socket.on("register", async ({ userId, chatId }) => {
    socket.join(userId); // Join room
  });  
  // Handle fetching previous messages manually
  socket.on("get_messages", async ({ chatId }) => {
    try {
      const messagesSnapshot = await db
        .collection("messages")
        .doc(chatId)
        .collection("chat")
        .orderBy("timestamp", "asc")
        .get();
  
      const messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      socket.emit("loadMessages", messages);
    } catch (err) {
      console.error("❌ Failed to fetch messages:", err);
      socket.emit("loadMessages", []); // Send empty array on error
    }
  });  
  // Handle sending private messages
  socket.on('private_message', async ({ from, to, content, tag, chatId }) => {
    const message = {
      from,
      to,
      content,
      tag: tag || null,
      timestamp: new Date(),
      status: 'sent',
    };

    try {
      // Save to Firestore: messages/{chatId}
      const messageRef = db.collection('messages').doc(chatId).collection('chat');
      await messageRef.add(message);

      console.log(`💬 Message stored and sent from ${from} to ${to}`);

      // Emit message to receiver
      io.to(to).emit('private_message', message);
    } catch (error) {
      console.error('❌ Error saving message:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);

    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
  });
});
