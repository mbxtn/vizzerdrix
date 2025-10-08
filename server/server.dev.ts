import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { EventHandler } from './gameserver.js';

const app = express();
const server = createServer(app);

// Enable CORS for development - allow Angular dev server
app.use(cors({
  origin: "http://localhost:4200",
  credentials: true
}));

// Socket.io setup for development
const io = new Server(server, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize the game event handler
const eventHandler = new EventHandler(io);

// Development-only routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Vizzerdrix Game Server (Development Mode)',
    mode: 'development',
    webClient: 'http://localhost:4200',
    gameServer: `http://localhost:${PORT}`,
    note: 'This server only provides API and WebSocket. Visit http://localhost:4200 for the web client.'
  });
});

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'development' });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Development server running on port ${PORT}`);
  console.log(`Expecting Angular dev server on http://localhost:4200`);
});