import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { EventHandler } from './gameserver.js';

// Updated to trigger restart

const app = express();
const server = createServer(app);

// Enable CORS for all routes
app.use(cors());

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:4200", // Angular dev server
    methods: ["GET", "POST"]
  }
});

// Initialize the game event handler
const eventHandler = new EventHandler(io);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});